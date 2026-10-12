from beanie import PydanticObjectId

from app.models.email_verification import EmailVerification
from app.repositories.base import BaseRepository


class EmailVerificationRepository(BaseRepository[EmailVerification]):
    def __init__(self) -> None:
        super().__init__(EmailVerification)

    async def for_user(self, user_id: PydanticObjectId) -> EmailVerification | None:
        return await EmailVerification.find_one({"user_id": user_id})


email_verification_repository = EmailVerificationRepository()
