from datetime import datetime
from enum import StrEnum

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class LinkType(StrEnum):
    BLOCKS = "blocks"
    DUPLICATES = "duplicates"
    RELATES_TO = "relates_to"
    CLONES = "clones"


class IssueLink(BaseDocument):
    project_id: PydanticObjectId
    source_id: PydanticObjectId
    target_id: PydanticObjectId
    link_type: LinkType
    created_by: PydanticObjectId
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "issue_links"
        indexes = [
            IndexModel([("source_id", ASCENDING)]),
            IndexModel([("target_id", ASCENDING)]),
            IndexModel([("project_id", ASCENDING)]),
        ]
