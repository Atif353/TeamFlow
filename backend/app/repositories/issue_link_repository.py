from beanie import PydanticObjectId

from app.models.issue_link import IssueLink, LinkType
from app.repositories.base import ASC, BaseRepository


class IssueLinkRepository(BaseRepository[IssueLink]):
    def __init__(self) -> None:
        super().__init__(IssueLink)

    async def for_task(self, task_id: PydanticObjectId) -> list[IssueLink]:
        return (
            await IssueLink.find({"$or": [{"source_id": task_id}, {"target_id": task_id}]})
            .sort([("created_at", ASC)])
            .to_list()
        )

    async def exists_between(
        self, source_id: PydanticObjectId, target_id: PydanticObjectId, link_type: LinkType
    ) -> bool:
        return (
            await IssueLink.find_one(
                {
                    "link_type": link_type.value,
                    "$or": [
                        {"source_id": source_id, "target_id": target_id},
                        {"source_id": target_id, "target_id": source_id},
                    ],
                }
            )
            is not None
        )

    async def blocking_edges(self, project_id: PydanticObjectId) -> list[IssueLink]:
        return await IssueLink.find(
            {"project_id": project_id, "link_type": LinkType.BLOCKS.value}
        ).to_list()

    async def blockers_of(self, task_ids: list[PydanticObjectId]) -> list[IssueLink]:
        if not task_ids:
            return []
        return await IssueLink.find(
            {"target_id": {"$in": task_ids}, "link_type": LinkType.BLOCKS.value}
        ).to_list()

    async def delete_for_tasks(self, task_ids: list[PydanticObjectId]) -> None:
        if task_ids:
            await IssueLink.find(
                {"$or": [{"source_id": {"$in": task_ids}}, {"target_id": {"$in": task_ids}}]}
            ).delete()

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await IssueLink.find({"project_id": project_id}).delete()


issue_link_repository = IssueLinkRepository()
