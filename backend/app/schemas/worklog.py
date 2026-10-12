from datetime import datetime
from typing import Annotated

from beanie import PydanticObjectId
from pydantic import Field, StringConstraints

from app.schemas.common import ApiModel, OutModel, UserBrief

MAX_WORKLOG_MINUTES = 60 * 24
WorklogComment = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class WorklogOut(OutModel):
    id: PydanticObjectId
    task_id: PydanticObjectId
    author: UserBrief | None
    minutes: int
    started_at: datetime
    comment: str
    created_at: datetime


class WorklogCreate(ApiModel):
    minutes: int = Field(ge=1, le=MAX_WORKLOG_MINUTES)
    started_at: datetime | None = None
    comment: WorklogComment = ""
    remaining_minutes: int | None = Field(default=None, ge=0, le=60 * 24 * 365)


class WorklogUpdate(ApiModel):
    minutes: int | None = Field(default=None, ge=1, le=MAX_WORKLOG_MINUTES)
    started_at: datetime | None = None
    comment: WorklogComment | None = None
