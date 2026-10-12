from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

import pytest
from httpx import AsyncClient

from app.core.mailer import set_mailer
from app.emails.renderer import render, to_text
from app.models.email_outbox import EmailOutbox, EmailStatus
from app.models.email_verification import EmailVerification
from app.models.user import User
from app.repositories.email_repository import email_repository
from app.services import email_service
from app.services.job_service import run_exclusive
from app.utils.time import utcnow
from tests.factories import (
    DEFAULT_PASSWORD,
    World,
    api_add_member,
    api_create_project,
    api_create_task,
    auth_headers,
    unique_email,
)


@dataclass
class SentMessage:
    to_address: str
    subject: str
    html: str
    text: str


@dataclass
class FakeMailer:
    sent: list[SentMessage] = field(default_factory=list)
    failing: bool = False

    async def send(self, to_address: str, subject: str, html: str, text: str) -> None:
        if self.failing:
            raise ConnectionError("smtp unavailable")
        self.sent.append(SentMessage(to_address, subject, html, text))

    def to(self, address: str) -> list[SentMessage]:
        return [message for message in self.sent if message.to_address == address]


@pytest.fixture
def mailer() -> Iterator[FakeMailer]:
    fake = FakeMailer()
    set_mailer(fake)
    yield fake
    set_mailer(None)


