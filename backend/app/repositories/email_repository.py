from datetime import datetime

from beanie import PydanticObjectId

from app.models.email_outbox import EmailOutbox, EmailStatus
from app.repositories.base import ASC, BaseRepository


class EmailRepository(BaseRepository[EmailOutbox]):
    def __init__(self) -> None:
        super().__init__(EmailOutbox)

    async def due(self, now: datetime, limit: int) -> list[EmailOutbox]:
        return (
            await EmailOutbox.find(
                {"status": EmailStatus.PENDING.value, "next_attempt_at": {"$lte": now}}
            )
            .sort([("next_attempt_at", ASC)])
            .limit(limit)
            .to_list()
        )

    async def exists_since(
        self, user_id: PydanticObjectId, task_id: PydanticObjectId, category: str, since: datetime
    ) -> bool:
        return (
            await EmailOutbox.find_one(
                {
                    "user_id": user_id,
                    "task_id": task_id,
                    "category": category,
                    "created_at": {"$gte": since},
                }
            )
            is not None
        )

    async def for_address(self, address: str) -> list[EmailOutbox]:
        return await EmailOutbox.find({"to_address": address}).sort([("created_at", ASC)]).to_list()


email_repository = EmailRepository()
