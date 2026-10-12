from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class EmailVerification(BaseDocument):
    user_id: PydanticObjectId
    code_hash: str
    expires_at: datetime
    attempts: int = 0
    sent_at: datetime = Field(default_factory=utcnow)
    window_started_at: datetime = Field(default_factory=utcnow)
    sends_in_window: int = 1

    class Settings:
        name = "email_verifications"
        indexes = [
            IndexModel([("user_id", ASCENDING)], unique=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=3600),
        ]
