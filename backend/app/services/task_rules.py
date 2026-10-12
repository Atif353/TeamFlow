from beanie import PydanticObjectId

from app.core.exceptions import BusinessRuleError
from app.models.project import Project
from app.models.sprint import Sprint, SprintState
from app.models.task import IssueType, Task
from app.repositories.label_repository import label_repository
from app.repositories.project_repository import project_repository
from app.repositories.sprint_repository import sprint_repository
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.repositories.version_repository import version_repository
from app.utils.time import utcnow

NON_PARENT_TYPES = (IssueType.EPIC, IssueType.SUBTASK)
NON_EPIC_CHILD_TYPES = (IssueType.EPIC, IssueType.SUBTASK)
NON_SPRINT_TYPES = (IssueType.EPIC, IssueType.SUBTASK)


async def validate_assignee(project: Project, assignee_id: PydanticObjectId | None) -> None:
    if assignee_id is None:
        return
    member = await project_repository.get_member(project.pk, assignee_id)
    user = await user_repository.get(assignee_id)
    if member is None or user is None or not user.is_active:
        raise BusinessRuleError(
            "Assignee must be a member of the project", code="assignee_not_project_member"
        )


async def validate_labels(project: Project, label_ids: list[PydanticObjectId]) -> None:
    unique = list(set(label_ids))
    if unique and await label_repository.count_in_project(project.pk, unique) != len(unique):
        raise BusinessRuleError("Unknown label for this project", code="invalid_label")


def validate_status(project: Project, status_id: str) -> None:
    if project.status_by_id(status_id) is None:
        raise BusinessRuleError("Unknown status for this project", code="invalid_status")


def validate_components(project: Project, components: list[str]) -> list[str]:
    unique = list(dict.fromkeys(components))
    unknown = [name for name in unique if name not in project.components]
    if unknown:
        raise BusinessRuleError(
            "Unknown component for this project",
            code="invalid_component",
            details={"names": unknown},
        )
    return unique


def validate_transition(project: Project, source_id: str, target_id: str) -> None:
    if not project.allows_transition(source_id, target_id):
        raise BusinessRuleError(
            "This workflow does not allow that status change",
            code="transition_not_allowed",
            details={"from": source_id, "to": target_id},
        )


async def validate_sprint(project: Project, sprint_id: PydanticObjectId) -> Sprint:
    sprint = await sprint_repository.get(sprint_id)
    if sprint is None or sprint.project_id != project.pk:
        raise BusinessRuleError("Sprint not found in this project", code="invalid_sprint")
    if sprint.state == SprintState.COMPLETED:
        raise BusinessRuleError("Completed sprints cannot receive issues", code="sprint_completed")
    return sprint


async def validate_epic(project: Project, epic_id: PydanticObjectId) -> Task:
    epic = await task_repository.get(epic_id)
    if epic is None or epic.project_id != project.pk or epic.issue_type != IssueType.EPIC:
        raise BusinessRuleError("Epic not found in this project", code="invalid_epic")
    return epic


async def validate_version(project: Project, version_id: PydanticObjectId) -> None:
    version = await version_repository.get(version_id)
    if version is None or version.project_id != project.pk:
        raise BusinessRuleError("Version not found in this project", code="invalid_version")


async def validate_parent(project: Project, parent_id: PydanticObjectId) -> Task:
    parent = await task_repository.get(parent_id)
    if parent is None or parent.project_id != project.pk:
        raise BusinessRuleError("Parent task not found in this project", code="invalid_parent")
    if parent.parent_id is not None:
        raise BusinessRuleError("Subtasks cannot have subtasks", code="subtask_depth_exceeded")
    if parent.issue_type in NON_PARENT_TYPES:
        raise BusinessRuleError(
            "Epics cannot have subtasks; link issues to the epic instead",
            code="invalid_parent_type",
        )
    return parent


def apply_completion(task: Task, project: Project) -> None:
    is_done = task.status_id in project.done_status_ids
    if is_done and task.completed_at is None:
        task.completed_at = utcnow()
    elif not is_done:
        task.completed_at = None
