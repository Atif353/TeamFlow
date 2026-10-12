from datetime import datetime
from typing import Any

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class SavedFilter(BaseDocument):
    user_id: PydanticObjectId
    project_id: PydanticObjectId
    name: str
    params: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "saved_filters"
        indexes = [IndexModel([("user_id", ASCENDING), ("project_id", ASCENDING)])]
