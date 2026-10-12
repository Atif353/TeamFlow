from typing import Any

from beanie import PydanticObjectId

from app.models.user import User
from app.repositories.base import ASC, BaseRepository, contains_pattern


class UserRepository(BaseRepository[User]):
    def __init__(self) -> None:
        super().__init__(User)

    async def get_by_email(self, email: str) -> User | None:
        return await User.find_one({"email": email})

    async def search(
        self,
        ids: list[PydanticObjectId],
        q: str | None,
        is_active: bool | None,
        skip: int,
        limit: int,
    ) -> tuple[list[User], int]:
        query: dict[str, Any] = {"_id": {"$in": ids}}
        if q:
            pattern = contains_pattern(q)
            query["$or"] = [{"name": pattern}, {"email": pattern}]
        if is_active is not None:
            query["is_active"] = is_active
        total = await User.find(query).count()
        items = (
            await User.find(query)
            .sort([("name", ASC), ("_id", ASC)])
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return items, total

    async def digest_candidates(self, today: str) -> list[User]:
        return await User.find(
            {
                "is_active": True,
                "email_verified": True,
                "email_preferences.daily_digest": True,
                "last_digest_on": {"$ne": today},
            }
        ).to_list()

    async def count_in(self, ids: list[PydanticObjectId], is_active: bool | None = None) -> int:
        query: dict[str, Any] = {"_id": {"$in": ids}}
        if is_active is not None:
            query["is_active"] = is_active
        return await User.find(query).count()


user_repository = UserRepository()
