import re

from beanie import PydanticObjectId

from app.models.label import Label
from app.repositories.base import ASC, BaseRepository


class LabelRepository(BaseRepository[Label]):
    def __init__(self) -> None:
        super().__init__(Label)

    async def list_for_project(self, project_id: PydanticObjectId) -> list[Label]:
        return await Label.find({"project_id": project_id}).sort([("name", ASC)]).to_list()

    async def get_by_name(self, project_id: PydanticObjectId, name: str) -> Label | None:
        pattern = {"$regex": f"^{re.escape(name)}$", "$options": "i"}
        return await Label.find_one({"project_id": project_id, "name": pattern})

    async def count_in_project(
        self, project_id: PydanticObjectId, label_ids: list[PydanticObjectId]
    ) -> int:
        return await Label.find({"project_id": project_id, "_id": {"$in": label_ids}}).count()

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await Label.find({"project_id": project_id}).delete()


label_repository = LabelRepository()
