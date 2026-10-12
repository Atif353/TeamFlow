from app.models.project import Project
from app.models.task import IssueType, Task
from app.repositories.base import ASC
from app.utils.positions import POSITION_STEP


async def backfill_issue_numbers() -> None:
    for project in await Project.find_all().to_list():
        pending = (
            await Task.find({"project_id": project.pk, "issue_number": 0})
            .sort([("created_at", ASC), ("_id", ASC)])
            .to_list()
        )
        if not pending:
            continue
        existing = await Task.find({"project_id": project.pk, "issue_number": {"$gt": 0}}).to_list()
        counter = max([project.issue_counter, *(task.issue_number for task in existing)])
        for task in pending:
            counter += 1
            task.issue_number = counter
            if task.parent_id is not None:
                task.issue_type = IssueType.SUBTASK
            if task.rank == 0:
                task.rank = counter * POSITION_STEP
            await task.save()
        project.issue_counter = counter
        await project.save()


async def run_migrations() -> None:
    await backfill_issue_numbers()
