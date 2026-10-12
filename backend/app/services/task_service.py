from datetime import date, datetime
from typing import Any

from beanie import PydanticObjectId

from app.core.exceptions import BusinessRuleError, ForbiddenError, NotFoundError
from app.core.storage import get_storage
from app.models.automation_rule import AutomationTrigger
from app.models.notification import NotificationType
from app.models.project import Project
from app.models.task import ChecklistItem, IssueType, Task
from app.permissions.context import AuthContext, ProjectContext
from app.permissions.matrix import Permission
from app.permissions.policies import can_delete_task, can_edit_task, require
from app.repositories.activity_repository import activity_repository
from app.repositories.attachment_repository import attachment_repository
from app.repositories.comment_repository import comment_repository
from app.repositories.doc_repository import doc_repository
from app.repositories.issue_link_repository import issue_link_repository
from app.repositories.notification_repository import notification_repository
from app.repositories.project_repository import project_repository
from app.repositories.sprint_repository import sprint_repository
from app.repositories.task_repository import TaskFilters, task_repository
from app.repositories.user_repository import user_repository
from app.repositories.version_repository import version_repository
from app.repositories.worklog_repository import worklog_repository
from app.schemas.activity import ActivityOut
from app.schemas.common import Page
from app.schemas.task import (
    ChecklistCreate,
    ChecklistUpdate,
    SortOrder,
    TaskCreate,
    TaskMove,
    TaskOut,
    TaskRankMove,
    TaskSortField,
    TaskUpdate,
)
from app.services import (
    activity_service,
    automation_service,
    notification_service,
    project_service,
    task_rules,
)
from app.services.task_access import load_task
from app.services.task_output import build_output, build_outputs
from app.utils.html import sanitize_rich_text
from app.utils.pagination import PageParams
from app.utils.positions import POSITION_STEP, needs_rebalance, position_between
from app.utils.time import date_to_datetime, utcnow

TRACKED_FIELDS = (
    "title",
    "description",
    "issue_type",
    "priority",
    "start_date",
    "due_date",
    "story_points",
    "original_estimate_minutes",
    "remaining_estimate_minutes",
    "environment",
    "flagged",
)
FIELD_LABELS = {
    "original_estimate_minutes": "original estimate",
    "remaining_estimate_minutes": "remaining estimate",
    "story_points": "story points",
    "start_date": "start date",
    "due_date": "due date",
    "issue_type": "type",
}


def _require_edit(task: Task, context: ProjectContext) -> None:
    if not can_edit_task(context.role, context.auth.user.pk, task.creator_id, task.assignee_id):
        raise ForbiddenError("You can only modify your own tasks", code="permission_denied")


def _text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, bool):
        return "yes" if value else "no"
    return str(getattr(value, "value", value))


async def _append_position(task: Task) -> None:
    last = await task_repository.edge_position(
        task.project_id, task.status_id, task.parent_id, True
    )
    task.position = POSITION_STEP if last is None else last + POSITION_STEP


async def _append_rank(task: Task) -> None:
    last = await task_repository.edge_rank(task.project_id, True)
    task.rank = POSITION_STEP if last is None else last + POSITION_STEP


def _add_watcher(task: Task, user_id: PydanticObjectId | None) -> None:
    if user_id is not None and user_id not in task.watcher_ids:
        task.watcher_ids.append(user_id)


