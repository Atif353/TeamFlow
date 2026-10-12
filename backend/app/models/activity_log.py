from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class ActivityLog(BaseDocument):
    task_id: PydanticObjectId
    project_id: PydanticObjectId
    actor_id: PydanticObjectId
    action: str
    field: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    old_id: str | None = None
    new_id: str | None = None
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "activity_logs"
        indexes = [
            IndexModel([("task_id", ASCENDING), ("created_at", ASCENDING)]),
            IndexModel([("project_id", ASCENDING), ("created_at", ASCENDING)]),
        ]
