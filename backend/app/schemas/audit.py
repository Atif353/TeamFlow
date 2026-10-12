from datetime import datetime
from typing import Any

from beanie import PydanticObjectId

from app.schemas.common import OutModel, UserBrief


class AuditLogOut(OutModel):
    id: PydanticObjectId
    action: str
    entity_type: str
    entity_id: str | None
    summary: str
    metadata: dict[str, Any]
    actor: UserBrief | None
    created_at: datetime


class AuditActionsOut(OutModel):
    actions: list[str]
