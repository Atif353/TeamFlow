from typing import Any

from beanie import PydanticObjectId

from app.models.notification import Notification
from app.repositories.base import DESC, BaseRepository, modified_count


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self) -> None:
        super().__init__(Notification)

    async def list_for_user(
        self, user_id: PydanticObjectId, unread_only: bool, skip: int, limit: int
    ) -> tuple[list[Notification], int]:
        query: dict[str, Any] = {"user_id": user_id}
        if unread_only:
            query["is_read"] = False
        total = await Notification.find(query).count()
        items = (
            await Notification.find(query)
            .sort([("created_at", DESC), ("_id", DESC)])
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return items, total

    async def unread_count(self, user_id: PydanticObjectId) -> int:
        return await Notification.find({"user_id": user_id, "is_read": False}).count()

    async def mark_all_read(self, user_id: PydanticObjectId) -> int:
        result = await Notification.find({"user_id": user_id, "is_read": False}).update(
            {"$set": {"is_read": True}}
        )
        return modified_count(result)

    async def delete_by_tasks(self, task_ids: list[PydanticObjectId]) -> None:
        if task_ids:
            await Notification.find({"task_id": {"$in": task_ids}}).delete()

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await Notification.find({"project_id": project_id}).delete()


notification_repository = NotificationRepository()
