from typing import Annotated

from fastapi import APIRouter, File, Response, UploadFile, status

from app.api.deps import CurrentAuth
from app.core.config import get_settings
from app.schemas.attachment import AttachmentOut
from app.schemas.issue_link import IssueLinkCreate, IssueLinkOut
from app.schemas.worklog import WorklogCreate, WorklogOut, WorklogUpdate
from app.services import attachment_service, link_service, worklog_service

router = APIRouter(tags=["issue-work"])


@router.get("/tasks/{task_ref}/worklogs", response_model=list[WorklogOut])
async def list_worklogs(auth: CurrentAuth, task_ref: str) -> list[WorklogOut]:
    return await worklog_service.list_worklogs(auth, task_ref)


@router.post(
    "/tasks/{task_ref}/worklogs", response_model=WorklogOut, status_code=status.HTTP_201_CREATED
)
async def create_worklog(auth: CurrentAuth, task_ref: str, data: WorklogCreate) -> WorklogOut:
    return await worklog_service.create_worklog(auth, task_ref, data)


@router.patch("/worklogs/{worklog_id}", response_model=WorklogOut)
async def update_worklog(auth: CurrentAuth, worklog_id: str, data: WorklogUpdate) -> WorklogOut:
    return await worklog_service.update_worklog(auth, worklog_id, data)


@router.delete("/worklogs/{worklog_id}", status_code=204)
async def delete_worklog(auth: CurrentAuth, worklog_id: str) -> Response:
    await worklog_service.delete_worklog(auth, worklog_id)
    return Response(status_code=204)


@router.get("/tasks/{task_ref}/links", response_model=list[IssueLinkOut])
async def list_links(auth: CurrentAuth, task_ref: str) -> list[IssueLinkOut]:
    return await link_service.list_links(auth, task_ref)


@router.post(
    "/tasks/{task_ref}/links",
    response_model=list[IssueLinkOut],
    status_code=status.HTTP_201_CREATED,
)
async def create_link(
    auth: CurrentAuth, task_ref: str, data: IssueLinkCreate
) -> list[IssueLinkOut]:
    return await link_service.create_link(auth, task_ref, data)


@router.delete("/links/{link_id}", status_code=204)
async def delete_link(auth: CurrentAuth, link_id: str) -> Response:
    await link_service.delete_link(auth, link_id)
    return Response(status_code=204)


@router.get("/tasks/{task_ref}/attachments", response_model=list[AttachmentOut])
async def list_attachments(auth: CurrentAuth, task_ref: str) -> list[AttachmentOut]:
    return await attachment_service.list_attachments(auth, task_ref)


@router.post(
    "/tasks/{task_ref}/attachments",
    response_model=AttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    auth: CurrentAuth, task_ref: str, file: Annotated[UploadFile, File()]
) -> AttachmentOut:
    limit = get_settings().max_upload_bytes
    content = await file.read(limit + 1)
    return await attachment_service.upload(
        auth, task_ref, file.filename or "file", file.content_type, content
    )


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(auth: CurrentAuth, attachment_id: str) -> Response:
    stored = await attachment_service.download(auth, attachment_id)
    return Response(
        content=stored.content,
        media_type=stored.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{stored.filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/attachments/{attachment_id}", status_code=204)
async def delete_attachment(auth: CurrentAuth, attachment_id: str) -> Response:
    await attachment_service.delete(auth, attachment_id)
    return Response(status_code=204)
