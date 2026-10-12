from datetime import datetime

from beanie import PydanticObjectId

from app.models.notification import NotificationType
from app.schemas.common import OutModel, UserBrief


class NotificationOut(OutModel):
    id: PydanticObjectId
    type: NotificationType
    task_id: PydanticObjectId
    task_title: str | None
    task_key: str | None
    project_id: PydanticObjectId
    project_name: str | None
    project_key: str | None
    actor: UserBrief | None
    is_read: bool
    created_at: datetime


class UnreadCountOut(OutModel):
    count: int


class MarkedReadOut(OutModel):
    updated: int
