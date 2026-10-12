from beanie import PydanticObjectId

from app.models.comment import Comment
from app.repositories.base import ASC, BaseRepository


class CommentRepository(BaseRepository[Comment]):
    def __init__(self) -> None:
        super().__init__(Comment)

    async def list_for_task(
        self, task_id: PydanticObjectId, skip: int, limit: int
    ) -> tuple[list[Comment], int]:
        query = {"task_id": task_id}
        total = await Comment.find(query).count()
        items = (
            await Comment.find(query)
            .sort([("created_at", ASC), ("_id", ASC)])
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return items, total

    async def delete_by_tasks(self, task_ids: list[PydanticObjectId]) -> None:
        if task_ids:
            await Comment.find({"task_id": {"$in": task_ids}}).delete()

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await Comment.find({"project_id": project_id}).delete()


comment_repository = CommentRepository()
