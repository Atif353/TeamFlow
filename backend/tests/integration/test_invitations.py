from datetime import timedelta
from typing import Any, cast

from httpx import AsyncClient

from app.core.security import hash_token
from app.models.invitation import Invitation
from app.models.user import User
from app.models.workspace_member import WorkspaceMember
from app.permissions.roles import Role
from app.utils.time import utcnow
from tests.factories import World, auth_headers, unique_email

ACCEPT = {"name": "Nina Newcomer", "password": "Password1"}


async def invite(
    client: AsyncClient, world: World, role: str = "member", email: str | None = None
) -> dict[str, Any]:
    response = await client.post(
        "/invitations",
        json={"email": email or unique_email("invitee"), "role": role},
        headers=auth_headers(world.admin),
    )
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json())


def token_of(created: dict[str, Any]) -> str:
    return str(created["invite_url"]).rsplit("/", 1)[1]


async def test_non_admin_cannot_create_invitation(client: AsyncClient, world: World) -> None:
    for user in (world.manager, world.member, world.viewer):
        response = await client.post(
            "/invitations",
            json={"email": unique_email(), "role": "member"},
            headers=auth_headers(user),
        )
        assert response.status_code == 403


async def test_invite_existing_account_is_conflict(client: AsyncClient, world: World) -> None:
    response = await client.post(
        "/invitations",
        json={"email": world.member.email, "role": "member"},
        headers=auth_headers(world.admin),
    )

    assert response.status_code == 409
    assert response.json()["code"] == "email_taken"


async def test_accept_creates_user_with_invited_role_and_token_is_single_use(
    client: AsyncClient, world: World
) -> None:
    created = await invite(client, world, "viewer")
    token = token_of(created)

    preview = await client.get(f"/invitations/preview/{token}")
    accepted = await client.post(f"/invitations/accept/{token}", json=ACCEPT)
    reused = await client.post(f"/invitations/accept/{token}", json=ACCEPT)

    assert preview.status_code == 200
    assert preview.json()["workspace_name"] == "Acme"
    assert preview.json()["role"] == "viewer"
    assert accepted.status_code == 201
    assert accepted.json()["role"] == "viewer"
    assert accepted.json()["access_token"]
    user = await User.find_one({"email": created["email"]})
    assert user is not None
    membership = await WorkspaceMember.find_one({"user_id": user.pk})
    assert membership is not None
    assert membership.role == Role.VIEWER
    assert membership.workspace_id == world.workspace.pk
    assert reused.status_code == 410


async def test_expired_and_revoked_tokens_are_gone(client: AsyncClient, world: World) -> None:
    expired = await invite(client, world)
    invitation = await Invitation.find_one({"token_hash": hash_token(token_of(expired))})
    assert invitation is not None
    invitation.expires_at = utcnow() - timedelta(minutes=1)
    await invitation.save()
    revoked = await invite(client, world)
    revoke = await client.delete(f"/invitations/{revoked['id']}", headers=auth_headers(world.admin))

    expired_response = await client.post(f"/invitations/accept/{token_of(expired)}", json=ACCEPT)
    revoked_response = await client.post(f"/invitations/accept/{token_of(revoked)}", json=ACCEPT)
    preview = await client.get(f"/invitations/preview/{token_of(expired)}")

    assert revoke.status_code == 204
    assert expired_response.status_code == 410
    assert revoked_response.status_code == 410
    assert preview.status_code == 410


async def test_unknown_token_is_not_found(client: AsyncClient) -> None:
    response = await client.get("/invitations/preview/does-not-exist")

    assert response.status_code == 404


async def test_only_token_hash_is_stored(client: AsyncClient, world: World) -> None:
    created = await invite(client, world)
    token = token_of(created)

    invitation = await Invitation.find_one({"token_hash": hash_token(token)})

    assert invitation is not None
    assert token not in invitation.model_dump_json()


async def test_resend_revokes_previous_pending_invitation(
    client: AsyncClient, world: World
) -> None:
    email = unique_email("again")
    first = await invite(client, world, email=email)
    second = await invite(client, world, email=email)

    old = await client.get(f"/invitations/preview/{token_of(first)}")
    new = await client.get(f"/invitations/preview/{token_of(second)}")
    listing = await client.get("/invitations?status=pending", headers=auth_headers(world.admin))

    assert old.status_code == 410
    assert new.status_code == 200
    assert [item["email"] for item in listing.json()["items"]].count(email) == 1


async def test_list_invitations_reports_effective_status(client: AsyncClient, world: World) -> None:
    created = await invite(client, world)
    invitation = await Invitation.find_one({"token_hash": hash_token(token_of(created))})
    assert invitation is not None
    invitation.expires_at = utcnow() - timedelta(days=1)
    await invitation.save()

    response = await client.get("/invitations?status=expired", headers=auth_headers(world.admin))

    ids = [item["id"] for item in response.json()["items"]]
    assert created["id"] in ids
    assert all(item["status"] == "expired" for item in response.json()["items"])


async def test_cannot_revoke_non_pending_invitation(client: AsyncClient, world: World) -> None:
    created = await invite(client, world)
    await client.post(f"/invitations/accept/{token_of(created)}", json=ACCEPT)

    response = await client.delete(
        f"/invitations/{created['id']}", headers=auth_headers(world.admin)
    )

    assert response.status_code == 409
