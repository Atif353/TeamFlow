from beanie import PydanticObjectId

from app.models.version import Version
from app.repositories.base import ASC, BaseRepository


class VersionRepository(BaseRepository[Version]):
    def __init__(self) -> None:
        super().__init__(Version)

    async def list_for_project(self, project_id: PydanticObjectId) -> list[Version]:
        return (
            await Version.find({"project_id": project_id})
            .sort([("release_date", ASC), ("created_at", ASC)])
            .to_list()
        )

    async def get_by_name(self, project_id: PydanticObjectId, name: str) -> Version | None:
        return await Version.find_one({"project_id": project_id, "name": name})

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await Version.find({"project_id": project_id}).delete()


version_repository = VersionRepository()
