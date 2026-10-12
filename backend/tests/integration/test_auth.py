from datetime import timedelta

import pytest
from httpx import AsyncClient, Response

from app.core.security import create_access_token
from app.models.user import User
from app.models.workspace_member import WorkspaceMember
from app.permissions.roles import Role
from tests.factories import DEFAULT_PASSWORD, World, auth_headers, unique_email

REGISTER = {"name": "Ada Lovelace", "password": DEFAULT_PASSWORD}


async def register(
    client: AsyncClient, email: object | None = None, **overrides: object
) -> Response:
    return await client.post(
        "/auth/register", json={**REGISTER, "email": email or unique_email(), **overrides}
    )


async def register_verified(client: AsyncClient, email: str | None = None) -> Response:
    address = email or unique_email()
    registered = await register(client, address)
    return await client.post(
        "/auth/verify-email", json={"email": address, "code": registered.json()["dev_code"]}
    )


async def test_register_creates_unverified_user_and_super_admin_membership(
    client: AsyncClient,
) -> None:
    email = unique_email("ada")
    response = await register(client, email.upper())

    assert response.status_code == 201
    body = response.json()
    assert body["verification_required"] is True
    assert body["email"] == email
    assert len(body["dev_code"]) == 6
    assert "access_token" not in body
    assert "set-cookie" not in response.headers
    user = await User.find_one({"email": email})
    assert user is not None and user.email_verified is False
    membership = await WorkspaceMember.find_one({"user_id": user.pk})
    assert membership is not None and membership.role == Role.SUPER_ADMIN


async def test_verifying_the_code_signs_the_user_in(client: AsyncClient) -> None:
    response = await register_verified(client)

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "super_admin"
    assert body["user"]["email_verified"] is True
    assert body["access_token"]
    assert "httponly" in response.headers["set-cookie"].lower()
    client.cookies.clear()


async def test_register_duplicate_email_is_case_insensitive(client: AsyncClient) -> None:
    email = unique_email("dup")
    await register(client, email)

    response = await register(client, email.upper())

    assert response.status_code == 409
    assert response.json()["code"] == "email_taken"


@pytest.mark.parametrize("password", ["short1", "allletters", "12345678"])
async def test_register_rejects_weak_password(client: AsyncClient, password: str) -> None:
    response = await register(client, password=password)

    assert response.status_code == 422
    assert "password" in response.json()["details"]


async def test_register_rejects_operator_injection_and_unknown_fields(client: AsyncClient) -> None:
    injected = await register(client, email={"$ne": ""})
    extra = await register(client, role="super_admin")

    assert injected.status_code == 422
    assert extra.status_code == 422


async def test_password_is_stored_as_argon2_hash(client: AsyncClient) -> None:
    email = unique_email("hash")
    await register(client, email)

    user = await User.find_one({"email": email})

    assert user is not None
    assert user.password_hash.startswith("$argon2")
    assert DEFAULT_PASSWORD not in user.password_hash


async def test_login_success(client: AsyncClient) -> None:
    email = unique_email("login")
    await register_verified(client, email)
    client.cookies.clear()

    response = await client.post("/auth/login", json={"email": email, "password": DEFAULT_PASSWORD})

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert "refresh_token" in response.cookies


async def test_login_failures_share_one_generic_message(client: AsyncClient) -> None:
    email = unique_email("generic")
    await register(client, email)

    wrong_password = await client.post("/auth/login", json={"email": email, "password": "Nope1234"})
    unknown_email = await client.post(
        "/auth/login", json={"email": unique_email("ghost"), "password": "Nope1234"}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


async def test_login_is_blocked_until_the_email_is_verified(client: AsyncClient) -> None:
    email = unique_email("pending")
    await register(client, email)

    response = await client.post("/auth/login", json={"email": email, "password": DEFAULT_PASSWORD})

    assert response.status_code == 403
    assert response.json()["code"] == "email_not_verified"


async def test_login_deactivated_user_is_forbidden(client: AsyncClient, world: World) -> None:
    world.member.is_active = False
    await world.member.save()

    response = await client.post(
        "/auth/login", json={"email": world.member.email, "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 403
    assert response.json()["code"] == "account_deactivated"


async def test_refresh_rotates_and_rejects_reuse(client: AsyncClient) -> None:
    await register_verified(client)
    old_cookie = client.cookies.get("refresh_token")

    first = await client.post("/auth/refresh")
    new_cookie = client.cookies.get("refresh_token")
    client.cookies.set("refresh_token", str(old_cookie), path="/api/v1/auth")
    reused = await client.post("/auth/refresh")

    assert first.status_code == 200
    assert first.json()["access_token"]
    assert new_cookie != old_cookie
    assert reused.status_code == 401
    assert reused.json()["code"] == "invalid_refresh_token"
    client.cookies.clear()


async def test_refresh_without_cookie_is_unauthorized(client: AsyncClient) -> None:
    client.cookies.clear()

    response = await client.post("/auth/refresh")

    assert response.status_code == 401


async def test_protected_endpoint_requires_valid_token(client: AsyncClient, world: World) -> None:
    expired = create_access_token(
        str(world.member.pk), world.member.token_version, timedelta(seconds=-5)
    )

    missing = await client.get("/auth/me")
    garbage = await client.get("/auth/me", headers={"Authorization": "Bearer nonsense"})
    stale = await client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})

    assert missing.status_code == garbage.status_code == stale.status_code == 401
    assert stale.json()["code"] == "token_expired"


async def test_me_returns_user_workspace_and_role(client: AsyncClient, world: World) -> None:
    response = await client.get("/auth/me", headers=auth_headers(world.manager))

    assert response.status_code == 200
    assert response.json()["role"] == "project_manager"
    assert response.json()["workspace"]["name"] == "Acme"


async def test_logout_revokes_refresh_token(client: AsyncClient) -> None:
    registered = await register_verified(client)
    token = registered.json()["access_token"]
    cookie = client.cookies.get("refresh_token")

    response = await client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    client.cookies.set("refresh_token", str(cookie), path="/api/v1/auth")
    refreshed = await client.post("/auth/refresh")

    assert response.status_code == 204
    assert refreshed.status_code == 401
    client.cookies.clear()


async def test_token_with_outdated_version_is_rejected(client: AsyncClient, world: World) -> None:
    headers = auth_headers(world.member)
    world.member.token_version += 1
    await world.member.save()

    response = await client.get("/auth/me", headers=headers)

    assert response.status_code == 401


async def test_login_is_rate_limited(client: AsyncClient, rate_limited: None) -> None:
    payload = {"email": unique_email("rl"), "password": "Whatever1"}

    statuses = [(await client.post("/auth/login", json=payload)).status_code for _ in range(11)]

    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429
