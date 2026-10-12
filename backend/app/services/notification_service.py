from beanie import PydanticObjectId

from app.core.exceptions import NotFoundError
from app.models.notification import Notification, NotificationType
from app.models.task import Task
from app.permissions.context import AuthContext
from app.repositories.notification_repository import notification_repository
from app.repositories.project_repository import project_repository
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.schemas.common import Page, UserBrief
from app.schemas.notification import MarkedReadOut, NotificationOut, UnreadCountOut
from app.services import email_service
from app.utils.object_id import to_object_id
from app.utils.pagination import PageParams


async def notify(
    task: Task,
    actor_id: PydanticObjectId | None,
    recipient_ids: list[PydanticObjectId],
    notification_type: NotificationType,
) -> None:
    for recipient_id in dict.fromkeys(recipient_ids):
        if recipient_id == actor_id:
            continue
        await notification_repository.insert(
            Notification(
                user_id=recipient_id,
                type=notification_type,
                task_id=task.pk,
                project_id=task.project_id,
                actor_id=actor_id,
            )
        )
        await email_service.notify_issue(recipient_id, actor_id, task, notification_type)


async def notify_assignment(
    task: Task, actor_id: PydanticObjectId, assignee_id: PydanticObjectId | None
) -> None:
    if assignee_id is None:
        return
    await notify(task, actor_id, [assignee_id], NotificationType.TASK_ASSIGNED)


async def _to_outputs(notifications: list[Notification]) -> list[NotificationOut]:
    actors = {
        user.pk: user
        for user in await user_repository.find_by_ids(
            item.actor_id for item in notifications if item.actor_id
        )
    }
    tasks = {
        task.pk: task
        for task in await task_repository.find_by_ids(item.task_id for item in notifications)
    }
    projects = {
        project.pk: project
        for project in await project_repository.find_by_ids(
            item.project_id for item in notifications
        )
    }
    outputs: list[NotificationOut] = []
    for item in notifications:
        task = tasks.get(item.task_id)
        project = projects.get(item.project_id)
        outputs.append(
            NotificationOut(
                id=item.pk,
                type=item.type,
                task_id=item.task_id,
                task_title=task.title if task else None,
                task_key=f"{project.key}-{task.issue_number}" if task and project else None,
                project_id=item.project_id,
                project_name=project.name if project else None,
                project_key=project.key if project else None,
                actor=UserBrief.from_user(actors[item.actor_id])
                if item.actor_id and item.actor_id in actors
                else None,
                is_read=item.is_read,
                created_at=item.created_at,
            )
        )
    return outputs


async def list_notifications(
    auth: AuthContext, params: PageParams, unread_only: bool
) -> Page[NotificationOut]:
    items, total = await notification_repository.list_for_user(
        auth.user.pk, unread_only, params.skip, params.limit
    )
    return Page(
        items=await _to_outputs(items), total=total, page=params.page, page_size=params.page_size
    )


async def unread_count(auth: AuthContext) -> UnreadCountOut:
    return UnreadCountOut(count=await notification_repository.unread_count(auth.user.pk))


async def mark_read(auth: AuthContext, notification_id: str) -> NotificationOut:
    notification = await notification_repository.get(to_object_id(notification_id))
    if notification is None or notification.user_id != auth.user.pk:
        raise NotFoundError("Notification not found", code="notification_not_found")
    notification.is_read = True
    await notification_repository.save(notification)
    [output] = await _to_outputs([notification])
    return output


async def mark_all_read(auth: AuthContext) -> MarkedReadOut:
    return MarkedReadOut(updated=await notification_repository.mark_all_read(auth.user.pk))
