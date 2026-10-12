from datetime import timedelta

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.sprint import Sprint, SprintState
from app.models.task import IssueType, Task
from app.permissions.context import AuthContext, ProjectContext
from app.permissions.matrix import Permission
from app.permissions.policies import require
from app.repositories.sprint_repository import sprint_repository
from app.repositories.task_repository import task_repository
from app.schemas.sprint import (
    BacklogOut,
    BacklogSprint,
    SprintComplete,
    SprintCreate,
    SprintOut,
    SprintStart,
    SprintUpdate,
)
from app.services import project_service
from app.services.task_output import build_outputs
from app.utils.object_id import to_object_id
from app.utils.time import date_to_datetime, datetime_to_date, utcnow

DEFAULT_SPRINT_DAYS = 14


def _points(tasks: list[Task]) -> float:
    return sum(task.story_points or 0 for task in tasks)


def to_output(sprint: Sprint, tasks: list[Task]) -> SprintOut:
    done = [task for task in tasks if task.completed_at is not None]
    return SprintOut(
        id=sprint.pk,
        project_id=sprint.project_id,
        name=sprint.name,
        goal=sprint.goal,
        state=sprint.state,
        start_date=datetime_to_date(sprint.start_date),
        end_date=datetime_to_date(sprint.end_date),
        started_at=sprint.started_at,
        completed_at=sprint.completed_at,
        issue_count=len(tasks),
        done_count=len(done),
        story_points=_points(tasks),
        done_points=_points(done),
        committed_points=sprint.committed_points,
        committed_issues=sprint.committed_issues,
        completed_points=sprint.completed_points,
        completed_issues=sprint.completed_issues,
    )


def _sprint_tasks(tasks: list[Task], sprint: Sprint) -> list[Task]:
    return [task for task in tasks if task.sprint_id == sprint.pk and task.parent_id is None]


async def list_sprints(
    auth: AuthContext, project_id: str, states: list[SprintState] | None
) -> list[SprintOut]:
    context = await project_service.get_context(auth, project_id)
    sprints = await sprint_repository.list_for_project(context.project.pk, states)
    tasks = await task_repository.all_in_project(context.project.pk)
    return [to_output(sprint, _sprint_tasks(tasks, sprint)) for sprint in sprints]


async def get_backlog(auth: AuthContext, project_id: str) -> BacklogOut:
    context = await project_service.get_context(auth, project_id)
    project_pk = context.project.pk
    tasks = sorted(await task_repository.all_in_project(project_pk), key=lambda t: (t.rank, t.pk))
    sprints = await sprint_repository.list_for_project(
        project_pk, [SprintState.ACTIVE, SprintState.PLANNED]
    )
    sprints.sort(key=lambda s: (s.state != SprintState.ACTIVE, s.created_at))
    top_level = [task for task in tasks if task.parent_id is None]
    backlog_tasks = [
        task
        for task in top_level
        if task.sprint_id is None
        and task.issue_type != IssueType.EPIC
        and task.completed_at is None
    ]
    epics = [task for task in top_level if task.issue_type == IssueType.EPIC]
    result: list[BacklogSprint] = []
    for sprint in sprints:
        members = _sprint_tasks(top_level, sprint)
        result.append(
            BacklogSprint(
                sprint=to_output(sprint, members),
                issues=await build_outputs(members, auth.user.pk),
            )
        )
    return BacklogOut(
        sprints=result,
        backlog=await build_outputs(backlog_tasks, auth.user.pk),
        epics=await build_outputs(epics, auth.user.pk),
    )


async def _manage_context(auth: AuthContext, project_id: str) -> ProjectContext:
    context = await project_service.get_context(auth, project_id)
    require(context.role, Permission.SPRINT_MANAGE, "You cannot manage sprints")
    return context


async def _load_sprint(auth: AuthContext, sprint_id: str) -> tuple[Sprint, ProjectContext]:
    sprint = await sprint_repository.get(to_object_id(sprint_id))
    if sprint is None:
        raise NotFoundError("Sprint not found", code="sprint_not_found")
    context = await project_service.get_context(auth, str(sprint.project_id))
    return sprint, context


async def _output_for(sprint: Sprint) -> SprintOut:
    tasks = await task_repository.in_sprint(sprint.pk)
    return to_output(sprint, [task for task in tasks if task.parent_id is None])


