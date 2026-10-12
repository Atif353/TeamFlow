from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class Worklog(BaseDocument):
    task_id: PydanticObjectId
    project_id: PydanticObjectId
    author_id: PydanticObjectId
    minutes: int
    started_at: datetime
    comment: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "worklogs"
        indexes = [
            IndexModel([("task_id", ASCENDING), ("started_at", ASCENDING)]),
            IndexModel([("project_id", ASCENDING), ("started_at", ASCENDING)]),
            IndexModel([("author_id", ASCENDING), ("started_at", ASCENDING)]),
        ]