async def register(client: AsyncClient, email: str) -> dict[str, Any]:
    response = await client.post(
        "/auth/register",
        json={"name": "Eve Explorer", "email": email, "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def force_resend_window(email: str) -> None:
    user = await User.find_one({"email": email})
    assert user is not None
    record = await EmailVerification.find_one({"user_id": user.pk})
    assert record is not None
    record.sent_at = utcnow() - timedelta(minutes=5)
    await record.save()


async def test_signup_sends_a_branded_email_with_the_six_digit_code(
    client: AsyncClient, mailer: FakeMailer
) -> None:
    email = unique_email("code")
    body = await register(client, email)

    await email_service.deliver_pending()

    [message] = mailer.to(email)
    assert body["dev_code"] in message.subject
    assert body["dev_code"] in message.html
    assert body["dev_code"] in message.text
    assert "Verify your email" in message.html
    assert "<" not in message.text
    assert "expires in 10 minutes" in message.text


async def test_wrong_code_is_rejected_and_attempts_are_limited(client: AsyncClient) -> None:
    email = unique_email("attempts")
    body = await register(client, email)
    wrong = "000000" if body["dev_code"] != "000000" else "111111"

    first = await client.post("/auth/verify-email", json={"email": email, "code": wrong})
    for _ in range(4):
        await client.post("/auth/verify-email", json={"email": email, "code": wrong})
    locked = await client.post(
        "/auth/verify-email", json={"email": email, "code": body["dev_code"]}
    )

    assert first.status_code == 422
    assert first.json()["code"] == "invalid_code"
    assert locked.status_code == 429
    assert locked.json()["code"] == "too_many_attempts"


async def test_expired_code_is_gone(client: AsyncClient) -> None:
    email = unique_email("expired")
    body = await register(client, email)
    user = await User.find_one({"email": email})
    assert user is not None
    record = await EmailVerification.find_one({"user_id": user.pk})
    assert record is not None
    record.expires_at = utcnow() - timedelta(seconds=1)
    await record.save()

    response = await client.post(
        "/auth/verify-email", json={"email": email, "code": body["dev_code"]}
    )

    assert response.status_code == 410
    assert response.json()["code"] == "code_expired"


async def test_code_must_be_exactly_six_digits(client: AsyncClient) -> None:
    email = unique_email("format")
    await register(client, email)

    response = await client.post("/auth/verify-email", json={"email": email, "code": "12ab56"})

    assert response.status_code == 422


async def test_resend_is_throttled_and_replaces_the_old_code(
    client: AsyncClient, mailer: FakeMailer
) -> None:
    email = unique_email("resend")
    first = await register(client, email)

    too_soon = await client.post("/auth/resend-code", json={"email": email})
    await force_resend_window(email)
    resent = await client.post("/auth/resend-code", json={"email": email})
    old = await client.post("/auth/verify-email", json={"email": email, "code": first["dev_code"]})
    fresh = await client.post(
        "/auth/verify-email", json={"email": email, "code": resent.json()["dev_code"]}
    )

    assert too_soon.status_code == 429
    assert too_soon.json()["code"] == "resend_too_soon"
    assert resent.status_code == 200
    assert old.status_code == 422
    assert fresh.status_code == 200
    client.cookies.clear()


async def test_resend_limit_per_hour(client: AsyncClient) -> None:
    email = unique_email("hourly")
    await register(client, email)

    statuses = []
    for _ in range(6):
        await force_resend_window(email)
        statuses.append((await client.post("/auth/resend-code", json={"email": email})).status_code)

    assert statuses[:4] == [200, 200, 200, 200]
    assert statuses[-1] == 429


async def test_resend_for_unknown_or_verified_accounts_reveals_nothing(
    client: AsyncClient, world: World
) -> None:
    unknown = await client.post("/auth/resend-code", json={"email": unique_email("ghost")})
    verified = await client.post("/auth/resend-code", json={"email": world.member.email})

    assert unknown.status_code == verified.status_code == 200
    assert unknown.json() == verified.json() == {"dev_code": None}


async def test_verified_users_cannot_verify_again(client: AsyncClient, world: World) -> None:
    response = await client.post(
        "/auth/verify-email", json={"email": world.member.email, "code": "123456"}
    )

    assert response.status_code == 422


async def create_project_with_members(client: AsyncClient, world: World) -> dict[str, Any]:
    project = await api_create_project(client, world.manager)
    for user in (world.member, world.other_member):
        await api_add_member(client, world.manager, project["id"], user)
    return project


async def test_assignment_sends_an_issue_email_with_a_deep_link(
    client: AsyncClient, world: World, mailer: FakeMailer
) -> None:
    project = await create_project_with_members(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], title="Ship it", assignee_id=str(world.member.pk)
    )

    await email_service.deliver_pending()

    [message] = mailer.to(world.member.email)
    assert task["key"] in message.subject
    assert world.manager.name in message.subject
    assert "Ship it" in message.html
    assert f"/browse/{task['key']}" in message.html
    assert "Open issue" in message.html
    assert not mailer.to(world.manager.email)


async def test_self_assignment_and_unassigned_issues_send_nothing(
    client: AsyncClient, world: World, mailer: FakeMailer
) -> None:
    project = await create_project_with_members(client, world)
    await api_create_task(client, world.member, project["id"], assignee_id=str(world.member.pk))
    await api_create_task(client, world.manager, project["id"], issue_type="epic")

    await email_service.deliver_pending()

    assert mailer.sent == []


async def test_user_can_turn_assignment_emails_off(
    client: AsyncClient, world: World, mailer: FakeMailer
) -> None:
    project = await create_project_with_members(client, world)
    preferences = {
        "assigned": False,
        "mentioned": True,
        "overdue": True,
        "comments": False,
        "status_changes": False,
        "daily_digest": False,
    }
    saved = await client.put(
        "/users/me/email-preferences", json=preferences, headers=auth_headers(world.member)
    )
    await api_create_task(client, world.manager, project["id"], assignee_id=str(world.member.pk))

    await email_service.deliver_pending()

    assert saved.status_code == 200
    assert saved.json()["email_preferences"]["assigned"] is False
    assert mailer.to(world.member.email) == []


async def test_repeat_events_within_five_minutes_send_one_email(
    client: AsyncClient, world: World, mailer: FakeMailer
) -> None:
    project = await create_project_with_members(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.member.pk)
    )
    for user in (world.other_member, world.member):
        await client.patch(
            f"/tasks/{task['id']}",
            json={"assignee_id": str(user.pk)},
            headers=auth_headers(world.manager),
        )

    await email_service.deliver_pending()

    assert len(mailer.to(world.member.email)) == 1
    assert len(mailer.to(world.other_member.email)) == 1


