from fastapi import APIRouter, Response, status

from app.api.deps import CurrentAuth
from app.schemas.label import LabelCreate, LabelOut, LabelUpdate
from app.services import label_service

router = APIRouter(tags=["labels"])


@router.get("/projects/{project_id}/labels", response_model=list[LabelOut])
async def list_labels(auth: CurrentAuth, project_id: str) -> list[LabelOut]:
    return await label_service.list_labels(auth, project_id)


@router.post(
    "/projects/{project_id}/labels", response_model=LabelOut, status_code=status.HTTP_201_CREATED
)
async def create_label(auth: CurrentAuth, project_id: str, data: LabelCreate) -> LabelOut:
    return await label_service.create_label(auth, project_id, data)


@router.patch("/labels/{label_id}", response_model=LabelOut)
async def update_label(auth: CurrentAuth, label_id: str, data: LabelUpdate) -> LabelOut:
    return await label_service.update_label(auth, label_id, data)


@router.delete("/labels/{label_id}", status_code=204)
async def delete_label(auth: CurrentAuth, label_id: str) -> Response:
    await label_service.delete_label(auth, label_id)
    return Response(status_code=204)
