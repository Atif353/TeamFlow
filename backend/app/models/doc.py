from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow

MAX_DOC_VERSIONS = 20


class DocVersion(BaseModel):
    number: int
    title: str
    content: str
    saved_by: PydanticObjectId
    saved_at: datetime = Field(default_factory=utcnow)


class Doc(BaseDocument):
    project_id: PydanticObjectId
    title: str
    content: str = ""
    versions: list[DocVersion] = Field(default_factory=list)
    linked_task_ids: list[PydanticObjectId] = Field(default_factory=list)
    created_by: PydanticObjectId
    updated_by: PydanticObjectId
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "docs"
        indexes = [IndexModel([("project_id", ASCENDING), ("updated_at", ASCENDING)])]