async def test_mentions_email_the_mentioned_member_but_comments_are_opt_in(
    client: AsyncClient, world: World, mailer: FakeMailer
) -> None:
    project = await create_project_with_members(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.other_member.pk)
    )
    await client.post(
        f"/tasks/{task['id']}/comments",
        json={"body": f"Can you check this @{world.member.name}?"},
        headers=auth_headers(world.manager),
    )

    await email_service.deliver_pending()

    mention = [m for m in mailer.to(world.member.email) if "mentioned" in m.subject]
    assert len(mention) == 1
    assert [m for m in mailer.to(world.other_member.email) if "comment" in m.subject.lower()] == []


async def test_comment_emails_reach_watchers_who_opted_in(
    client: AsyncClient, world: World, mailer: FakeMailer
) -> None:
    project = await create_project_with_members(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.other_member.pk)
    )
    await client.put(
        "/users/me/email-preferences",
        json={
            "assigned": True,
            "mentioned": True,
            "overdue": True,
            "comments": True,
            "status_changes": False,
            "daily_digest": False,
        },
        headers=auth_headers(world.other_member),
    )
    await client.post(
        f"/tasks/{task['id']}/comments",
        json={"body": "Looks good"},
        headers=auth_headers(world.manager),
    )

    await email_service.deliver_pending()

    assert any("New comment" in m.subject for m in mailer.to(world.other_member.email))


async def test_issue_titles_are_escaped_in_email_html(
    client: AsyncClient, world: World, mailer: FakeMailer
) -> None:
    project = await create_project_with_members(client, world)
    await api_create_task(
        client,
        world.manager,
        project["id"],
        title="<script>alert(1)</script> & more",
        assignee_id=str(world.member.pk),
    )

    await email_service.deliver_pending()

    [message] = mailer.to(world.member.email)
    assert "<script>" not in message.html
    assert "&lt;script&gt;" in message.html
    assert "<script>alert(1)</script> & more" in message.text


async def test_failed_deliveries_retry_with_backoff_and_then_give_up(
    client: AsyncClient, mailer: FakeMailer
) -> None:
    email = unique_email("retry")
    await register(client, email)
    mailer.failing = True

    for _ in range(email_service.MAX_ATTEMPTS):
        await email_service.deliver_pending()
        pending = await email_repository.for_address(email)
        for message in pending:
            message.next_attempt_at = utcnow() - timedelta(seconds=1)
            await message.save()

    [message] = await email_repository.for_address(email)
    assert message.status == EmailStatus.FAILED
    assert message.attempts == email_service.MAX_ATTEMPTS
    assert "smtp unavailable" in (message.error or "")


async def test_transient_failure_is_retried_later(client: AsyncClient, mailer: FakeMailer) -> None:
    email = unique_email("transient")
    await register(client, email)
    mailer.failing = True
    await email_service.deliver_pending()
    [queued] = await email_repository.for_address(email)
    assert queued.status == EmailStatus.PENDING
    assert queued.next_attempt_at > utcnow()

    mailer.failing = False
    queued.next_attempt_at = utcnow() - timedelta(seconds=1)
    await queued.save()
    await email_service.deliver_pending()

    assert len(mailer.to(email)) == 1


async def test_invitation_and_password_reset_and_new_account_emails(
    client: AsyncClient, world: World, mailer: FakeMailer
) -> None:
    invited = unique_email("invitee")
    invitation = await client.post(
        "/invitations", json={"email": invited, "role": "member"}, headers=auth_headers(world.admin)
    )
    created = unique_email("created")
    await client.post(
        "/admin/users",
        json={"name": "Nia New", "email": created, "password": "Welcome123", "role": "viewer"},
        headers=auth_headers(world.admin),
    )
    reset = await client.post("/auth/forgot-password", json={"email": world.member.email})

    await email_service.deliver_pending()

    [invite_mail] = mailer.to(invited)
    assert invitation.json()["invite_url"] in invite_mail.html
    assert "Accept invitation" in invite_mail.html
    [account_mail] = mailer.to(created)
    assert "Welcome123" not in account_mail.html + account_mail.text
    assert "/login" in account_mail.html
    [reset_mail] = mailer.to(world.member.email)
    assert reset.json()["reset_url"] in reset_mail.html


