from beanie import PydanticObjectId

from app.models.refresh_token import RefreshToken
from app.repositories.base import BaseRepository, modified_count
from app.utils.time import utcnow


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    def __init__(self) -> None:
        super().__init__(RefreshToken)

    async def get_by_hash(self, jti_hash: str) -> RefreshToken | None:
        return await RefreshToken.find_one({"jti_hash": jti_hash})

    async def revoke_if_active(self, token_id: PydanticObjectId) -> bool:
        result = await RefreshToken.find_one({"_id": token_id, "revoked_at": None}).update(
            {"$set": {"revoked_at": utcnow()}}
        )
        return modified_count(result) == 1

    async def revoke_by_hash(self, jti_hash: str) -> None:
        await RefreshToken.find({"jti_hash": jti_hash, "revoked_at": None}).update(
            {"$set": {"revoked_at": utcnow()}}
        )

    async def revoke_all_for_user(self, user_id: PydanticObjectId) -> None:
        await RefreshToken.find({"user_id": user_id, "revoked_at": None}).update(
            {"$set": {"revoked_at": utcnow()}}
        )


refresh_token_repository = RefreshTokenRepository()
