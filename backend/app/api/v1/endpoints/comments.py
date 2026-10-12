from fastapi import APIRouter, Response, status

from app.api.deps import CurrentAuth
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate
from app.schemas.common import Page
from app.services import comment_service
from app.utils.pagination import PageQuery

router = APIRouter(tags=["comments"])


@router.get("/tasks/{task_id}/comments", response_model=Page[CommentOut])
async def list_comments(auth: CurrentAuth, task_id: str, params: PageQuery) -> Page[CommentOut]:
    return await comment_service.list_comments(auth, task_id, params)


@router.post(
    "/tasks/{task_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED
)
async def create_comment(auth: CurrentAuth, task_id: str, data: CommentCreate) -> CommentOut:
    return await comment_service.create_comment(auth, task_id, data)


@router.patch("/comments/{comment_id}", response_model=CommentOut)
async def update_comment(auth: CurrentAuth, comment_id: str, data: CommentUpdate) -> CommentOut:
    return await comment_service.update_comment(auth, comment_id, data)


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(auth: CurrentAuth, comment_id: str) -> Response:
    await comment_service.delete_comment(auth, comment_id)
    return Response(status_code=204)
