from datetime import datetime
from typing import Any

from beanie import PydanticObjectId

from app.models.audit_log import AuditLog
from app.repositories.base import DESC, BaseRepository, contains_pattern


class AuditRepository(BaseRepository[AuditLog]):
    def __init__(self) -> None:
        super().__init__(AuditLog)

    async def search(
        self,
        workspace_id: PydanticObjectId,
        action: str | None,
        actor_id: PydanticObjectId | None,
        q: str | None,
        since: datetime | None,
        skip: int,
        limit: int,
    ) -> tuple[list[AuditLog], int]:
        query: dict[str, Any] = {"workspace_id": workspace_id}
        if action:
            query["action"] = action
        if actor_id:
            query["actor_id"] = actor_id
        if q:
            query["summary"] = contains_pattern(q)
        if since:
            query["created_at"] = {"$gte": since}
        total = await AuditLog.find(query).count()
        items = (
            await AuditLog.find(query)
            .sort([("created_at", DESC), ("_id", DESC)])
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return items, total

    async def distinct_actions(self, workspace_id: PydanticObjectId) -> list[str]:
        rows = await AuditLog.aggregate(
            [{"$match": {"workspace_id": workspace_id}}, {"$group": {"_id": "$action"}}]
        ).to_list()
        return sorted(str(row["_id"]) for row in rows)


audit_repository = AuditRepository()
