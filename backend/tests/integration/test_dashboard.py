from datetime import timedelta
from typing import Any

from httpx import AsyncClient

from app.utils.time import utcnow
from tests.factories import (
    DEFAULT_PASSWORD,
    World,
    api_add_member,
    api_create_project,
    api_create_task,
    auth_headers,
)


def iso(offset_days: int) -> str:
    return str(utcnow().date() + timedelta(days=offset_days))


async def setup_project(client: AsyncClient, world: World) -> dict[str, Any]:
    project = await api_create_project(client, world.manager)
    for user in (world.member, world.viewer):
        await api_add_member(client, world.manager, project["id"], user)
    return project


def done_status(project: dict[str, Any]) -> str:
    return str(next(s["id"] for s in project["statuses"] if s["is_done"]))


async def test_dashboard_counts_match_seeded_data(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    pid = project["id"]
    me = str(world.member.pk)
    today = utcnow().date()
    week_end = today + timedelta(days=6 - today.weekday())
    inside_week = min(week_end, today + timedelta(days=1))
    await api_create_task(
        client, world.manager, pid, title="Late", assignee_id=me, due_date=iso(-3)
    )
    await api_create_task(
        client, world.manager, pid, title="Soon", assignee_id=me, due_date=str(inside_week)
    )
    await api_create_task(
        client, world.manager, pid, title="Later", assignee_id=me, due_date=iso(30)
    )
    await api_create_task(client, world.manager, pid, title="No date", assignee_id=me)
    finished = await api_create_task(client, world.manager, pid, title="Done", assignee_id=me)
    await client.patch(
        f"/tasks/{finished['id']}/move",
        json={"status_id": done_status(project)},
        headers=auth_headers(world.manager),
    )
    await api_create_task(client, world.manager, pid, title="Not mine")

    response = await client.get("/dashboard/me", headers=auth_headers(world.member))

    body = response.json()
    assert body["stats"] == {
        "assigned_open": 4,
        "overdue": 1,
        "due_this_week": 1 if inside_week >= today else 0,
        "completed_this_week": 1,
    }
    assert [t["title"] for t in body["my_tasks"]] == ["Late", "Soon", "Later", "No date"]
    assert body["my_tasks"][0]["is_overdue"] is True
    assert body["projects"][0]["total_tasks"] == 6
    assert body["projects"][0]["done_tasks"] == 1
    assert body["projects"][0]["progress_percent"] == 17


async def test_dashboard_only_includes_visible_projects(client: AsyncClient, world: World) -> None:
    visible = await setup_project(client, world)
    hidden = await api_create_project(client, world.manager, name="Hidden")
    await api_add_member(client, world.manager, hidden["id"], world.viewer)
    await api_create_task(
        client, world.manager, visible["id"], title="Seen", assignee_id=str(world.viewer.pk)
    )
    await api_create_task(
        client, world.manager, hidden["id"], title="Unseen", assignee_id=str(world.viewer.pk)
    )
    await client.delete(
        f"/projects/{hidden['id']}/members/{world.viewer.pk}", headers=auth_headers(world.manager)
    )

    response = await client.get("/dashboard/me", headers=auth_headers(world.viewer))

    assert [t["title"] for t in response.json()["my_tasks"]] == ["Seen"]
    assert [p["id"] for p in response.json()["projects"]] == [visible["id"]]


async def test_empty_dashboard(client: AsyncClient, world: World) -> None:
    response = await client.get("/dashboard/me", headers=auth_headers(world.other_member))

    body = response.json()
    assert body["stats"] == {
        "assigned_open": 0,
        "overdue": 0,
        "due_this_week": 0,
        "completed_this_week": 0,
    }
    assert body["my_tasks"] == []
    assert body["projects"] == []
    assert body["charts"]["by_status"] == []
    assert len(body["charts"]["completed_per_day"]) == 14
    assert body["charts"]["minutes_logged_week"] == 0


async def test_update_profile(client: AsyncClient, world: World) -> None:
    response = await client.patch(
        "/users/me", json={"name": "  Marcus  "}, headers=auth_headers(world.member)
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Marcus"


async def test_change_password_wrong_current_is_400(client: AsyncClient, world: World) -> None:
    response = await client.post(
        "/users/me/password",
        json={"current_password": "WrongPass1", "new_password": "BrandNew123"},
        headers=auth_headers(world.member),
    )

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_current_password"


async def test_change_password_rotates_credentials_and_logs_out_other_sessions(
    client: AsyncClient, world: World
) -> None:
    old_headers = auth_headers(world.member)
    login = await client.post(
        "/auth/login", json={"email": world.member.email, "password": DEFAULT_PASSWORD}
    )
    other_session_cookie = client.cookies.get("refresh_token")

    changed = await client.post(
        "/users/me/password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": "BrandNew123"},
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    old_login = await client.post(
        "/auth/login", json={"email": world.member.email, "password": DEFAULT_PASSWORD}
    )
    new_login = await client.post(
        "/auth/login", json={"email": world.member.email, "password": "BrandNew123"}
    )
    client.cookies.set("refresh_token", str(other_session_cookie), path="/api/v1/auth")
    stale_refresh = await client.post("/auth/refresh")
    stale_access = await client.get("/auth/me", headers=old_headers)
    fresh_access = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {changed.json()['access_token']}"}
    )

    assert changed.status_code == 200
    assert old_login.status_code == 401
    assert new_login.status_code == 200
    assert stale_refresh.status_code == 401
    assert stale_access.status_code == 401
    assert fresh_access.status_code == 200
    client.cookies.clear()


async def test_new_password_must_be_strong(client: AsyncClient, world: World) -> None:
    response = await client.post(
        "/users/me/password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": "weak"},
        headers=auth_headers(world.member),
    )

    assert response.status_code == 422
