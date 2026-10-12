from fastapi import APIRouter, Response, status

from app.api.deps import CurrentAuth
from app.schemas.common import Page
from app.schemas.doc import DocCreate, DocLinkRequest, DocOut, DocSummary, DocUpdate
from app.schemas.search import SearchResults
from app.services import doc_service, search_service
from app.utils.pagination import PageQuery

router = APIRouter(tags=["docs"])


@router.get("/projects/{project_id}/docs", response_model=Page[DocSummary])
async def list_docs(
    auth: CurrentAuth, project_id: str, params: PageQuery, q: str | None = None
) -> Page[DocSummary]:
    return await doc_service.list_docs(auth, project_id, params, q)


@router.post(
    "/projects/{project_id}/docs", response_model=DocOut, status_code=status.HTTP_201_CREATED
)
async def create_doc(auth: CurrentAuth, project_id: str, data: DocCreate) -> DocOut:
    return await doc_service.create_doc(auth, project_id, data)


@router.get("/docs/{doc_id}", response_model=DocOut)
async def get_doc(auth: CurrentAuth, doc_id: str) -> DocOut:
    return await doc_service.get_doc(auth, doc_id)


@router.patch("/docs/{doc_id}", response_model=DocOut)
async def update_doc(auth: CurrentAuth, doc_id: str, data: DocUpdate) -> DocOut:
    return await doc_service.update_doc(auth, doc_id, data)


@router.delete("/docs/{doc_id}", status_code=204)
async def delete_doc(auth: CurrentAuth, doc_id: str) -> Response:
    await doc_service.delete_doc(auth, doc_id)
    return Response(status_code=204)


@router.post("/docs/{doc_id}/versions/{number}/restore", response_model=DocOut)
async def restore_version(auth: CurrentAuth, doc_id: str, number: int) -> DocOut:
    return await doc_service.restore_version(auth, doc_id, number)


@router.post("/docs/{doc_id}/links", response_model=DocOut)
async def link_task(auth: CurrentAuth, doc_id: str, data: DocLinkRequest) -> DocOut:
    return await doc_service.link_task(auth, doc_id, data)


@router.delete("/docs/{doc_id}/links/{task_ref}", response_model=DocOut)
async def unlink_task(auth: CurrentAuth, doc_id: str, task_ref: str) -> DocOut:
    return await doc_service.unlink_task(auth, doc_id, task_ref)


@router.get("/tasks/{task_ref}/docs", response_model=list[DocSummary])
async def docs_for_task(auth: CurrentAuth, task_ref: str) -> list[DocSummary]:
    return await doc_service.docs_for_task(auth, task_ref)


@router.get("/search", response_model=SearchResults)
async def search(auth: CurrentAuth, q: str = "") -> SearchResults:
    return await search_service.search(auth, q)
