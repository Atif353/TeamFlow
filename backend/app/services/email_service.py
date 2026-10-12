import logging
import secrets
from datetime import timedelta
from typing import Any

from beanie import PydanticObjectId

from app.core.config import get_settings
from app.core.mailer import get_mailer
from app.emails.renderer import render
from app.models.email_outbox import EmailOutbox, EmailStatus
from app.models.notification import NotificationType
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.repositories.email_repository import email_repository
from app.repositories.project_repository import project_repository
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.utils.time import datetime_to_date, utcnow

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 5
DEDUPE_MINUTES = 5
DELIVERY_BATCH = 25
ERROR_LIMIT = 500
VERIFICATION_MINUTES = 10
DIGEST_HOUR_UTC = 7
DIGEST_WINDOW_DAYS = 2
DIGEST_LIMIT = 15

PREFERENCE_BY_TYPE = {
    NotificationType.TASK_ASSIGNED: "assigned",
    NotificationType.MENTIONED: "mentioned",
    NotificationType.COMMENT_ADDED: "comments",
    NotificationType.STATUS_CHANGED: "status_changes",
    NotificationType.TASK_OVERDUE: "overdue",
}
HEADLINES = {
    NotificationType.TASK_ASSIGNED: "{actor} assigned you an issue.",
    NotificationType.MENTIONED: "{actor} mentioned you on an issue.",
    NotificationType.COMMENT_ADDED: "{actor} commented on an issue you follow.",
    NotificationType.STATUS_CHANGED: "{actor} changed the status of an issue you follow.",
    NotificationType.TASK_OVERDUE: "An issue assigned to you is past its due date.",
}
SUBJECTS = {
    NotificationType.TASK_ASSIGNED: "{actor} assigned you {key}",
    NotificationType.MENTIONED: "{actor} mentioned you on {key}",
    NotificationType.COMMENT_ADDED: "New comment on {key}",
    NotificationType.STATUS_CHANGED: "{key} changed status",
    NotificationType.TASK_OVERDUE: "{key} is overdue",
}


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _frontend(path: str) -> str:
    return f"{get_settings().frontend_url.rstrip('/')}{path}"


async def queue(
    to_address: str,
    subject: str,
    template: str,
    category: str,
    preheader: str = "",
    user_id: PydanticObjectId | None = None,
    task_id: PydanticObjectId | None = None,
    **context: Any,
) -> None:
    html, text = render(template, subject, preheader, **context)
    await email_repository.insert(
        EmailOutbox(
            to_address=to_address,
            subject=subject,
            html=html,
            text=text,
            category=category,
            user_id=user_id,
            task_id=task_id,
        )
    )


async def send_verification_code(user: User, code: str) -> None:
    await queue(
        user.email,
        f"{code} is your {get_settings().app_name} verification code",
        "verification",
        "verification",
        preheader="Enter this code to verify your email address.",
        user_id=user.pk,
        name=user.name,
        code=code,
        minutes=VERIFICATION_MINUTES,
    )


async def send_password_reset(user: User, url: str, hours: int) -> None:
    await queue(
        user.email,
        "Reset your password",
        "password_reset",
        "password_reset",
        preheader="Use this link to choose a new password.",
        user_id=user.pk,
        name=user.name,
        url=url,
        hours=hours,
    )


async def send_invitation(
    to_address: str, workspace: str, inviter: str, role: str, url: str, days: int
) -> None:
    await queue(
        to_address,
        f"{inviter} invited you to {workspace}",
        "invitation",
        "invitation",
        preheader=f"Join {workspace} on {get_settings().app_name}.",
        workspace=workspace,
        inviter=inviter,
        role=role,
        url=url,
        days=days,
    )


async def send_account_created(user: User, workspace: str, creator: str, role: str) -> None:
    await queue(
        user.email,
        f"Your {get_settings().app_name} account is ready",
        "account_created",
        "account_created",
        preheader=f"{creator} created an account for you.",
        user_id=user.pk,
        name=user.name,
        workspace=workspace,
        creator=creator,
        role=role,
        url=_frontend("/login"),
    )


