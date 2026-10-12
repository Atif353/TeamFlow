from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.permissions.roles import Role
from app.utils.time import utcnow


class WorkspaceMember(BaseDocument):
    workspace_id: PydanticObjectId
    user_id: PydanticObjectId
    role: Role
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "workspace_members"
        indexes = [
            IndexModel([("user_id", ASCENDING)], unique=True),
            IndexModel([("workspace_id", ASCENDING), ("role", ASCENDING)]),
        ]
