from httpx import AsyncClient

from app.permissions.roles import Role
from tests.factories import (
    DEFAULT_PASSWORD,
    World,
    api_add_member,
    api_create_project,
    api_create_task,
    auth_headers,
    create_user,
    create_world,
)

ADMIN_ROUTES = [
    ("get", "/admin/stats"),
    ("get", "/admin/users"),
]


async def test_admin_endpoints_reject_non_super_admins(client: AsyncClient, world: World) -> None:
    for user in (world.manager, world.member, world.viewer):
        headers = auth_headers(user)
        for method, path in ADMIN_ROUTES:
            assert (await client.request(method, path, headers=headers)).status_code == 403
        target = f"/admin/users/{world.member.pk}"
        assert (await client.get(target, headers=headers)).status_code == 403
        assert (
            await client.patch(f"{target}/role", json={"role": "viewer"}, headers=headers)
        ).status_code == 403
        assert (
            await client.patch(f"{target}/status", json={"is_active": False}, headers=headers)
        ).status_code == 403


async def test_stats_reflect_workspace(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)
    await api_create_task(client, world.manager, project["id"])

    response = await client.get("/admin/stats", headers=auth_headers(world.admin))

    body = response.json()
    assert body["total_users"] == 5
    assert body["active_users"] == 5
    assert body["users_by_role"]["member"] == 2
    assert body["total_projects"] == 1
    assert body["total_tasks"] == 1


async def test_change_role_is_persisted_and_applies_to_next_request(
    client: AsyncClient, world: World
) -> None:
    before = await client.get("/projects", headers=auth_headers(world.member))
    response = await client.patch(
        f"/admin/users/{world.member.pk}/role",
        json={"role": "project_manager"},
        headers=auth_headers(world.admin),
    )
    created = await client.post(
        "/projects", json={"name": "Now allowed", "key": "NOW"}, headers=auth_headers(world.member)
    )

    assert before.status_code == 200
    assert response.status_code == 200
    assert response.json()["role"] == "project_manager"
    assert created.status_code == 201


async def test_cannot_demote_or_deactivate_last_super_admin(
    client: AsyncClient, world: World
) -> None:
    demote = await client.patch(
        f"/admin/users/{world.admin.pk}/role",
        json={"role": "member"},
        headers=auth_headers(world.admin),
    )
    deactivate = await client.patch(
        f"/admin/users/{world.admin.pk}/status",
        json={"is_active": False},
        headers=auth_headers(world.admin),
    )

    assert demote.status_code == 409
    assert demote.json()["code"] == "last_super_admin"
    assert deactivate.status_code == 409


async def test_super_admin_cannot_deactivate_self_even_with_another_admin(
    client: AsyncClient, world: World
) -> None:
    await create_user(world.workspace, Role.SUPER_ADMIN)

    response = await client.patch(
        f"/admin/users/{world.admin.pk}/status",
        json={"is_active": False},
        headers=auth_headers(world.admin),
    )

    assert response.status_code == 409
    assert response.json()["code"] == "cannot_deactivate_self"


async def test_demoting_one_of_two_super_admins_is_allowed(
    client: AsyncClient, world: World
) -> None:
    second = await create_user(world.workspace, Role.SUPER_ADMIN)

    response = await client.patch(
        f"/admin/users/{second.pk}/role",
        json={"role": "member"},
        headers=auth_headers(world.admin),
    )

    assert response.status_code == 200


async def test_deactivated_user_loses_access_immediately_and_data_remains(
    client: AsyncClient, world: World
) -> None:
    project = await api_create_project(client, world.manager)
    await api_add_member(client, world.manager, project["id"], world.member)
    task = await api_create_task(client, world.member, project["id"])
    member_headers = auth_headers(world.member)

    response = await client.patch(
        f"/admin/users/{world.member.pk}/status",
        json={"is_active": False},
        headers=auth_headers(world.admin),
    )
    rejected = await client.get("/auth/me", headers=member_headers)
    login = await client.post(
        "/auth/login", json={"email": world.member.email, "password": DEFAULT_PASSWORD}
    )
    fetched = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.manager))

    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert rejected.status_code == 401
    assert login.status_code == 403
    assert fetched.json()["creator"]["is_active"] is False


