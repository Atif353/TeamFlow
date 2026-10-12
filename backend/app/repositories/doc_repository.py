from typing import Any

from beanie import PydanticObjectId

from app.models.doc import Doc
from app.repositories.base import DESC, BaseRepository, contains_pattern


class DocRepository(BaseRepository[Doc]):
    def __init__(self) -> None:
        super().__init__(Doc)

    async def list_for_project(
        self, project_id: PydanticObjectId, q: str | None, skip: int, limit: int
    ) -> tuple[list[Doc], int]:
        query: dict[str, Any] = {"project_id": project_id}
        if q:
            query["title"] = contains_pattern(q)
        total = await Doc.find(query).count()
        items = (
            await Doc.find(query)
            .sort([("updated_at", DESC), ("_id", DESC)])
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return items, total

    async def linked_to_task(self, task_id: PydanticObjectId) -> list[Doc]:
        return await Doc.find({"linked_task_ids": task_id}).to_list()

    async def search_titles(
        self, project_ids: list[PydanticObjectId], q: str, limit: int
    ) -> list[Doc]:
        if not project_ids:
            return []
        return (
            await Doc.find({"project_id": {"$in": project_ids}, "title": contains_pattern(q)})
            .limit(limit)
            .to_list()
        )

    async def unlink_task(self, task_ids: list[PydanticObjectId]) -> None:
        if task_ids:
            await Doc.find({"linked_task_ids": {"$in": task_ids}}).update(
                {"$pull": {"linked_task_ids": {"$in": task_ids}}}
            )

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await Doc.find({"project_id": project_id}).delete()


doc_repository = DocRepository()