async def test_daily_digest_lists_overdue_and_due_soon_once_per_day(
    client: AsyncClient, world: World, mailer: FakeMailer, monkeypatch: pytest.MonkeyPatch
) -> None:
    project = await create_project_with_members(client, world)
    soon = (utcnow() + timedelta(days=1)).date().isoformat()
    await api_create_task(
        client,
        world.manager,
        project["id"],
        title="Old one",
        due_date="2020-01-01",
        assignee_id=str(world.member.pk),
    )
    await api_create_task(
        client,
        world.manager,
        project["id"],
        title="Soon one",
        due_date=soon,
        assignee_id=str(world.member.pk),
    )
    await client.put(
        "/users/me/email-preferences",
        json={
            "assigned": False,
            "mentioned": True,
            "overdue": True,
            "comments": False,
            "status_changes": False,
            "daily_digest": True,
        },
        headers=auth_headers(world.member),
    )
    morning = utcnow().replace(hour=10, minute=0)
    with monkeypatch.context() as patched:
        patched.setattr(email_service, "utcnow", lambda: morning)
        first = await email_service.send_daily_digests()
        second = await email_service.send_daily_digests()
    await email_service.deliver_pending()

    assert first >= 1 and second == 0
    [digest] = [m for m in mailer.to(world.member.email) if "due today" in m.subject]
    assert "Old one" in digest.html and "Soon one" in digest.html
    assert "Overdue" in digest.text


async def test_no_digest_before_the_morning_window(
    client: AsyncClient, world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    world.member.email_preferences.daily_digest = True
    await world.member.save()
    early = utcnow().replace(hour=2)
    monkeypatch.setattr(email_service, "utcnow", lambda: early)

    assert await email_service.send_daily_digests() == 0


async def test_exclusive_jobs_do_not_run_twice_at_once() -> None:
    async def inner() -> str:
        return str(await run_exclusive("same-job", 60, lambda: _value("blocked")))

    async def _value(text: str) -> str:
        return text

    result = await run_exclusive("same-job", 60, inner)

    assert result == "None"
    assert await run_exclusive("same-job", 60, lambda: _value("free")) == "free"


def test_text_fallback_strips_markup_and_keeps_links() -> None:
    text = to_text('<p>Hello <b>there</b></p><a href="https://x.test/a">Open</a><style>p{}</style>')

    assert "<" not in text and "p{}" not in text
    assert "Hello there" in text
    assert "Open (https://x.test/a)" in text


def test_every_template_renders_with_subject_and_text() -> None:
    contexts: dict[str, dict[str, Any]] = {
        "verification": {"name": "Eve", "code": "123456", "minutes": 10},
        "password_reset": {"name": "Eve", "url": "https://x.test/r", "hours": 1},
        "invitation": {
            "workspace": "Acme",
            "inviter": "Ada",
            "role": "Member",
            "url": "https://x.test/i",
            "days": 7,
        },
        "account_created": {
            "name": "Eve",
            "workspace": "Acme",
            "creator": "Ada",
            "role": "Member",
            "url": "https://x.test",
        },
        "issue_notification": {
            "headline": "Ada assigned you an issue.",
            "issue_type": "Bug",
            "key": "WEB-1",
            "project": "Web",
            "title": "Crash",
            "priority": "High",
            "due": "2026-01-01",
            "status": "To Do",
            "url": "https://x.test/browse/WEB-1",
            "settings_url": "https://x.test/profile",
        },
        "digest": {
            "name": "Eve",
            "sections": [
                {
                    "title": "Overdue",
                    "entries": [
                        {
                            "key": "WEB-1",
                            "title": "Crash",
                            "project": "Web",
                            "due": "2020-01-01",
                            "url": "https://x.test",
                        }
                    ],
                }
            ],
            "url": "https://x.test",
            "settings_url": "https://x.test/profile",
        },
    }

    for name, context in contexts.items():
        html, text = render(name, "Subject", "Preview", **context)
        assert "TeamFlow" in html and text, name
        assert "{{" not in html and "{%" not in html, name


async def test_outbox_rows_keep_the_recipient_and_category(
    client: AsyncClient, mailer: FakeMailer
) -> None:
    email = unique_email("rows")
    await register(client, email)

    [row] = await EmailOutbox.find({"to_address": email}).to_list()

    assert row.category == "verification"
    assert row.status == EmailStatus.PENDING
