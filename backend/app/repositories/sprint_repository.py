from beanie import PydanticObjectId

from app.models.sprint import Sprint, SprintState
from app.repositories.base import ASC, DESC, BaseRepository


class SprintRepository(BaseRepository[Sprint]):
    def __init__(self) -> None:
        super().__init__(Sprint)

    async def list_for_project(
        self, project_id: PydanticObjectId, states: list[SprintState] | None = None
    ) -> list[Sprint]:
        query: dict[str, object] = {"project_id": project_id}
        if states:
            query["state"] = {"$in": [state.value for state in states]}
        return await Sprint.find(query).sort([("created_at", ASC), ("_id", ASC)]).to_list()

    async def active_for_project(self, project_id: PydanticObjectId) -> Sprint | None:
        return await Sprint.find_one({"project_id": project_id, "state": SprintState.ACTIVE.value})

    async def recent_completed(self, project_id: PydanticObjectId, limit: int) -> list[Sprint]:
        return (
            await Sprint.find({"project_id": project_id, "state": SprintState.COMPLETED.value})
            .sort([("completed_at", DESC)])
            .limit(limit)
            .to_list()
        )

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await Sprint.find({"project_id": project_id}).delete()


sprint_repository = SprintRepository()
