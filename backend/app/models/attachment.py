from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class Attachment(BaseDocument):
    task_id: PydanticObjectId
    project_id: PydanticObjectId
    filename: str
    content_type: str
    size: int
    storage_key: str
    uploaded_by: PydanticObjectId
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "attachments"
        indexes = [IndexModel([("task_id", ASCENDING), ("created_at", ASCENDING)])]
