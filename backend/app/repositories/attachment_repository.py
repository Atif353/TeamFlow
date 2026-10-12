from beanie import PydanticObjectId

from app.models.attachment import Attachment
from app.repositories.base import ASC, BaseRepository


class AttachmentRepository(BaseRepository[Attachment]):
    def __init__(self) -> None:
        super().__init__(Attachment)

    async def list_for_task(self, task_id: PydanticObjectId) -> list[Attachment]:
        return await Attachment.find({"task_id": task_id}).sort([("created_at", ASC)]).to_list()

    async def list_for_tasks(self, task_ids: list[PydanticObjectId]) -> list[Attachment]:
        if not task_ids:
            return []
        return await Attachment.find({"task_id": {"$in": task_ids}}).to_list()

    async def list_for_project(self, project_id: PydanticObjectId) -> list[Attachment]:
        return await Attachment.find({"project_id": project_id}).to_list()

    async def delete_by_tasks(self, task_ids: list[PydanticObjectId]) -> None:
        if task_ids:
            await Attachment.find({"task_id": {"$in": task_ids}}).delete()

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await Attachment.find({"project_id": project_id}).delete()


attachment_repository = AttachmentRepository()