async def create_sprint(auth: AuthContext, project_id: str, data: SprintCreate) -> SprintOut:
    context = await _manage_context(auth, project_id)
    sprint = await sprint_repository.insert(
        Sprint(
            project_id=context.project.pk,
            name=data.name,
            goal=data.goal,
            start_date=date_to_datetime(data.start_date) if data.start_date else None,
            end_date=date_to_datetime(data.end_date) if data.end_date else None,
            created_by=auth.user.pk,
        )
    )
    return await _output_for(sprint)


async def update_sprint(auth: AuthContext, sprint_id: str, data: SprintUpdate) -> SprintOut:
    sprint, context = await _load_sprint(auth, sprint_id)
    require(context.role, Permission.SPRINT_MANAGE, "You cannot manage sprints")
    if sprint.state == SprintState.COMPLETED:
        raise BusinessRuleError("Completed sprints cannot be edited", code="sprint_completed")
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if field in ("start_date", "end_date"):
            value = date_to_datetime(value) if value else None
        setattr(sprint, field, value)
    await sprint_repository.save(sprint)
    return await _output_for(sprint)


async def start_sprint(auth: AuthContext, sprint_id: str, data: SprintStart) -> SprintOut:
    sprint, context = await _load_sprint(auth, sprint_id)
    require(context.role, Permission.SPRINT_MANAGE, "You cannot manage sprints")
    if sprint.state != SprintState.PLANNED:
        raise BusinessRuleError("Only planned sprints can be started", code="sprint_not_planned")
    if await sprint_repository.active_for_project(sprint.project_id):
        raise ConflictError(
            "This project already has an active sprint", code="active_sprint_exists"
        )
    now = utcnow()
    start = date_to_datetime(data.start_date) if data.start_date else sprint.start_date or now
    end = (
        date_to_datetime(data.end_date)
        if data.end_date
        else sprint.end_date or start + timedelta(days=DEFAULT_SPRINT_DAYS)
    )
    if end < start:
        raise BusinessRuleError("The end date cannot be before the start", code="invalid_dates")
    tasks = [t for t in await task_repository.in_sprint(sprint.pk) if t.parent_id is None]
    sprint.state = SprintState.ACTIVE
    sprint.start_date, sprint.end_date, sprint.started_at = start, end, now
    sprint.committed_points = _points(tasks)
    sprint.committed_issues = len(tasks)
    await sprint_repository.save(sprint)
    return await _output_for(sprint)


async def complete_sprint(auth: AuthContext, sprint_id: str, data: SprintComplete) -> SprintOut:
    sprint, context = await _load_sprint(auth, sprint_id)
    require(context.role, Permission.SPRINT_MANAGE, "You cannot manage sprints")
    if sprint.state != SprintState.ACTIVE:
        raise BusinessRuleError("Only the active sprint can be completed", code="sprint_not_active")
    target = None
    if data.move_to_sprint_id is not None:
        target = await sprint_repository.get(data.move_to_sprint_id)
        if (
            target is None
            or target.project_id != sprint.project_id
            or target.state != SprintState.PLANNED
        ):
            raise BusinessRuleError(
                "Choose a planned sprint of this project", code="invalid_sprint"
            )
    tasks = await task_repository.in_sprint(sprint.pk)
    top_level = [t for t in tasks if t.parent_id is None]
    done = [t for t in top_level if t.completed_at is not None]
    sprint.completed_points = _points(done)
    sprint.completed_issues = len(done)
    sprint.state = SprintState.COMPLETED
    sprint.completed_at = utcnow()
    await sprint_repository.save(sprint)
    for task in tasks:
        if task.completed_at is None:
            task.sprint_id = target.pk if target else None
            await task_repository.save(task)
    return to_output(sprint, top_level)


async def delete_sprint(auth: AuthContext, sprint_id: str) -> None:
    sprint, context = await _load_sprint(auth, sprint_id)
    require(context.role, Permission.SPRINT_MANAGE, "You cannot manage sprints")
    if sprint.state == SprintState.ACTIVE:
        raise BusinessRuleError("Complete the active sprint instead", code="sprint_active")
    if sprint.state == SprintState.PLANNED:
        await task_repository.clear_sprint(sprint.pk)
    await sprint_repository.delete(sprint)
