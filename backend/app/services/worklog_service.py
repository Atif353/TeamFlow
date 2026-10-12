from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.task import Task
from app.models.worklog import Worklog
from app.permissions.context import AuthContext
from app.permissions.matrix import Permission
from app.permissions.policies import can, require
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.repositories.worklog_repository import worklog_repository
from app.schemas.common import UserBrief
from app.schemas.worklog import WorklogCreate, WorklogOut, WorklogUpdate
from app.services import activity_service, project_service
from app.services.task_access import load_task
from app.utils.object_id import to_object_id
from app.utils.time import utcnow


def format_minutes(minutes: int) -> str:
    hours, rest = divmod(minutes, 60)
    parts = []
    if hours:
        parts.append(f"{hours}h")
    if rest or not hours:
        parts.append(f"{rest}m")
    return " ".join(parts)


async def _to_outputs(entries: list[Worklog]) -> list[WorklogOut]:
    users = {
        user.pk: user
        for user in await user_repository.find_by_ids(entry.author_id for entry in entries)
    }
    return [
        WorklogOut(
            id=entry.pk,
            task_id=entry.task_id,
            author=UserBrief.from_user(users[entry.author_id])
            if entry.author_id in users
            else None,
            minutes=entry.minutes,
            started_at=entry.started_at,
            comment=entry.comment,
            created_at=entry.created_at,
        )
        for entry in entries
    ]


async def list_worklogs(auth: AuthContext, ref: str) -> list[WorklogOut]:
    task, _ = await load_task(auth, ref)
    return await _to_outputs(await worklog_repository.list_for_task(task.pk))


async def create_worklog(auth: AuthContext, ref: str, data: WorklogCreate) -> WorklogOut:
    task, context = await load_task(auth, ref)
    require(context.role, Permission.TASK_CREATE, "You cannot log work")
    entry = await worklog_repository.insert(
        Worklog(
            task_id=task.pk,
            project_id=task.project_id,
            author_id=auth.user.pk,
            minutes=data.minutes,
            started_at=data.started_at or utcnow(),
            comment=data.comment,
        )
    )
    task.time_spent_minutes += data.minutes
    if data.remaining_minutes is not None:
        task.remaining_estimate_minutes = data.remaining_minutes
    elif task.remaining_estimate_minutes is not None:
        task.remaining_estimate_minutes = max(0, task.remaining_estimate_minutes - data.minutes)
    await _save_task(task)
    await activity_service.record(
        task, auth.user.pk, "worklog", field="work log", new_value=format_minutes(data.minutes)
    )
    [output] = await _to_outputs([entry])
    return output


async def _save_task(task: Task) -> None:
    task.updated_at = utcnow()
    await task_repository.save(task)


async def _load_entry(auth: AuthContext, worklog_id: str) -> tuple[Worklog, Task]:
    entry = await worklog_repository.get(to_object_id(worklog_id))
    if entry is None:
        raise NotFoundError("Work log not found", code="worklog_not_found")
    task = await task_repository.get(entry.task_id)
    if task is None:
        raise NotFoundError("Task not found", code="task_not_found")
    context = await project_service.get_context(auth, str(task.project_id))
    allowed = entry.author_id == auth.user.pk or can(context.role, Permission.TASK_EDIT_ANY)
    if not allowed or not can(context.role, Permission.TASK_CREATE):
        raise ForbiddenError("You cannot change this work log", code="permission_denied")
    return entry, task


def _shift_totals(task: Task, delta: int) -> None:
    task.time_spent_minutes = max(0, task.time_spent_minutes + delta)
    if task.remaining_estimate_minutes is not None:
        task.remaining_estimate_minutes = max(0, task.remaining_estimate_minutes - delta)


async def update_worklog(auth: AuthContext, worklog_id: str, data: WorklogUpdate) -> WorklogOut:
    entry, task = await _load_entry(auth, worklog_id)
    if data.minutes is not None and data.minutes != entry.minutes:
        _shift_totals(task, data.minutes - entry.minutes)
        entry.minutes = data.minutes
        await _save_task(task)
    if data.started_at is not None:
        entry.started_at = data.started_at
    if data.comment is not None:
        entry.comment = data.comment
    entry.updated_at = utcnow()
    await worklog_repository.save(entry)
    [output] = await _to_outputs([entry])
    return output


async def delete_worklog(auth: AuthContext, worklog_id: str) -> None:
    entry, task = await _load_entry(auth, worklog_id)
    _shift_totals(task, -entry.minutes)
    await _save_task(task)
    await worklog_repository.delete(entry)