async def create_task(auth: AuthContext, project_id: str, data: TaskCreate) -> TaskOut:
    context = await project_service.get_context(auth, project_id)
    require(context.role, Permission.TASK_CREATE, "You cannot create tasks")
    project = context.project
    status_id = data.status_id or sorted(project.statuses, key=lambda item: item.order)[0].id
    task_rules.validate_status(project, status_id)
    await task_rules.validate_assignee(project, data.assignee_id)
    await task_rules.validate_labels(project, data.label_ids)
    components = task_rules.validate_components(project, data.components)
    issue_type = data.issue_type
    sprint_id, epic_id = data.sprint_id, data.epic_id
    if data.parent_id is not None:
        parent = await task_rules.validate_parent(project, data.parent_id)
        issue_type = IssueType.SUBTASK
        sprint_id, epic_id = parent.sprint_id, None
        if data.epic_id is not None or data.sprint_id is not None:
            raise BusinessRuleError(
                "Subtasks inherit the sprint and epic of their parent", code="subtask_inherits"
            )
    elif issue_type == IssueType.SUBTASK:
        raise BusinessRuleError("A subtask needs a parent issue", code="subtask_requires_parent")
    if issue_type in task_rules.NON_SPRINT_TYPES and data.parent_id is None and sprint_id:
        raise BusinessRuleError("Epics cannot be planned into sprints", code="epic_in_sprint")
    if issue_type == IssueType.EPIC and epic_id:
        raise BusinessRuleError("An epic cannot belong to another epic", code="epic_in_epic")
    if sprint_id is not None and data.parent_id is None:
        await task_rules.validate_sprint(project, sprint_id)
    if epic_id is not None:
        await task_rules.validate_epic(project, epic_id)
    if data.version_id is not None:
        await task_rules.validate_version(project, data.version_id)
    task = Task(
        project_id=project.pk,
        issue_number=await project_repository.next_issue_number(project.pk),
        issue_type=issue_type,
        parent_id=data.parent_id,
        epic_id=epic_id,
        sprint_id=sprint_id,
        version_id=data.version_id,
        title=data.title,
        description=sanitize_rich_text(data.description),
        environment=data.environment,
        status_id=status_id,
        assignee_id=data.assignee_id,
        creator_id=auth.user.pk,
        start_date=date_to_datetime(data.start_date) if data.start_date else None,
        due_date=date_to_datetime(data.due_date) if data.due_date else None,
        label_ids=list(dict.fromkeys(data.label_ids)),
        components=components,
        story_points=data.story_points,
        original_estimate_minutes=data.original_estimate_minutes,
        remaining_estimate_minutes=data.original_estimate_minutes,
    )
    task.set_priority(data.priority)
    task_rules.apply_completion(task, project)
    _add_watcher(task, auth.user.pk)
    _add_watcher(task, data.assignee_id)
    await _append_position(task)
    await _append_rank(task)
    await task_repository.insert(task)
    await activity_service.record(
        task, auth.user.pk, "created", new_value=task.title, new_id=task.status_id, field="status"
    )
    await notification_service.notify_assignment(task, auth.user.pk, task.assignee_id)
    await automation_service.run_for_task(task, AutomationTrigger.ISSUE_CREATED, auth.user.pk)
    return await build_output(task, auth.user.pk)


