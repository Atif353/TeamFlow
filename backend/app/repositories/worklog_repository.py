from datetime import datetime

from beanie import PydanticObjectId

from app.models.worklog import Worklog
from app.repositories.base import ASC, DESC, BaseRepository


class WorklogRepository(BaseRepository[Worklog]):
    def __init__(self) -> None:
        super().__init__(Worklog)

    async def list_for_task(self, task_id: PydanticObjectId) -> list[Worklog]:
        return await Worklog.find({"task_id": task_id}).sort([("started_at", DESC)]).to_list()

    async def for_project_since(
        self, project_id: PydanticObjectId, since: datetime
    ) -> list[Worklog]:
        return (
            await Worklog.find({"project_id": project_id, "started_at": {"$gte": since}})
            .sort([("started_at", ASC)])
            .to_list()
        )

    async def for_user_since(self, user_id: PydanticObjectId, since: datetime) -> list[Worklog]:
        return (
            await Worklog.find({"author_id": user_id, "started_at": {"$gte": since}})
            .sort([("started_at", ASC)])
            .to_list()
        )

    async def for_projects_since(
        self, project_ids: list[PydanticObjectId], since: datetime
    ) -> list[Worklog]:
        if not project_ids:
            return []
        return await Worklog.find(
            {"project_id": {"$in": project_ids}, "started_at": {"$gte": since}}
        ).to_list()

    async def delete_by_tasks(self, task_ids: list[PydanticObjectId]) -> None:
        if task_ids:
            await Worklog.find({"task_id": {"$in": task_ids}}).delete()

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await Worklog.find({"project_id": project_id}).delete()


worklog_repository = WorklogRepository()
