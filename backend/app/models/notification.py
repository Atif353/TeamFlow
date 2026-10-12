from datetime import datetime
from enum import StrEnum

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class NotificationType(StrEnum):
    TASK_ASSIGNED = "task_assigned"
    MENTIONED = "mentioned"
    COMMENT_ADDED = "comment_added"
    STATUS_CHANGED = "status_changed"
    TASK_OVERDUE = "task_overdue"


class Notification(BaseDocument):
    user_id: PydanticObjectId
    type: NotificationType
    task_id: PydanticObjectId
    project_id: PydanticObjectId
    actor_id: PydanticObjectId | None = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "notifications"
        indexes = [
            IndexModel([("user_id", ASCENDING), ("is_read", ASCENDING), ("created_at", DESCENDING)])
        ]
