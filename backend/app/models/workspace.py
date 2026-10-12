from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field

from app.models.base import BaseDocument
from app.utils.time import utcnow


class Workspace(BaseDocument):
    name: str
    owner_id: PydanticObjectId
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "workspaces"