async def test_reactivated_user_can_log_in_again(client: AsyncClient, world: World) -> None:
    url = f"/admin/users/{world.member.pk}/status"
    await client.patch(url, json={"is_active": False}, headers=auth_headers(world.admin))

    await client.patch(url, json={"is_active": True}, headers=auth_headers(world.admin))
    login = await client.post(
        "/auth/login", json={"email": world.member.email, "password": DEFAULT_PASSWORD}
    )

    assert login.status_code == 200


async def test_set_and_remove_project_override_changes_effective_role_only_there(
    client: AsyncClient, world: World
) -> None:
    project = await api_create_project(client, world.manager)
    other = await api_create_project(client, world.manager, name="Other")
    await api_add_member(client, world.manager, project["id"], world.member)
    await api_add_member(client, world.manager, other["id"], world.member)
    url = f"/admin/users/{world.member.pk}/projects/{project['id']}"

    set_response = await client.put(
        url, json={"role_override": "viewer"}, headers=auth_headers(world.admin)
    )
    blocked = await client.post(
        f"/projects/{project['id']}/tasks", json={"title": "x"}, headers=auth_headers(world.member)
    )
    still_allowed = await client.post(
        f"/projects/{other['id']}/tasks", json={"title": "x"}, headers=auth_headers(world.member)
    )
    cleared = await client.put(url, json={"role_override": None}, headers=auth_headers(world.admin))
    restored = await client.post(
        f"/projects/{project['id']}/tasks", json={"title": "x"}, headers=auth_headers(world.member)
    )

    row = next(p for p in set_response.json()["projects"] if p["project_id"] == project["id"])
    assert row["role_override"] == "viewer"
    assert row["effective_role"] == "viewer"
    assert blocked.status_code == 403
    assert still_allowed.status_code == 201
    assert cleared.json()["projects"][0]["role_override"] is None
    assert restored.status_code == 201


async def test_override_can_add_user_to_project_and_remove_membership(
    client: AsyncClient, world: World
) -> None:
    project = await api_create_project(client, world.manager)
    url = f"/admin/users/{world.viewer.pk}/projects/{project['id']}"

    added = await client.put(url, json={}, headers=auth_headers(world.admin))
    visible = await client.get(f"/projects/{project['id']}", headers=auth_headers(world.viewer))
    removed = await client.delete(url, headers=auth_headers(world.admin))
    hidden = await client.get(f"/projects/{project['id']}", headers=auth_headers(world.viewer))

    assert added.status_code == 200
    assert visible.status_code == 200
    assert removed.status_code == 200
    assert hidden.status_code == 404


async def test_super_admin_role_cannot_be_overridden(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)

    response = await client.put(
        f"/admin/users/{world.admin.pk}/projects/{project['id']}",
        json={"role_override": "viewer"},
        headers=auth_headers(world.admin),
    )

    assert response.status_code == 422


async def test_user_list_search_filters_and_pagination(client: AsyncClient, world: World) -> None:
    headers = auth_headers(world.admin)
    world.viewer.is_active = False
    await world.viewer.save()

    by_name = await client.get("/admin/users?q=maya", headers=headers)
    by_role = await client.get("/admin/users?role=member", headers=headers)
    by_status = await client.get("/admin/users?is_active=false", headers=headers)
    paged = await client.get("/admin/users?page=2&page_size=2", headers=headers)

    assert [u["name"] for u in by_name.json()["items"]] == ["Maya Manager"]
    assert by_role.json()["total"] == 2
    assert all(u["role"] == "member" for u in by_role.json()["items"])
    assert [u["name"] for u in by_status.json()["items"]] == ["Vera Viewer"]
    assert paged.json()["total"] == 5
    assert len(paged.json()["items"]) == 2
    assert paged.json()["page"] == 2


async def test_user_detail_lists_projects(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)

    response = await client.get(
        f"/admin/users/{world.manager.pk}", headers=auth_headers(world.admin)
    )

    assert response.json()["projects"][0]["project_id"] == project["id"]
    assert response.json()["project_count"] == 1


async def test_admin_cannot_touch_users_of_other_workspaces(
    client: AsyncClient, world: World
) -> None:
    foreign_user = (await create_world()).member

    response = await client.get(
        f"/admin/users/{foreign_user.pk}", headers=auth_headers(world.admin)
    )

    assert response.status_code == 404
