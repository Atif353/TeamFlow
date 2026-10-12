from fastapi import APIRouter, Response, status

from app.api.deps import CurrentAuth
from app.schemas.common import Page
from app.schemas.project import (
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    UpdateStatusesRequest,
    UpdateWorkflowRequest,
)
from app.services import project_service
from app.utils.pagination import PageQuery

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=Page[ProjectOut])
async def list_projects(
    auth: CurrentAuth, params: PageQuery, q: str | None = None
) -> Page[ProjectOut]:
    return await project_service.list_projects(auth, params, q)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(auth: CurrentAuth, data: ProjectCreate) -> ProjectOut:
    return await project_service.create_project(auth, data)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(auth: CurrentAuth, project_id: str) -> ProjectOut:
    return await project_service.get_project(auth, project_id)


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(auth: CurrentAuth, project_id: str, data: ProjectUpdate) -> ProjectOut:
    return await project_service.update_project(auth, project_id, data)


@router.delete("/{project_id}", status_code=204)
async def delete_project(auth: CurrentAuth, project_id: str) -> Response:
    await project_service.delete_project(auth, project_id)
    return Response(status_code=204)


@router.put("/{project_id}/workflow", response_model=ProjectOut)
async def update_workflow(
    auth: CurrentAuth, project_id: str, data: UpdateWorkflowRequest
) -> ProjectOut:
    return await project_service.update_workflow(auth, project_id, data)


@router.put("/{project_id}/statuses", response_model=ProjectOut)
async def update_statuses(
    auth: CurrentAuth, project_id: str, data: UpdateStatusesRequest
) -> ProjectOut:
    return await project_service.update_statuses(auth, project_id, data)
