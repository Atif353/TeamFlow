from fastapi import APIRouter, Response, status

from app.api.deps import CurrentAuth
from app.schemas.common import Page
from app.schemas.project import AddProjectMemberRequest, ProjectMemberOut
from app.services import project_service
from app.utils.pagination import PageQuery

router = APIRouter(prefix="/projects/{project_id}/members", tags=["project members"])


@router.get("", response_model=Page[ProjectMemberOut])
async def list_members(
    auth: CurrentAuth, project_id: str, params: PageQuery
) -> Page[ProjectMemberOut]:
    return await project_service.list_members(auth, project_id, params)


@router.post("", response_model=ProjectMemberOut, status_code=status.HTTP_201_CREATED)
async def add_member(
    auth: CurrentAuth, project_id: str, data: AddProjectMemberRequest
) -> ProjectMemberOut:
    return await project_service.add_member(auth, project_id, data)


@router.delete("/{user_id}", status_code=204)
async def remove_member(auth: CurrentAuth, project_id: str, user_id: str) -> Response:
    await project_service.remove_member(auth, project_id, user_id)
    return Response(status_code=204)
