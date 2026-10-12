from datetime import datetime

from beanie import PydanticObjectId

from app.schemas.common import OutModel, UserBrief


class ActivityOut(OutModel):
    id: PydanticObjectId
    task_id: PydanticObjectId
    action: str
    field: str | None
    old_value: str | None
    new_value: str | None
    actor: UserBrief | None
    created_at: datetime
