from typing import Any

from beanie import PydanticObjectId

from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember
from app.permissions.roles import Role
from app.repositories.base import ASC, BaseRepository


class WorkspaceRepository(BaseRepository[Workspace]):
    def __init__(self) -> None:
        super().__init__(Workspace)

    async def add_member(self, member: WorkspaceMember) -> WorkspaceMember:
        await member.insert()
        return member

    async def save_member(self, member: WorkspaceMember) -> WorkspaceMember:
        await member.save()
        return member

    async def get_member(self, user_id: PydanticObjectId) -> WorkspaceMember | None:
        return await WorkspaceMember.find_one({"user_id": user_id})

    async def get_members_for_users(
        self, user_ids: list[PydanticObjectId]
    ) -> list[WorkspaceMember]:
        if not user_ids:
            return []
        return await WorkspaceMember.find({"user_id": {"$in": user_ids}}).to_list()

    async def list_members(
        self,
        workspace_id: PydanticObjectId,
        roles: list[Role] | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[WorkspaceMember]:
        return (
            await WorkspaceMember.find(self._member_query(workspace_id, roles))
            .sort([("created_at", ASC), ("_id", ASC)])
            .skip(skip)
            .limit(limit)
            .to_list()
        )

    async def count_members(
        self, workspace_id: PydanticObjectId, roles: list[Role] | None = None
    ) -> int:
        return await WorkspaceMember.find(self._member_query(workspace_id, roles)).count()

    async def member_user_ids(
        self, workspace_id: PydanticObjectId, roles: list[Role] | None = None
    ) -> list[PydanticObjectId]:
        members = await WorkspaceMember.find(self._member_query(workspace_id, roles)).to_list()
        return [member.user_id for member in members]

    async def count_by_role(self, workspace_id: PydanticObjectId) -> dict[str, int]:
        rows = await WorkspaceMember.aggregate(
            [
                {"$match": {"workspace_id": workspace_id}},
                {"$group": {"_id": "$role", "count": {"$sum": 1}}},
            ]
        ).to_list()
        return {row["_id"]: row["count"] for row in rows}

    @staticmethod
    def _member_query(workspace_id: PydanticObjectId, roles: list[Role] | None) -> dict[str, Any]:
        query: dict[str, Any] = {"workspace_id": workspace_id}
        if roles:
            query["role"] = {"$in": [role.value for role in roles]}
        return query


workspace_repository = WorkspaceRepository()
