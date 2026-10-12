from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.permissions.roles import Role
from app.utils.time import utcnow


class ProjectMember(BaseDocument):
    project_id: PydanticObjectId
    user_id: PydanticObjectId
    role_override: Role | None = None
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "project_members"
        indexes = [
            IndexModel([("project_id", ASCENDING), ("user_id", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING)]),
        ]
