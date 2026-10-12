from dataclasses import dataclass
from pathlib import PurePath

from app.core.config import get_settings
from app.core.exceptions import BusinessRuleError, ForbiddenError, NotFoundError
from app.core.storage import get_storage
from app.models.attachment import Attachment
from app.permissions.context import AuthContext
from app.permissions.matrix import Permission
from app.permissions.policies import can, require
from app.repositories.attachment_repository import attachment_repository
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.schemas.attachment import AttachmentOut
from app.schemas.common import UserBrief
from app.services import activity_service, project_service
from app.services.task_access import load_task
from app.utils.object_id import to_object_id

ALLOWED_EXTENSIONS = frozenset(
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".pdf",
        ".txt",
        ".md",
        ".csv",
        ".json",
        ".log",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".zip",
    }
)
SAFE_NAME_LIMIT = 150


@dataclass(frozen=True)
class DownloadedFile:
    filename: str
    content_type: str
    content: bytes


def _clean_filename(raw: str) -> str:
    name = PurePath(raw.replace("\\", "/")).name.strip()
    return name[:SAFE_NAME_LIMIT] if name else "file"


async def _to_outputs(items: list[Attachment]) -> list[AttachmentOut]:
    users = {
        user.pk: user
        for user in await user_repository.find_by_ids(item.uploaded_by for item in items)
    }
    return [
        AttachmentOut(
            id=item.pk,
            task_id=item.task_id,
            filename=item.filename,
            content_type=item.content_type,
            size=item.size,
            uploaded_by=UserBrief.from_user(users[item.uploaded_by])
            if item.uploaded_by in users
            else None,
            created_at=item.created_at,
        )
        for item in items
    ]


async def list_attachments(auth: AuthContext, ref: str) -> list[AttachmentOut]:
    task, _ = await load_task(auth, ref)
    return await _to_outputs(await attachment_repository.list_for_task(task.pk))


async def upload(
    auth: AuthContext, ref: str, filename: str, content_type: str | None, content: bytes
) -> AttachmentOut:
    task, context = await load_task(auth, ref)
    require(context.role, Permission.TASK_CREATE, "You cannot add attachments")
    name = _clean_filename(filename)
    suffix = PurePath(name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise BusinessRuleError("This file type is not allowed", code="attachment_type_not_allowed")
    if not content:
        raise BusinessRuleError("The file is empty", code="attachment_empty")
    if len(content) > get_settings().max_upload_bytes:
        raise BusinessRuleError("The file is larger than 10 MB", code="attachment_too_large")
    storage = get_storage()
    key = storage.new_key(suffix)
    storage.save(key, content)
    attachment = await attachment_repository.insert(
        Attachment(
            task_id=task.pk,
            project_id=task.project_id,
            filename=name,
            content_type=content_type or "application/octet-stream",
            size=len(content),
            storage_key=key,
            uploaded_by=auth.user.pk,
        )
    )
    await activity_service.record(
        task, auth.user.pk, "attachment", field="attachment", new_value=name
    )
    [output] = await _to_outputs([attachment])
    return output


async def _load_attachment(auth: AuthContext, attachment_id: str) -> tuple[Attachment, bool]:
    attachment = await attachment_repository.get(to_object_id(attachment_id))
    if attachment is None:
        raise NotFoundError("Attachment not found", code="attachment_not_found")
    context = await project_service.get_context(auth, str(attachment.project_id))
    manageable = attachment.uploaded_by == auth.user.pk or can(
        context.role, Permission.TASK_EDIT_ANY
    )
    return attachment, manageable


async def download(auth: AuthContext, attachment_id: str) -> DownloadedFile:
    attachment, _ = await _load_attachment(auth, attachment_id)
    storage = get_storage()
    if not storage.exists(attachment.storage_key):
        raise NotFoundError("Attachment file is missing", code="attachment_not_found")
    return DownloadedFile(
        attachment.filename, attachment.content_type, storage.read(attachment.storage_key)
    )


async def delete(auth: AuthContext, attachment_id: str) -> None:
    attachment, manageable = await _load_attachment(auth, attachment_id)
    if not manageable:
        raise ForbiddenError("You cannot delete this attachment", code="permission_denied")
    get_storage().delete(attachment.storage_key)
    task = await task_repository.get(attachment.task_id)
    await attachment_repository.delete(attachment)
    if task is not None:
        await activity_service.record(
            task, auth.user.pk, "attachment", field="attachment", old_value=attachment.filename
        )
