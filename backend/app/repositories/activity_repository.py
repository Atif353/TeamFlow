from datetime import datetime

from beanie import PydanticObjectId

from app.models.activity_log import ActivityLog
from app.repositories.base import ASC, DESC, BaseRepository


class ActivityRepository(BaseRepository[ActivityLog]):
    def __init__(self) -> None:
        super().__init__(ActivityLog)

    async def list_for_task(self, task_id: PydanticObjectId) -> list[ActivityLog]:
        return await ActivityLog.find({"task_id": task_id}).sort([("created_at", DESC)]).to_list()

    async def recent_for_projects(
        self, project_ids: list[PydanticObjectId], limit: int
    ) -> list[ActivityLog]:
        if not project_ids:
            return []
        return (
            await ActivityLog.find({"project_id": {"$in": project_ids}})
            .sort([("created_at", DESC)])
            .limit(limit)
            .to_list()
        )

    async def status_changes_since(
        self, project_id: PydanticObjectId, since: datetime
    ) -> list[ActivityLog]:
        return (
            await ActivityLog.find(
                {"project_id": project_id, "field": "status", "created_at": {"$gte": since}}
            )
            .sort([("created_at", ASC)])
            .to_list()
        )

    async def all_status_events(self, project_id: PydanticObjectId) -> list[ActivityLog]:
        return (
            await ActivityLog.find({"project_id": project_id, "field": "status"})
            .sort([("created_at", ASC)])
            .to_list()
        )

    async def delete_by_tasks(self, task_ids: list[PydanticObjectId]) -> None:
        if task_ids:
            await ActivityLog.find({"task_id": {"$in": task_ids}}).delete()

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await ActivityLog.find({"project_id": project_id}).delete()


activity_repository = ActivityRepository()
