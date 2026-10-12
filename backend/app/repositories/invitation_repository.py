from datetime import datetime
from typing import Any

from beanie import PydanticObjectId

from app.models.invitation import Invitation, InvitationStatus
from app.repositories.base import DESC, BaseRepository, modified_count


def _status_query(status: InvitationStatus | None, now: datetime) -> dict[str, Any]:
    if status is None:
        return {}
    if status == InvitationStatus.PENDING:
        return {"status": InvitationStatus.PENDING.value, "expires_at": {"$gte": now}}
    if status == InvitationStatus.EXPIRED:
        return {
            "$or": [
                {"status": InvitationStatus.EXPIRED.value},
                {"status": InvitationStatus.PENDING.value, "expires_at": {"$lt": now}},
            ]
        }
    return {"status": status.value}


class InvitationRepository(BaseRepository[Invitation]):
    def __init__(self) -> None:
        super().__init__(Invitation)

    async def get_by_token_hash(self, token_hash: str) -> Invitation | None:
        return await Invitation.find_one({"token_hash": token_hash})

    async def find_pending_by_email(
        self, workspace_id: PydanticObjectId, email: str
    ) -> list[Invitation]:
        return await Invitation.find(
            {
                "workspace_id": workspace_id,
                "email": email,
                "status": InvitationStatus.PENDING.value,
            }
        ).to_list()

    async def list(
        self,
        workspace_id: PydanticObjectId,
        status: InvitationStatus | None,
        now: datetime,
        skip: int,
        limit: int,
    ) -> tuple[list[Invitation], int]:
        query = {"workspace_id": workspace_id, **_status_query(status, now)}
        total = await Invitation.find(query).count()
        items = (
            await Invitation.find(query)
            .sort([("created_at", DESC), ("_id", DESC)])
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return items, total

    async def count_pending(self, workspace_id: PydanticObjectId, now: datetime) -> int:
        query = {"workspace_id": workspace_id, **_status_query(InvitationStatus.PENDING, now)}
        return await Invitation.find(query).count()

    async def mark_accepted(self, invitation_id: PydanticObjectId, now: datetime) -> bool:
        result = await Invitation.find_one(
            {
                "_id": invitation_id,
                "status": InvitationStatus.PENDING.value,
                "expires_at": {"$gte": now},
            }
        ).update({"$set": {"status": InvitationStatus.ACCEPTED.value}})
        return modified_count(result) == 1


invitation_repository = InvitationRepository()
