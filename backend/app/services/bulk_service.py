from app.core.exceptions import DomainError, NotFoundError
from app.models.issue_link import LinkType
from app.permissions.context import AuthContext
from app.repositories.task_repository import task_repository
from app.schemas.issue_link import IssueLinkCreate
from app.schemas.task import BulkFailure, BulkResult, TaskBulkRequest, TaskCreate, TaskOut
from app.services import link_service, project_service, task_service
from app.services.task_access import load_task

CLONE_PREFIX = "CLONE - "
TITLE_LIMIT = 200


async def apply_bulk(auth: AuthContext, project_id: str, data: TaskBulkRequest) -> BulkResult:
    context = await project_service.get_context(auth, project_id)
    failures: list[BulkFailure] = []
    succeeded = 0
    for task_id in dict.fromkeys(data.task_ids):
        try:
            task = await task_repository.get(task_id)
            if task is None or task.project_id != context.project.pk:
                raise NotFoundError("Task not found", code="task_not_found")
            if data.delete:
                await task_service.delete_task(auth, str(task_id))
            elif data.changes is not None:
                await task_service.update_task(auth, str(task_id), data.changes)
            succeeded += 1
        except DomainError as error:
            failures.append(BulkFailure(task_id=task_id, message=error.message, code=error.code))
    return BulkResult(succeeded=succeeded, failed=failures)


async def clone_task(auth: AuthContext, ref: str) -> TaskOut:
    task, context = await load_task(auth, ref)
    copy = await task_service.create_task(
        auth,
        str(context.project.pk),
        TaskCreate(
            title=f"{CLONE_PREFIX}{task.title}"[:TITLE_LIMIT],
            description=task.description,
            issue_type=task.issue_type,
            priority=task.priority,
            assignee_id=task.assignee_id,
            label_ids=list(task.label_ids),
            components=list(task.components),
            parent_id=task.parent_id,
            epic_id=task.epic_id,
            version_id=task.version_id,
            environment=task.environment,
            story_points=task.story_points,
            original_estimate_minutes=task.original_estimate_minutes,
        ),
    )
    await link_service.create_link(
        auth,
        copy.key,
        IssueLinkCreate(
            target=f"{context.project.key}-{task.issue_number}", link_type=LinkType.CLONES
        ),
    )
    return copy
