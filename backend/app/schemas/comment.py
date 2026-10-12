from datetime import datetime
from typing import Annotated

from beanie import PydanticObjectId
from pydantic import StringConstraints

from app.schemas.common import ApiModel, OutModel, UserBrief

CommentBody = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)
]


class CommentOut(OutModel):
    id: PydanticObjectId
    task_id: PydanticObjectId
    author: UserBrief | None
    body: str
    mentions: list[UserBrief]
    created_at: datetime
    edited_at: datetime | None


class CommentCreate(ApiModel):
    body: CommentBody


class CommentUpdate(ApiModel):
    body: CommentBody
