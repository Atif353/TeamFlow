from datetime import datetime

from beanie import PydanticObjectId

from app.schemas.common import OutModel, UserBrief


class AttachmentOut(OutModel):
    id: PydanticObjectId
    task_id: PydanticObjectId
    filename: str
    content_type: str
    size: int
    uploaded_by: UserBrief | None
    created_at: datetime
