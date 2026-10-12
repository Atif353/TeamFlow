from datetime import datetime
from typing import Annotated

from beanie import PydanticObjectId
from pydantic import Field, StringConstraints

from app.schemas.common import ApiModel, OutModel, UserBrief
from app.schemas.task import IssueBrief

DocTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
MAX_DOC_CONTENT = 200000


class DocVersionOut(OutModel):
    number: int
    title: str
    saved_by: UserBrief | None
    saved_at: datetime


class DocSummary(OutModel):
    id: PydanticObjectId
    project_id: PydanticObjectId
    title: str
    updated_by: UserBrief | None
    updated_at: datetime
    created_at: datetime
    version_count: int


class DocOut(DocSummary):
    content: str
    versions: list[DocVersionOut]
    linked_tasks: list[IssueBrief]


class DocCreate(ApiModel):
    title: DocTitle
    content: str = Field(default="", max_length=MAX_DOC_CONTENT)


class DocUpdate(ApiModel):
    title: DocTitle | None = None
    content: str | None = Field(default=None, max_length=MAX_DOC_CONTENT)


class DocLinkRequest(ApiModel):
    task: str
