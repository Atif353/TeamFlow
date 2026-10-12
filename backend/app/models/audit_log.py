from datetime import datetime
from typing import Any

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import DESCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class AuditLog(BaseDocument):
    workspace_id: PydanticObjectId
    actor_id: PydanticObjectId
    action: str
    entity_type: str
    entity_id: str | None = None
    summary: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "audit_logs"
        indexes = [
            IndexModel([("workspace_id", DESCENDING), ("created_at", DESCENDING)]),
            IndexModel([("action", DESCENDING)]),
        ]
