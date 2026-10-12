from httpx import AsyncClient

from tests.factories import DEFAULT_PASSWORD, World, api_create_project, auth_headers, unique_email


async def test_super_admin_creates_user_who_can_log_in(client: AsyncClient, world: World) -> None:
    email = unique_email("newhire")

    created = await client.post(
        "/admin/users",
        json={"name": "New Hire", "email": email, "password": "Welcome123", "role": "member"},
        headers=auth_headers(world.admin),
    )
    login = await client.post("/auth/login", json={"email": email, "password": "Welcome123"})

    assert created.status_code == 201
    assert created.json()["role"] == "member"
    assert login.status_code == 200
    assert login.json()["role"] == "member"


async def test_create_user_rejects_duplicates_and_weak_passwords(
    client: AsyncClient, world: World
) -> None:
    duplicate = await client.post(
        "/admin/users",
        json={
            "name": "Dup",
            "email": world.member.email.upper(),
            "password": "Welcome123",
            "role": "viewer",
        },
        headers=auth_headers(world.admin),
    )
    weak = await client.post(
        "/admin/users",
        json={"name": "Weak", "email": unique_email(), "password": "short", "role": "viewer"},
        headers=auth_headers(world.admin),
    )

    assert duplicate.status_code == 409
    assert weak.status_code == 422


async def test_only_super_admin_can_manage_users(client: AsyncClient, world: World) -> None:
    payload = {"name": "X", "email": unique_email(), "password": "Welcome123", "role": "viewer"}

    manager = await client.post("/admin/users", json=payload, headers=auth_headers(world.manager))
    member_edit = await client.patch(
        f"/admin/users/{world.viewer.pk}", json={"name": "Hax"}, headers=auth_headers(world.member)
    )

    assert manager.status_code == 403
    assert member_edit.status_code == 403


async def test_super_admin_edits_name_and_email(client: AsyncClient, world: World) -> None:
    new_email = unique_email("renamed")

    response = await client.patch(
        f"/admin/users/{world.member.pk}",
        json={"name": "Marcus Member", "email": new_email},
        headers=auth_headers(world.admin),
    )
    taken = await client.patch(
        f"/admin/users/{world.member.pk}",
        json={"email": world.viewer.email},
        headers=auth_headers(world.admin),
    )

    assert response.json()["name"] == "Marcus Member"
    assert response.json()["email"] == new_email
    assert taken.status_code == 409


async def test_admin_password_reset_revokes_sessions(client: AsyncClient, world: World) -> None:
    old_token_headers = auth_headers(world.member)

    reset = await client.post(
        f"/admin/users/{world.member.pk}/password",
        json={"password": "Brandnew123"},
        headers=auth_headers(world.admin),
    )
    stale = await client.get("/auth/me", headers=old_token_headers)
    login = await client.post(
        "/auth/login", json={"email": world.member.email, "password": "Brandnew123"}
    )
    old_login = await client.post(
        "/auth/login", json={"email": world.member.email, "password": DEFAULT_PASSWORD}
    )

    assert reset.status_code == 200
    assert stale.status_code == 401
    assert login.status_code == 200
    assert old_login.status_code == 401


async def test_audit_log_records_admin_actions(client: AsyncClient, world: World) -> None:
    await client.patch(
        f"/admin/users/{world.member.pk}/role",
        json={"role": "viewer"},
        headers=auth_headers(world.admin),
    )
    await client.patch(
        f"/admin/users/{world.viewer.pk}/status",
        json={"is_active": False},
        headers=auth_headers(world.admin),
    )
    project = await api_create_project(client, world.manager)
    await client.delete(f"/projects/{project['id']}", headers=auth_headers(world.manager))

    everything = await client.get(
        "/admin/audit-logs?page_size=100", headers=auth_headers(world.admin)
    )
    only_roles = await client.get(
        "/admin/audit-logs?action=role_changed", headers=auth_headers(world.admin)
    )
    actions = await client.get("/admin/audit-logs/actions", headers=auth_headers(world.admin))
    forbidden = await client.get("/admin/audit-logs", headers=auth_headers(world.manager))

    recorded = {item["action"] for item in everything.json()["items"]}
    assert {"role_changed", "user_deactivated", "project_created", "project_deleted"} <= recorded
    assert all(item["action"] == "role_changed" for item in only_roles.json()["items"])
    assert only_roles.json()["items"][0]["actor"]["name"] == world.admin.name
    assert "role_changed" in actions.json()["actions"]
    assert forbidden.status_code == 403


async def test_admin_analytics_shape(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)
    await client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Counted", "issue_type": "bug"},
        headers=auth_headers(world.manager),
    )

    response = await client.get("/admin/analytics", headers=auth_headers(world.admin))
    forbidden = await client.get("/admin/analytics", headers=auth_headers(world.member))

    body = response.json()
    assert any(row["project_id"] == project["id"] and row["total"] == 1 for row in body["projects"])
    assert any(item["key"] == "bug" for item in body["type_counts"])
    assert len(body["created_vs_resolved"]) == 30
    assert len(body["signups"]) == 30
    assert {row["user"]["name"] for row in body["team"]} >= {world.member.name, world.manager.name}
    assert body["total_open"] == 1
    assert forbidden.status_code == 403


async def test_forgot_and_reset_password_flow(client: AsyncClient, world: World) -> None:
    requested = await client.post("/auth/forgot-password", json={"email": world.member.email})
    token = requested.json()["reset_url"].rsplit("/", 1)[1]

    reset = await client.post(
        "/auth/reset-password", json={"token": token, "password": "Reset12345"}
    )
    reuse = await client.post(
        "/auth/reset-password", json={"token": token, "password": "Another1234"}
    )
    login = await client.post(
        "/auth/login", json={"email": world.member.email, "password": "Reset12345"}
    )

    assert requested.status_code == 200
    assert reset.status_code == 204
    assert reuse.status_code == 410
    assert login.status_code == 200


async def test_forgot_password_does_not_reveal_unknown_emails(
    client: AsyncClient, world: World
) -> None:
    unknown = await client.post("/auth/forgot-password", json={"email": unique_email("ghost")})
    known = await client.post("/auth/forgot-password", json={"email": world.member.email})

    assert unknown.status_code == 200
    assert unknown.json()["message"] == known.json()["message"]
    assert unknown.json()["reset_url"] is None


async def test_reset_with_bad_token_is_rejected(client: AsyncClient, world: World) -> None:
    response = await client.post(
        "/auth/reset-password", json={"token": "x" * 40, "password": "Reset12345"}
    )

    assert response.status_code == 410
    assert response.json()["code"] == "reset_token_invalid"
