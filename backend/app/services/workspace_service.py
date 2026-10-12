from app.core.exceptions import NotFoundError
from app.models.workspace import Workspace
from app.permissions.context import AuthContext
from app.permissions.roles import Role
from app.repositories.user_repository import user_repository
from app.repositories.workspace_repository import workspace_repository
from app.schemas.common import Page
from app.schemas.workspace import UpdateWorkspaceRequest, WorkspaceMemberOut
from app.utils.pagination import PageParams


async def get_current(auth: AuthContext) -> Workspace:
    workspace = await workspace_repository.get(auth.workspace_id)
    if workspace is None:
        raise NotFoundError("Workspace not found", code="workspace_not_found")
    return workspace


async def rename(auth: AuthContext, data: UpdateWorkspaceRequest) -> Workspace:
    workspace = await get_current(auth)
    workspace.name = data.name
    return await workspace_repository.save(workspace)


async def list_members(
    auth: AuthContext, params: PageParams, roles: list[Role] | None
) -> Page[WorkspaceMemberOut]:
    memberships = await workspace_repository.list_members(
        auth.workspace_id, roles, params.skip, params.limit
    )
    total = await workspace_repository.count_members(auth.workspace_id, roles)
    users = {
        user.pk: user for user in await user_repository.find_by_ids(m.user_id for m in memberships)
    }
    items = [
        WorkspaceMemberOut(
            user_id=member.user_id,
            name=users[member.user_id].name,
            email=users[member.user_id].email,
            avatar_color=users[member.user_id].avatar_color,
            role=member.role,
            is_active=users[member.user_id].is_active,
        )
        for member in memberships
        if member.user_id in users
    ]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)
