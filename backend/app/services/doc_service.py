from beanie import PydanticObjectId

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.doc import MAX_DOC_VERSIONS, Doc, DocVersion
from app.models.user import User
from app.permissions.context import AuthContext, ProjectContext
from app.permissions.matrix import Permission
from app.permissions.policies import require
from app.repositories.doc_repository import doc_repository
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.schemas.common import Page, UserBrief
from app.schemas.doc import (
    DocCreate,
    DocLinkRequest,
    DocOut,
    DocSummary,
    DocUpdate,
    DocVersionOut,
)
from app.services import project_service
from app.services.task_access import find_task
from app.services.task_output import brief_of
from app.utils.html import sanitize
from app.utils.object_id import to_object_id
from app.utils.pagination import PageParams
from app.utils.time import utcnow


def _brief_map(users: list[User]) -> dict[PydanticObjectId, UserBrief]:
    return {user.pk: UserBrief.from_user(user) for user in users}


async def _summaries(docs: list[Doc]) -> list[DocSummary]:
    users = _brief_map(await user_repository.find_by_ids(doc.updated_by for doc in docs))
    return [
        DocSummary(
            id=doc.pk,
            project_id=doc.project_id,
            title=doc.title,
            updated_by=users.get(doc.updated_by),
            updated_at=doc.updated_at,
            created_at=doc.created_at,
            version_count=len(doc.versions),
        )
        for doc in docs
    ]


async def _detail(doc: Doc, context: ProjectContext) -> DocOut:
    [summary] = await _summaries([doc])
    savers = _brief_map(await user_repository.find_by_ids(v.saved_by for v in doc.versions))
    linked = await task_repository.find_by_ids(doc.linked_task_ids)
    return DocOut(
        **summary.model_dump(),
        content=doc.content,
        versions=[
            DocVersionOut(
                number=version.number,
                title=version.title,
                saved_by=savers.get(version.saved_by),
                saved_at=version.saved_at,
            )
            for version in reversed(doc.versions)
        ],
        linked_tasks=[brief_of(task, context.project) for task in linked],
    )


async def list_docs(
    auth: AuthContext, project_id: str, params: PageParams, q: str | None
) -> Page[DocSummary]:
    context = await project_service.get_context(auth, project_id)
    docs, total = await doc_repository.list_for_project(
        context.project.pk, q, params.skip, params.limit
    )
    return Page(
        items=await _summaries(docs), total=total, page=params.page, page_size=params.page_size
    )


async def create_doc(auth: AuthContext, project_id: str, data: DocCreate) -> DocOut:
    context = await project_service.get_context(auth, project_id)
    require(context.role, Permission.DOC_WRITE, "You cannot write docs")
    doc = await doc_repository.insert(
        Doc(
            project_id=context.project.pk,
            title=data.title,
            content=sanitize(data.content),
            created_by=auth.user.pk,
            updated_by=auth.user.pk,
        )
    )
    return await _detail(doc, context)


async def _load(auth: AuthContext, doc_id: str) -> tuple[Doc, ProjectContext]:
    doc = await doc_repository.get(to_object_id(doc_id))
    if doc is None:
        raise NotFoundError("Doc not found", code="doc_not_found")
    return doc, await project_service.get_context(auth, str(doc.project_id))


async def _load_for_write(auth: AuthContext, doc_id: str) -> tuple[Doc, ProjectContext]:
    doc, context = await _load(auth, doc_id)
    require(context.role, Permission.DOC_WRITE, "You cannot write docs")
    return doc, context


async def get_doc(auth: AuthContext, doc_id: str) -> DocOut:
    doc, context = await _load(auth, doc_id)
    return await _detail(doc, context)


def _snapshot(doc: Doc, user_id: PydanticObjectId) -> None:
    next_number = (doc.versions[-1].number + 1) if doc.versions else 1
    doc.versions.append(
        DocVersion(number=next_number, title=doc.title, content=doc.content, saved_by=user_id)
    )
    if len(doc.versions) > MAX_DOC_VERSIONS:
        doc.versions = doc.versions[-MAX_DOC_VERSIONS:]


async def _save(doc: Doc, user_id: PydanticObjectId) -> None:
    doc.updated_by = user_id
    doc.updated_at = utcnow()
    await doc_repository.save(doc)


async def update_doc(auth: AuthContext, doc_id: str, data: DocUpdate) -> DocOut:
    doc, context = await _load_for_write(auth, doc_id)
    if data.title is None and data.content is None:
        raise BusinessRuleError("Nothing to update", code="nothing_to_update")
    _snapshot(doc, auth.user.pk)
    if data.title is not None:
        doc.title = data.title
    if data.content is not None:
        doc.content = sanitize(data.content)
    await _save(doc, auth.user.pk)
    return await _detail(doc, context)


async def restore_version(auth: AuthContext, doc_id: str, number: int) -> DocOut:
    doc, context = await _load_for_write(auth, doc_id)
    version = next((item for item in doc.versions if item.number == number), None)
    if version is None:
        raise NotFoundError("Version not found", code="doc_version_not_found")
    restored_title, restored_content = version.title, version.content
    _snapshot(doc, auth.user.pk)
    doc.title, doc.content = restored_title, restored_content
    await _save(doc, auth.user.pk)
    return await _detail(doc, context)


async def delete_doc(auth: AuthContext, doc_id: str) -> None:
    doc, context = await _load(auth, doc_id)
    require(context.role, Permission.TASK_DELETE_ANY, "Only managers can delete docs")
    await doc_repository.delete(doc)


async def link_task(auth: AuthContext, doc_id: str, data: DocLinkRequest) -> DocOut:
    doc, context = await _load_for_write(auth, doc_id)
    task = await find_task(auth, data.task)
    if task.project_id != doc.project_id:
        raise BusinessRuleError("Link issues from the same project", code="cross_project_link")
    if task.pk not in doc.linked_task_ids:
        doc.linked_task_ids.append(task.pk)
        await doc_repository.save(doc)
    return await _detail(doc, context)


async def unlink_task(auth: AuthContext, doc_id: str, task_ref: str) -> DocOut:
    doc, context = await _load_for_write(auth, doc_id)
    task = await find_task(auth, task_ref)
    if task.pk in doc.linked_task_ids:
        doc.linked_task_ids.remove(task.pk)
        await doc_repository.save(doc)
    return await _detail(doc, context)


async def docs_for_task(auth: AuthContext, task_ref: str) -> list[DocSummary]:
    task = await find_task(auth, task_ref)
    await project_service.get_context(auth, str(task.project_id))
    return await _summaries(await doc_repository.linked_to_task(task.pk))
