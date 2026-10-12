from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class Comment(BaseDocument):
    task_id: PydanticObjectId
    project_id: PydanticObjectId
    author_id: PydanticObjectId
    body: str
    mentions: list[PydanticObjectId] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    edited_at: datetime | None = None

    class Settings:
        name = "comments"
        indexes = [IndexModel([("task_id", ASCENDING), ("created_at", ASCENDING)])]
