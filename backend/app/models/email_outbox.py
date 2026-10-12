from datetime import datetime
from enum import StrEnum

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class EmailStatus(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class EmailOutbox(BaseDocument):
    to_address: str
    subject: str
    html: str
    text: str
    category: str
    user_id: PydanticObjectId | None = None
    task_id: PydanticObjectId | None = None
    status: EmailStatus = EmailStatus.PENDING
    attempts: int = 0
    next_attempt_at: datetime = Field(default_factory=utcnow)
    error: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    sent_at: datetime | None = None

    class Settings:
        name = "email_outbox"
        indexes = [
            IndexModel([("status", ASCENDING), ("next_attempt_at", ASCENDING)]),
            IndexModel([("user_id", ASCENDING), ("task_id", ASCENDING), ("category", ASCENDING)]),
        ]
