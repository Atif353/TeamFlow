from datetime import datetime

from beanie import PydanticObjectId

from app.models.password_reset_token import PasswordResetToken
from app.repositories.base import BaseRepository


class PasswordResetRepository(BaseRepository[PasswordResetToken]):
    def __init__(self) -> None:
        super().__init__(PasswordResetToken)

    async def get_by_hash(self, token_hash: str) -> PasswordResetToken | None:
        return await PasswordResetToken.find_one({"token_hash": token_hash})

    async def consume(self, token_id: PydanticObjectId, now: datetime) -> bool:
        result = await PasswordResetToken.find(
            {"_id": token_id, "used_at": None, "expires_at": {"$gt": now}}
        ).update({"$set": {"used_at": now}})
        return bool(getattr(result, "modified_count", 0))

    async def invalidate_for_user(self, user_id: PydanticObjectId, now: datetime) -> None:
        await PasswordResetToken.find({"user_id": user_id, "used_at": None}).update(
            {"$set": {"used_at": now}}
        )


password_reset_repository = PasswordResetRepository()