async def notify_issue(
    recipient_id: PydanticObjectId,
    actor_id: PydanticObjectId | None,
    task: Task,
    notification_type: NotificationType,
) -> None:
    recipient = await user_repository.get(recipient_id)
    if recipient is None or not recipient.is_active or not recipient.email_verified:
        return
    if not getattr(recipient.email_preferences, PREFERENCE_BY_TYPE[notification_type]):
        return
    category = f"issue_{notification_type.value}"
    since = utcnow() - timedelta(minutes=DEDUPE_MINUTES)
    if await email_repository.exists_since(recipient.pk, task.pk, category, since):
        return
    project = await project_repository.get(task.project_id)
    if project is None:
        return
    actor = await user_repository.get(actor_id) if actor_id else None
    key = f"{project.key}-{task.issue_number}"
    actor_name = actor.name if actor else "Someone"
    status = project.status_by_id(task.status_id)
    await queue(
        recipient.email,
        SUBJECTS[notification_type].format(actor=actor_name, key=key),
        "issue_notification",
        category,
        preheader=task.title,
        user_id=recipient.pk,
        task_id=task.pk,
        headline=HEADLINES[notification_type].format(actor=actor_name),
        issue_type=task.issue_type.value.replace("_", " ").title(),
        key=key,
        project=project.name,
        title=task.title,
        priority=task.priority.value.title(),
        due=str(datetime_to_date(task.due_date)) if task.due_date else None,
        status=status.name if status else None,
        url=_frontend(f"/browse/{key}"),
        settings_url=_frontend("/profile"),
    )


async def deliver_pending(limit: int = DELIVERY_BATCH) -> int:
    mailer = get_mailer()
    delivered = 0
    for message in await email_repository.due(utcnow(), limit):
        try:
            await mailer.send(message.to_address, message.subject, message.html, message.text)
        except Exception as error:
            logger.warning("Email to %s failed: %r", message.to_address, error)
            message.attempts += 1
            message.error = str(error)[:ERROR_LIMIT]
            if message.attempts >= MAX_ATTEMPTS:
                message.status = EmailStatus.FAILED
            else:
                message.next_attempt_at = utcnow() + timedelta(minutes=2**message.attempts)
        else:
            message.status = EmailStatus.SENT
            message.sent_at = utcnow()
            delivered += 1
        await email_repository.save(message)
    return delivered


def _digest_item(task: Task, project: Project) -> dict[str, str]:
    key = f"{project.key}-{task.issue_number}"
    return {
        "key": key,
        "title": task.title,
        "project": project.name,
        "due": str(datetime_to_date(task.due_date)),
        "url": _frontend(f"/browse/{key}"),
    }


async def send_daily_digests() -> int:
    now = utcnow()
    if now.hour < DIGEST_HOUR_UTC:
        return 0
    today = str(now.date())
    sent = 0
    for user in await user_repository.digest_candidates(today):
        project_ids = await project_repository.project_ids_for_user(user.pk)
        projects = {p.pk: p for p in await project_repository.find_by_ids(project_ids)}
        dated = [
            task
            for task in await task_repository.open_assigned(user.pk, project_ids)
            if task.due_date is not None
        ]
        horizon = now + timedelta(days=DIGEST_WINDOW_DAYS)
        overdue = [task for task in dated if task.due_date and task.due_date < now]
        soon = [task for task in dated if task.due_date and now <= task.due_date <= horizon]
        user.last_digest_on = today
        await user_repository.save(user)
        sections = [
            {
                "title": title,
                "entries": [_digest_item(t, projects[t.project_id]) for t in items[:DIGEST_LIMIT]],
            }
            for title, items in (("Overdue", overdue), ("Due soon", soon))
            if items
        ]
        if not sections:
            continue
        await queue(
            user.email,
            "Your issues due today and overdue",
            "digest",
            "digest",
            preheader="A summary of what needs your attention.",
            user_id=user.pk,
            name=user.name,
            sections=sections,
            url=_frontend("/dashboard"),
            settings_url=_frontend("/profile"),
        )
        sent += 1
    return sent
