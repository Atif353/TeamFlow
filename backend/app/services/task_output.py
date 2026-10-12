from beanie import PydanticObjectId

from app.models.project import Project
from app.models.task import Task
from app.repositories.issue_link_repository import issue_link_repository
from app.repositories.label_repository import label_repository
from app.repositories.project_repository import project_repository
from app.repositories.sprint_repository import sprint_repository
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.repositories.version_repository import version_repository
from app.schemas.common import UserBrief
from app.schemas.label import LabelOut
from app.schemas.task import (
    ChecklistItemOut,
    IssueBrief,
    SprintBrief,
    TaskOut,
    VersionBrief,
)
from app.utils.time import datetime_to_date

WATCHER_PREVIEW_LIMIT = 20


def issue_key(project: Project, task: Task) -> str:
    return f"{project.key}-{task.issue_number}"


def brief_of(task: Task, project: Project) -> IssueBrief:
    return IssueBrief(
        id=task.pk,
        key=issue_key(project, task),
        title=task.title,
        issue_type=task.issue_type,
        status_id=task.status_id,
        priority=task.priority,
        done=task.completed_at is not None,
    )


async def _blocked_counts(tasks: list[Task]) -> dict[PydanticObjectId, int]:
    links = await issue_link_repository.blockers_of([task.pk for task in tasks])
    if not links:
        return {}
    blockers = {
        blocker.pk: blocker
        for blocker in await task_repository.find_by_ids(link.source_id for link in links)
    }
    counts: dict[PydanticObjectId, int] = {}
    for link in links:
        blocker = blockers.get(link.source_id)
        if blocker is not None and blocker.completed_at is None:
            counts[link.target_id] = counts.get(link.target_id, 0) + 1
    return counts


async def build_outputs(tasks: list[Task], viewer_id: PydanticObjectId) -> list[TaskOut]:
    if not tasks:
        return []
    projects = {
        project.pk: project
        for project in await project_repository.find_by_ids(t.project_id for t in tasks)
    }
    user_ids = [t.creator_id for t in tasks] + [t.assignee_id for t in tasks if t.assignee_id]
    user_ids += [uid for t in tasks for uid in t.watcher_ids[:WATCHER_PREVIEW_LIMIT]]
    users = {user.pk: user for user in await user_repository.find_by_ids(user_ids)}
    labels = {
        label.pk: label
        for label in await label_repository.find_by_ids(
            label_id for task in tasks for label_id in task.label_ids
        )
    }
    related_ids = [t.parent_id for t in tasks if t.parent_id] + [
        t.epic_id for t in tasks if t.epic_id
    ]
    related = {task.pk: task for task in await task_repository.find_by_ids(related_ids)}
    sprints = {
        sprint.pk: sprint
        for sprint in await sprint_repository.find_by_ids(t.sprint_id for t in tasks if t.sprint_id)
    }
    versions = {
        version.pk: version
        for version in await version_repository.find_by_ids(
            t.version_id for t in tasks if t.version_id
        )
    }
    task_ids = [task.pk for task in tasks]
    subtask_counts = await task_repository.subtask_counts(task_ids)
    epic_counts = await task_repository.epic_counts(task_ids)
    blocked = await _blocked_counts(tasks)
    outputs: list[TaskOut] = []
    for task in tasks:
        project = projects[task.project_id]
        subtask_total, subtask_done = subtask_counts.get(task.pk, (0, 0))
        child_total, child_done = epic_counts.get(task.pk, (0, 0))
        parent = related.get(task.parent_id) if task.parent_id else None
        epic = related.get(task.epic_id) if task.epic_id else None
        sprint = sprints.get(task.sprint_id) if task.sprint_id else None
        version = versions.get(task.version_id) if task.version_id else None
        assignee = users.get(task.assignee_id) if task.assignee_id else None
        creator = users.get(task.creator_id)
        outputs.append(
            TaskOut(
                id=task.pk,
                key=issue_key(project, task),
                issue_number=task.issue_number,
                issue_type=task.issue_type,
                project_id=task.project_id,
                parent_id=task.parent_id,
                parent=brief_of(parent, project) if parent else None,
                epic_id=task.epic_id,
                epic=brief_of(epic, project) if epic else None,
                sprint_id=task.sprint_id,
                sprint=SprintBrief.model_validate(sprint) if sprint else None,
                version_id=task.version_id,
                version=VersionBrief.model_validate(version) if version else None,
                title=task.title,
                description=task.description,
                environment=task.environment,
                status_id=task.status_id,
                priority=task.priority,
                assignee_id=task.assignee_id,
                assignee=UserBrief.from_user(assignee) if assignee else None,
                creator_id=task.creator_id,
                creator=UserBrief.from_user(creator) if creator else None,
                start_date=datetime_to_date(task.start_date),
                due_date=datetime_to_date(task.due_date),
                labels=[
                    LabelOut.model_validate(labels[label_id])
                    for label_id in task.label_ids
                    if label_id in labels
                ],
                components=list(task.components),
                checklist=[ChecklistItemOut.model_validate(item) for item in task.checklist],
                checklist_total=len(task.checklist),
                checklist_done=sum(1 for item in task.checklist if item.done),
                subtask_total=subtask_total,
                subtask_done=subtask_done,
                child_total=child_total,
                child_done=child_done,
                story_points=task.story_points,
                original_estimate_minutes=task.original_estimate_minutes,
                remaining_estimate_minutes=task.remaining_estimate_minutes,
                time_spent_minutes=task.time_spent_minutes,
                flagged=task.flagged,
                watchers=[
                    UserBrief.from_user(users[uid])
                    for uid in task.watcher_ids[:WATCHER_PREVIEW_LIMIT]
                    if uid in users
                ],
                is_watching=viewer_id in task.watcher_ids,
                blocked_by_open=blocked.get(task.pk, 0),
                position=task.position,
                rank=task.rank,
                completed_at=task.completed_at,
                created_at=task.created_at,
                updated_at=task.updated_at,
            )
        )
    return outputs


async def build_output(task: Task, viewer_id: PydanticObjectId) -> TaskOut:
    [output] = await build_outputs([task], viewer_id)
    return output
