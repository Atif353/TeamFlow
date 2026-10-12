import re

from app.core.exceptions import NotFoundError
from app.models.task import Task
from app.permissions.context import AuthContext, ProjectContext
from app.repositories.project_repository import project_repository
from app.repositories.task_repository import task_repository
from app.services import project_service
from app.utils.object_id import to_object_id

ISSUE_KEY = re.compile(r"^([A-Za-z][A-Za-z0-9]*)-(\d+)$")


async def find_task(auth: AuthContext, ref: str) -> Task:
    match = ISSUE_KEY.match(ref)
    task: Task | None
    if match:
        project = await project_repository.get_by_key(auth.workspace_id, match.group(1).upper())
        task = (
            await task_repository.get_by_number(project.pk, int(match.group(2)))
            if project
            else None
        )
    else:
        task = await task_repository.get(to_object_id(ref))
    if task is None:
        raise NotFoundError("Task not found", code="task_not_found")
    return task


async def load_task(auth: AuthContext, ref: str) -> tuple[Task, ProjectContext]:
    task = await find_task(auth, ref)
    context = await project_service.get_context(auth, str(task.project_id))
    return task, context
