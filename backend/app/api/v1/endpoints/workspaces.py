from fastapi import APIRouter

from app.api.deps import CurrentAuth, ManagerAuth, SuperAdminAuth
from app.schemas.common import Page
from app.schemas.workspace import UpdateWorkspaceRequest, WorkspaceMemberOut, WorkspaceOut
from app.services import workspace_service
from app.utils.pagination import PageQuery

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("/current", response_model=WorkspaceOut)
async def get_current(auth: CurrentAuth) -> WorkspaceOut:
    return WorkspaceOut.from_workspace(await workspace_service.get_current(auth))


@router.patch("/current", response_model=WorkspaceOut)
async def rename_current(auth: SuperAdminAuth, data: UpdateWorkspaceRequest) -> WorkspaceOut:
    return WorkspaceOut.from_workspace(await workspace_service.rename(auth, data))


@router.get("/current/members", response_model=Page[WorkspaceMemberOut])
async def list_members(auth: ManagerAuth, params: PageQuery) -> Page[WorkspaceMemberOut]:
    return await workspace_service.list_members(auth, params, None)
