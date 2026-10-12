from beanie import PydanticObjectId

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.comment import Comment
from app.models.notification import NotificationType
from app.models.task import Task
from app.permissions.context import AuthContext
from app.permissions.matrix import Permission
from app.permissions.policies import can_delete_comment, require
from app.repositories.comment_repository import comment_repository
from app.repositories.project_repository import project_repository
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate
from app.schemas.common import Page, UserBrief
from app.services import activity_service, notification_service, project_service
from app.services.task_access import load_task
from app.utils.mentions import extract_mentioned_ids
from app.utils.object_id import to_object_id
from app.utils.pagination import PageParams
from app.utils.time import utcnow


async def _build_outputs(comments: list[Comment]) -> list[CommentOut]:
    user_ids = [c.author_id for c in comments] + [uid for c in comments for uid in c.mentions]
    users = {user.pk: user for user in await user_repository.find_by_ids(user_ids)}
    return [
        CommentOut(
            id=comment.pk,
            task_id=comment.task_id,
            author=UserBrief.from_user(users[comment.author_id])
            if comment.author_id in users
            else None,
            body=comment.body,
            mentions=[UserBrief.from_user(users[uid]) for uid in comment.mentions if uid in users],
            created_at=comment.created_at,
            edited_at=comment.edited_at,
        )
        for comment in comments
    ]


async def _mentioned_ids(project_id: str, body: str) -> list[PydanticObjectId]:
    members = await project_repository.all_members(to_object_id(project_id))
    users = await user_repository.find_by_ids(member.user_id for member in members)
    return extract_mentioned_ids(body, [(user.pk, user.name) for user in users if user.is_active])


async def list_comments(auth: AuthContext, task_id: str, params: PageParams) -> Page[CommentOut]:
    task, _ = await load_task(auth, task_id)
    comments, total = await comment_repository.list_for_task(task.pk, params.skip, params.limit)
    return Page(
        items=await _build_outputs(comments),
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def create_comment(auth: AuthContext, task_id: str, data: CommentCreate) -> CommentOut:
    task, context = await load_task(auth, task_id)
    require(context.role, Permission.COMMENT_CREATE, "You cannot comment on tasks")
    comment = await comment_repository.insert(
        Comment(
            task_id=task.pk,
            project_id=task.project_id,
            author_id=auth.user.pk,
            body=data.body,
            mentions=await _mentioned_ids(str(task.project_id), data.body),
        )
    )
    await _notify_comment(task, comment, auth.user.pk)
    [output] = await _build_outputs([comment])
    return output


async def _notify_comment(task: Task, comment: Comment, actor_id: PydanticObjectId) -> None:
    if actor_id not in task.watcher_ids:
        task.watcher_ids.append(actor_id)
        await task_repository.save(task)
    mentioned = [uid for uid in comment.mentions if uid != actor_id]
    await notification_service.notify(task, actor_id, mentioned, NotificationType.MENTIONED)
    others = [uid for uid in task.watcher_ids if uid not in comment.mentions]
    await notification_service.notify(task, actor_id, others, NotificationType.COMMENT_ADDED)
    await activity_service.record(task, actor_id, "commented")


async def _load_comment(auth: AuthContext, comment_id: str) -> tuple[Comment, str]:
    comment = await comment_repository.get(to_object_id(comment_id))
    if comment is None:
        raise NotFoundError("Comment not found", code="comment_not_found")
    context = await project_service.get_context(auth, str(comment.project_id))
    return comment, context.role


async def update_comment(auth: AuthContext, comment_id: str, data: CommentUpdate) -> CommentOut:
    comment, _ = await _load_comment(auth, comment_id)
    if comment.author_id != auth.user.pk:
        raise ForbiddenError("You can only edit your own comments", code="permission_denied")
    comment.body = data.body
    comment.mentions = await _mentioned_ids(str(comment.project_id), data.body)
    comment.edited_at = utcnow()
    await comment_repository.save(comment)
    [output] = await _build_outputs([comment])
    return output


async def delete_comment(auth: AuthContext, comment_id: str) -> None:
    comment = await comment_repository.get(to_object_id(comment_id))
    if comment is None:
        raise NotFoundError("Comment not found", code="comment_not_found")
    context = await project_service.get_context(auth, str(comment.project_id))
    if not can_delete_comment(context.role, auth.user.pk, comment.author_id):
        raise ForbiddenError("You cannot delete this comment", code="permission_denied")
    await comment_repository.delete(comment)