async def list_tasks(
    auth: AuthContext,
    project_id: str,
    filters: TaskFilters,
    sort: TaskSortField,
    order: SortOrder,
    params: PageParams,
) -> Page[TaskOut]:
    context = await project_service.get_context(auth, project_id)
    tasks, total = await task_repository.list_for_project(
        context.project.pk, filters, sort.value, order == SortOrder.DESC, params.skip, params.limit
    )
    return Page(
        items=await build_outputs(tasks, auth.user.pk),
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get_task(auth: AuthContext, ref: str) -> TaskOut:
    task, _ = await load_task(auth, ref)
    return await build_output(task, auth.user.pk)


async def _display(project: Project, field: str, value: Any) -> str | None:
    if value is None:
        return None
    if field == "status":
        status = project.status_by_id(str(value))
        return status.name if status else None
    if field == "assignee":
        user = await user_repository.get(value)
        return user.name if user else None
    if field == "sprint":
        sprint = await sprint_repository.get(value)
        return sprint.name if sprint else None
    if field == "epic":
        epic = await task_repository.get(value)
        return f"{project.key}-{epic.issue_number} {epic.title}" if epic else None
    if field == "version":
        version = await version_repository.get(value)
        return version.name if version else None
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    return _text(value)


async def _log_relation(
    task: Task, actor_id: PydanticObjectId, project: Project, field: str, old: Any, new: Any
) -> None:
    await activity_service.record(
        task,
        actor_id,
        "updated",
        field=field,
        old_value=await _display(project, field, old),
        new_value=await _display(project, field, new),
        old_id=str(old) if old is not None else None,
        new_id=str(new) if new is not None else None,
    )


async def _apply_simple_fields(
    task: Task, changes: dict[str, Any], actor_id: PydanticObjectId
) -> None:
    for field in TRACKED_FIELDS:
        if field not in changes:
            continue
        old = getattr(task, field)
        value = changes[field]
        if field in ("start_date", "due_date"):
            value = date_to_datetime(value) if value else None
        if field == "description":
            value = sanitize_rich_text(value)
        if field == "priority":
            task.set_priority(value)
            value = task.priority
        elif old == value:
            continue
        else:
            setattr(task, field, value)
        if _text(old) == _text(value):
            continue
        label = FIELD_LABELS.get(field, field)
        is_description = field == "description"
        await activity_service.record(
            task,
            actor_id,
            "updated",
            field=label,
            old_value=None if is_description else _text(old),
            new_value=None if is_description else _text(value),
        )


async def _apply_type(task: Task, new_type: IssueType, project: Project) -> None:
    if new_type == task.issue_type:
        return
    if IssueType.SUBTASK in (task.issue_type, new_type):
        raise BusinessRuleError(
            "Subtask type cannot be changed; create a new issue instead",
            code="cannot_change_subtask_type",
        )
    if task.issue_type == IssueType.EPIC and await task_repository.epic_children(task.pk):
        raise BusinessRuleError(
            "Remove the child issues from this epic before changing its type",
            code="epic_has_children",
        )
    if new_type == IssueType.EPIC:
        task.epic_id = None
        task.sprint_id = None
    task.issue_type = new_type


async def _apply_relations(
    task: Task, changes: dict[str, Any], project: Project, actor_id: PydanticObjectId
) -> None:
    if "epic_id" in changes and changes["epic_id"] != task.epic_id:
        new_epic = changes["epic_id"]
        if task.issue_type in task_rules.NON_EPIC_CHILD_TYPES:
            raise BusinessRuleError("This issue type cannot belong to an epic", code="invalid_epic")
        if new_epic is not None:
            await task_rules.validate_epic(project, new_epic)
        old = task.epic_id
        task.epic_id = new_epic
        await _log_relation(task, actor_id, project, "epic", old, new_epic)
    if "version_id" in changes and changes["version_id"] != task.version_id:
        if changes["version_id"] is not None:
            await task_rules.validate_version(project, changes["version_id"])
        old = task.version_id
        task.version_id = changes["version_id"]
        await _log_relation(task, actor_id, project, "version", old, task.version_id)
    if "sprint_id" in changes and changes["sprint_id"] != task.sprint_id:
        await _change_sprint(task, changes["sprint_id"], project, actor_id)


async def _change_sprint(
    task: Task, sprint_id: PydanticObjectId | None, project: Project, actor_id: PydanticObjectId
) -> None:
    if task.issue_type in task_rules.NON_SPRINT_TYPES:
        raise BusinessRuleError(
            "This issue type cannot be planned into a sprint", code="epic_in_sprint"
        )
    if sprint_id is not None:
        await task_rules.validate_sprint(project, sprint_id)
    old = task.sprint_id
    task.sprint_id = sprint_id
    for child in await task_repository.list_children(task.pk):
        child.sprint_id = sprint_id
        await task_repository.save(child)
    await _log_relation(task, actor_id, project, "sprint", old, sprint_id)


async def update_task(auth: AuthContext, ref: str, data: TaskUpdate) -> TaskOut:
    task, context = await load_task(auth, ref)
    _require_edit(task, context)
    project = context.project
    changes = data.changes()
    actor_id = auth.user.pk
    previous_assignee = task.assignee_id
    previous_status = task.status_id
    if "assignee_id" in changes and changes["assignee_id"] != task.assignee_id:
        await task_rules.validate_assignee(project, changes["assignee_id"])
        old = task.assignee_id
        task.assignee_id = changes["assignee_id"]
        _add_watcher(task, task.assignee_id)
        await _log_relation(task, actor_id, project, "assignee", old, task.assignee_id)
    if "label_ids" in changes:
        await task_rules.validate_labels(project, changes["label_ids"])
        task.label_ids = list(dict.fromkeys(changes["label_ids"]))
    if "components" in changes:
        components = task_rules.validate_components(project, changes["components"])
        if components != task.components:
            await activity_service.record(
                task,
                actor_id,
                "updated",
                field="components",
                old_value=", ".join(task.components) or None,
                new_value=", ".join(components) or None,
            )
            task.components = components
    if "issue_type" in changes:
        old_type = task.issue_type
        await _apply_type(task, changes["issue_type"], project)
        if old_type != task.issue_type:
            await activity_service.record(
                task,
                actor_id,
                "updated",
                field="type",
                old_value=old_type.value,
                new_value=task.issue_type.value,
            )
    simple = {k: v for k, v in changes.items() if k in TRACKED_FIELDS and k != "issue_type"}
    if "original_estimate_minutes" in simple and task.remaining_estimate_minutes is None:
        task.remaining_estimate_minutes = simple["original_estimate_minutes"]
    if "due_date" in simple:
        task.overdue_notified = False
    await _apply_simple_fields(task, simple, actor_id)
    await _apply_relations(task, changes, project, actor_id)
    if "status_id" in changes and changes["status_id"] != task.status_id:
        task_rules.validate_status(project, changes["status_id"])
        task_rules.validate_transition(project, task.status_id, changes["status_id"])
        task.status_id = changes["status_id"]
        task_rules.apply_completion(task, project)
        await _append_position(task)
    task.updated_at = utcnow()
    await task_repository.save(task)
    await _after_changes(task, project, actor_id, previous_status, previous_assignee)
    return await build_output(task, actor_id)


async def _after_changes(
    task: Task,
    project: Project,
    actor_id: PydanticObjectId,
    previous_status: str,
    previous_assignee: PydanticObjectId | None,
) -> None:
    if task.status_id != previous_status:
        await _log_status_change(task, project, actor_id, previous_status)
    if task.assignee_id != previous_assignee:
        await notification_service.notify_assignment(task, actor_id, task.assignee_id)
        await automation_service.run_for_task(task, AutomationTrigger.ISSUE_ASSIGNED, actor_id)


async def _log_status_change(
    task: Task, project: Project, actor_id: PydanticObjectId, previous_status: str
) -> None:
    await activity_service.record(
        task,
        actor_id,
        "updated",
        field="status",
        old_value=await _display(project, "status", previous_status),
        new_value=await _display(project, "status", task.status_id),
        old_id=previous_status,
        new_id=task.status_id,
    )
    await notification_service.notify(
        task, actor_id, list(task.watcher_ids), NotificationType.STATUS_CHANGED
    )
    await automation_service.run_for_task(task, AutomationTrigger.STATUS_CHANGED, actor_id)


async def _rebalance_column(project_id: PydanticObjectId, status_id: str) -> None:
    for index, task in enumerate(await task_repository.column(project_id, status_id), start=1):
        task.position = index * POSITION_STEP
        await task_repository.save(task)


async def _neighbor(
    task: Task, neighbor_id: PydanticObjectId | None, status_id: str
) -> Task | None:
    if neighbor_id is None:
        return None
    neighbor = await task_repository.get(neighbor_id)
    if (
        neighbor is None
        or neighbor.pk == task.pk
        or neighbor.project_id != task.project_id
        or neighbor.status_id != status_id
    ):
        raise BusinessRuleError("Invalid neighbouring task", code="invalid_neighbor")
    return neighbor


async def _target_position(task: Task, data: TaskMove) -> float:
    previous = await _neighbor(task, data.previous_task_id, data.status_id)
    following = await _neighbor(task, data.next_task_id, data.status_id)
    if previous is None and following is None:
        first = await task_repository.edge_position(
            task.project_id, data.status_id, task.parent_id, False
        )
        return POSITION_STEP if first is None else first - POSITION_STEP
    if needs_rebalance(
        previous.position if previous else None, following.position if following else None
    ):
        await _rebalance_column(task.project_id, data.status_id)
        previous = await _neighbor(task, data.previous_task_id, data.status_id)
        following = await _neighbor(task, data.next_task_id, data.status_id)
    return position_between(
        previous.position if previous else None, following.position if following else None
    )


async def move_task(auth: AuthContext, ref: str, data: TaskMove) -> TaskOut:
    task, context = await load_task(auth, ref)
    _require_edit(task, context)
    task_rules.validate_status(context.project, data.status_id)
    task_rules.validate_transition(context.project, task.status_id, data.status_id)
    previous_status = task.status_id
    task.position = await _target_position(task, data)
    task.status_id = data.status_id
    task_rules.apply_completion(task, context.project)
    task.updated_at = utcnow()
    await task_repository.save(task)
    if task.status_id != previous_status:
        await _log_status_change(task, context.project, auth.user.pk, previous_status)
    return await build_output(task, auth.user.pk)


async def _rebalance_scope(
    project_id: PydanticObjectId, sprint_id: PydanticObjectId | None
) -> None:
    for index, task in enumerate(
        await task_repository.ranked_scope(project_id, sprint_id), start=1
    ):
        task.rank = index * POSITION_STEP
        await task_repository.save(task)


async def _rank_neighbor(
    task: Task, neighbor_id: PydanticObjectId | None, sprint_id: PydanticObjectId | None
) -> Task | None:
    if neighbor_id is None:
        return None
    neighbor = await task_repository.get(neighbor_id)
    if (
        neighbor is None
        or neighbor.pk == task.pk
        or neighbor.project_id != task.project_id
        or neighbor.sprint_id != sprint_id
    ):
        raise BusinessRuleError("Invalid neighbouring task", code="invalid_neighbor")
    return neighbor


async def rank_task(auth: AuthContext, ref: str, data: TaskRankMove) -> TaskOut:
    task, context = await load_task(auth, ref)
    require(context.role, Permission.SPRINT_MANAGE, "You cannot plan sprints")
    if task.parent_id is not None:
        raise BusinessRuleError("Subtasks follow their parent", code="subtask_inherits")
    target = data.sprint_id if data.change_sprint else task.sprint_id
    previous = await _rank_neighbor(task, data.previous_task_id, target)
    following = await _rank_neighbor(task, data.next_task_id, target)
    if previous is None and following is None:
        scope = await task_repository.ranked_scope(task.project_id, target)
        first = next((item for item in scope if item.pk != task.pk), None)
        rank = POSITION_STEP if first is None else first.rank - POSITION_STEP
    else:
        if needs_rebalance(
            previous.rank if previous else None, following.rank if following else None
        ):
            await _rebalance_scope(task.project_id, target)
            previous = await _rank_neighbor(task, data.previous_task_id, target)
            following = await _rank_neighbor(task, data.next_task_id, target)
        rank = position_between(
            previous.rank if previous else None, following.rank if following else None
        )
    if data.change_sprint and data.sprint_id != task.sprint_id:
        await _change_sprint(task, data.sprint_id, context.project, auth.user.pk)
    task.rank = rank
    task.updated_at = utcnow()
    await task_repository.save(task)
    return await build_output(task, auth.user.pk)


async def purge_tasks(task_ids: list[PydanticObjectId]) -> None:
    storage = get_storage()
    for attachment in await attachment_repository.list_for_tasks(task_ids):
        storage.delete(attachment.storage_key)
    await attachment_repository.delete_by_tasks(task_ids)
    await comment_repository.delete_by_tasks(task_ids)
    await notification_repository.delete_by_tasks(task_ids)
    await worklog_repository.delete_by_tasks(task_ids)
    await issue_link_repository.delete_for_tasks(task_ids)
    await activity_repository.delete_by_tasks(task_ids)
    await doc_repository.unlink_task(task_ids)
    await task_repository.delete_many(task_ids)


async def delete_task(auth: AuthContext, ref: str) -> None:
    task, context = await load_task(auth, ref)
    if not can_delete_task(context.role, auth.user.pk, task.creator_id, task.assignee_id):
        raise ForbiddenError("You can only delete your own tasks", code="permission_denied")
    if task.issue_type == IssueType.EPIC:
        await task_repository.clear_epic(task.pk)
    await purge_tasks([task.pk, *await task_repository.child_ids(task.pk)])


async def set_watching(auth: AuthContext, ref: str, watching: bool) -> TaskOut:
    task, _ = await load_task(auth, ref)
    user_id = auth.user.pk
    if watching and user_id not in task.watcher_ids:
        task.watcher_ids.append(user_id)
    elif not watching and user_id in task.watcher_ids:
        task.watcher_ids.remove(user_id)
    await task_repository.save(task)
    return await build_output(task, user_id)


async def add_checklist_item(auth: AuthContext, ref: str, data: ChecklistCreate) -> TaskOut:
    task, context = await load_task(auth, ref)
    _require_edit(task, context)
    task.checklist.append(ChecklistItem(text=data.text))
    return await _save_checklist(task, auth.user.pk)


async def update_checklist_item(
    auth: AuthContext, ref: str, item_id: str, data: ChecklistUpdate
) -> TaskOut:
    task, context = await load_task(auth, ref)
    _require_edit(task, context)
    item = _find_checklist_item(task, item_id)
    if data.text is not None:
        item.text = data.text
    if data.done is not None:
        item.done = data.done
    return await _save_checklist(task, auth.user.pk)


async def delete_checklist_item(auth: AuthContext, ref: str, item_id: str) -> TaskOut:
    task, context = await load_task(auth, ref)
    _require_edit(task, context)
    task.checklist.remove(_find_checklist_item(task, item_id))
    return await _save_checklist(task, auth.user.pk)


def _find_checklist_item(task: Task, item_id: str) -> ChecklistItem:
    item = next((entry for entry in task.checklist if entry.id == item_id), None)
    if item is None:
        raise NotFoundError("Checklist item not found", code="checklist_item_not_found")
    return item


async def _save_checklist(task: Task, viewer_id: PydanticObjectId) -> TaskOut:
    task.updated_at = utcnow()
    await task_repository.save(task)
    return await build_output(task, viewer_id)


async def get_activity(auth: AuthContext, ref: str) -> list[ActivityOut]:
    task, _ = await load_task(auth, ref)
    return await activity_service.list_for_task(auth, task)
