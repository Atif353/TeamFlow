from beanie import PydanticObjectId

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.automation_rule import AutomationAction, AutomationRule, AutomationTrigger
from app.models.comment import Comment
from app.models.notification import NotificationType
from app.models.project import Project
from app.models.task import Priority, Task
from app.permissions.context import AuthContext
from app.permissions.matrix import Permission
from app.permissions.policies import require
from app.repositories.automation_repository import automation_repository
from app.repositories.comment_repository import comment_repository
from app.repositories.task_repository import task_repository
from app.schemas.automation import AutomationRuleCreate, AutomationRuleOut, AutomationRuleUpdate
from app.services import notification_service, project_service
from app.utils.object_id import to_object_id
from app.utils.time import utcnow


def _matches(rule: AutomationRule, task: Task) -> bool:
    if rule.trigger == AutomationTrigger.STATUS_CHANGED:
        return rule.trigger_status_id == task.status_id
    return True


async def _apply(rule: AutomationRule, task: Task, actor_id: PydanticObjectId) -> None:
    if rule.action == AutomationAction.NOTIFY_ASSIGNEE and task.assignee_id:
        await notification_service.notify(
            task, actor_id, [task.assignee_id], NotificationType.STATUS_CHANGED
        )
    elif rule.action == AutomationAction.NOTIFY_WATCHERS:
        await notification_service.notify(
            task, actor_id, list(task.watcher_ids), NotificationType.STATUS_CHANGED
        )
    elif rule.action == AutomationAction.SET_PRIORITY and rule.action_value:
        task.set_priority(Priority(rule.action_value))
        await task_repository.save(task)
    elif rule.action == AutomationAction.FLAG_ISSUE:
        task.flagged = True
        await task_repository.save(task)
    elif rule.action == AutomationAction.ADD_COMMENT and rule.action_value:
        await comment_repository.insert(
            Comment(
                task_id=task.pk,
                project_id=task.project_id,
                author_id=actor_id,
                body=rule.action_value,
            )
        )


async def run_for_task(task: Task, trigger: AutomationTrigger, actor_id: PydanticObjectId) -> None:
    for rule in await automation_repository.enabled_for_trigger(task.project_id, trigger):
        if not _matches(rule, task):
            continue
        await _apply(rule, task, actor_id)
        rule.run_count += 1
        await automation_repository.save(rule)


def _validate_rule(project: Project, data: AutomationRuleCreate) -> None:
    if data.trigger_status_id and project.status_by_id(data.trigger_status_id) is None:
        raise BusinessRuleError("Unknown status for this project", code="invalid_status")
    if data.action == AutomationAction.SET_PRIORITY:
        try:
            Priority(data.action_value or "")
        except ValueError as error:
            raise BusinessRuleError("Unknown priority", code="invalid_priority") from error


async def list_rules(auth: AuthContext, project_id: str) -> list[AutomationRuleOut]:
    context = await project_service.get_context(auth, project_id)
    rules = await automation_repository.list_for_project(context.project.pk)
    return [AutomationRuleOut.model_validate(rule) for rule in rules]


async def create_rule(
    auth: AuthContext, project_id: str, data: AutomationRuleCreate
) -> AutomationRuleOut:
    context = await project_service.get_context(auth, project_id)
    require(context.role, Permission.AUTOMATION_MANAGE, "You cannot manage automation rules")
    _validate_rule(context.project, data)
    rule = await automation_repository.insert(
        AutomationRule(project_id=context.project.pk, created_by=auth.user.pk, **data.model_dump())
    )
    return AutomationRuleOut.model_validate(rule)


async def _load_rule(auth: AuthContext, rule_id: str) -> AutomationRule:
    rule = await automation_repository.get(to_object_id(rule_id))
    if rule is None:
        raise NotFoundError("Automation rule not found", code="rule_not_found")
    context = await project_service.get_context(auth, str(rule.project_id))
    require(context.role, Permission.AUTOMATION_MANAGE, "You cannot manage automation rules")
    return rule


async def update_rule(
    auth: AuthContext, rule_id: str, data: AutomationRuleUpdate
) -> AutomationRuleOut:
    rule = await _load_rule(auth, rule_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    await automation_repository.save(rule)
    return AutomationRuleOut.model_validate(rule)


async def delete_rule(auth: AuthContext, rule_id: str) -> None:
    rule = await _load_rule(auth, rule_id)
    await automation_repository.delete(rule)


async def notify_overdue_tasks() -> int:
    now = utcnow()
    count = 0
    for task in await task_repository.overdue_unnotified(now):
        if task.assignee_id:
            await notification_service.notify(
                task, None, [task.assignee_id], NotificationType.TASK_OVERDUE
            )
        task.overdue_notified = True
        await task_repository.save(task)
        count += 1
    return count
