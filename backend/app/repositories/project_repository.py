from typing import Any

from beanie import PydanticObjectId
from pymongo import ReturnDocument

from app.models.project import Project
from app.models.project_member import ProjectMember
from app.repositories.base import ASC, DESC, BaseRepository, contains_pattern


class ProjectRepository(BaseRepository[Project]):
    def __init__(self) -> None:
        super().__init__(Project)

    async def get_by_key(self, workspace_id: PydanticObjectId, key: str) -> Project | None:
        return await Project.find_one({"workspace_id": workspace_id, "key": key})

    async def list_in_workspace(
        self,
        workspace_id: PydanticObjectId,
        visible_ids: list[PydanticObjectId] | None,
        q: str | None,
        skip: int,
        limit: int,
    ) -> tuple[list[Project], int]:
        query: dict[str, Any] = {"workspace_id": workspace_id}
        if visible_ids is not None:
            query["_id"] = {"$in": visible_ids}
        if q:
            query["$or"] = [{"name": contains_pattern(q)}, {"key": contains_pattern(q)}]
        total = await Project.find(query).count()
        items = (
            await Project.find(query)
            .sort([("updated_at", DESC), ("_id", DESC)])
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return items, total

    async def next_issue_number(self, project_id: PydanticObjectId) -> int:
        document = await Project.get_pymongo_collection().find_one_and_update(
            {"_id": project_id},
            {"$inc": {"issue_counter": 1}},
            return_document=ReturnDocument.AFTER,
        )
        assert document is not None
        return int(document["issue_counter"])

    async def ids_in_workspace(self, workspace_id: PydanticObjectId) -> list[PydanticObjectId]:
        projects = await Project.find({"workspace_id": workspace_id}).to_list()
        return [project.pk for project in projects]

    async def count_in_workspace(self, workspace_id: PydanticObjectId) -> int:
        return await Project.find({"workspace_id": workspace_id}).count()

    async def add_member(self, member: ProjectMember) -> ProjectMember:
        await member.insert()
        return member

    async def save_member(self, member: ProjectMember) -> ProjectMember:
        await member.save()
        return member

    async def get_member(
        self, project_id: PydanticObjectId, user_id: PydanticObjectId
    ) -> ProjectMember | None:
        return await ProjectMember.find_one({"project_id": project_id, "user_id": user_id})

    async def list_members(
        self, project_id: PydanticObjectId, skip: int, limit: int
    ) -> tuple[list[ProjectMember], int]:
        query = {"project_id": project_id}
        total = await ProjectMember.find(query).count()
        items = (
            await ProjectMember.find(query)
            .sort([("created_at", ASC), ("_id", ASC)])
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return items, total

    async def all_members(self, project_id: PydanticObjectId) -> list[ProjectMember]:
        return await ProjectMember.find({"project_id": project_id}).to_list()

    async def members_of_projects(self, project_ids: list[PydanticObjectId]) -> list[ProjectMember]:
        if not project_ids:
            return []
        return (
            await ProjectMember.find({"project_id": {"$in": project_ids}})
            .sort([("created_at", ASC), ("_id", ASC)])
            .to_list()
        )

    async def memberships_for_user(self, user_id: PydanticObjectId) -> list[ProjectMember]:
        return await ProjectMember.find({"user_id": user_id}).to_list()

    async def project_ids_for_user(self, user_id: PydanticObjectId) -> list[PydanticObjectId]:
        return [member.project_id for member in await self.memberships_for_user(user_id)]

    async def remove_member(self, member: ProjectMember) -> None:
        await member.delete()

    async def delete_members_of_project(self, project_id: PydanticObjectId) -> None:
        await ProjectMember.find({"project_id": project_id}).delete()

    async def project_counts_for_users(
        self, user_ids: list[PydanticObjectId]
    ) -> dict[PydanticObjectId, int]:
        if not user_ids:
            return {}
        rows = await ProjectMember.aggregate(
            [
                {"$match": {"user_id": {"$in": user_ids}}},
                {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
            ]
        ).to_list()
        return {row["_id"]: row["count"] for row in rows}


project_repository = ProjectRepository()
