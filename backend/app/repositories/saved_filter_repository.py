from beanie import PydanticObjectId

from app.models.saved_filter import SavedFilter
from app.repositories.base import ASC, BaseRepository


class SavedFilterRepository(BaseRepository[SavedFilter]):
    def __init__(self) -> None:
        super().__init__(SavedFilter)

    async def list_for_user(
        self, user_id: PydanticObjectId, project_id: PydanticObjectId
    ) -> list[SavedFilter]:
        return (
            await SavedFilter.find({"user_id": user_id, "project_id": project_id})
            .sort([("created_at", ASC)])
            .to_list()
        )

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await SavedFilter.find({"project_id": project_id}).delete()


saved_filter_repository = SavedFilterRepository()
