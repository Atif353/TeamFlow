import uuid
from dataclasses import dataclass
from typing import Any, cast

from httpx import AsyncClient

from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember
from app.permissions.roles import Role
from app.utils.avatar import avatar_color_for

DEFAULT_PASSWORD = "Password1"
_PASSWORD_HASH = hash_password(DEFAULT_PASSWORD)


def unique_email(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@teamflow.io"


async def create_user(
    workspace: Workspace,
    role: Role,
    name: str | None = None,
    email: str | None = None,
    is_active: bool = True,
) -> User:
    address = email or unique_email(role.value)
    user = User(
        name=name or f"{role.value.title()} {uuid.uuid4().hex[:4]}",
        email=address,
        password_hash=_PASSWORD_HASH,
        avatar_color=avatar_color_for(address),
        is_active=is_active,
    )
    await user.insert()
    await WorkspaceMember(workspace_id=workspace.pk, user_id=user.pk, role=role).insert()
    return user


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.pk), user.token_version)}"}


@dataclass
class World:
    workspace: Workspace
    admin: User
    manager: User
    member: User
    viewer: User
    other_member: User

    def headers(self, user: User) -> dict[str, str]:
        return auth_headers(user)


async def create_world() -> World:
    owner_placeholder = User(
        name="Placeholder",
        email=unique_email("owner"),
        password_hash=_PASSWORD_HASH,
        avatar_color="#6366F1",
    )
    await owner_placeholder.insert()
    workspace = Workspace(name="Acme", owner_id=owner_placeholder.pk)
    await workspace.insert()
    await WorkspaceMember(
        workspace_id=workspace.pk, user_id=owner_placeholder.pk, role=Role.SUPER_ADMIN
    ).insert()
    return World(
        workspace=workspace,
        admin=owner_placeholder,
        manager=await create_user(workspace, Role.PROJECT_MANAGER, "Maya Manager"),
        member=await create_user(workspace, Role.MEMBER, "Mark Member"),
        viewer=await create_user(workspace, Role.VIEWER, "Vera Viewer"),
        other_member=await create_user(workspace, Role.MEMBER, "Omar Other"),
    )


async def api_create_project(
    client: AsyncClient, user: User, key: str | None = None, name: str = "Apollo"
) -> dict[str, Any]:
    response = await client.post(
        "/projects",
        json={"name": name, "key": key or f"P{uuid.uuid4().hex[:6]}"},
        headers=auth_headers(user),
    )
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json())


async def api_add_member(
    client: AsyncClient,
    actor: User,
    project_id: str,
    user: User,
    role_override: Role | None = None,
) -> None:
    payload: dict[str, Any] = {"user_id": str(user.pk)}
    if role_override:
        payload["role_override"] = role_override.value
    response = await client.post(
        f"/projects/{project_id}/members", json=payload, headers=auth_headers(actor)
    )
    assert response.status_code == 201, response.text


async def api_create_task(
    client: AsyncClient, user: User, project_id: str, **fields: Any
) -> dict[str, Any]:
    payload = {"title": "Write specs", **fields}
    response = await client.post(
        f"/projects/{project_id}/tasks", json=payload, headers=auth_headers(user)
    )
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json())
