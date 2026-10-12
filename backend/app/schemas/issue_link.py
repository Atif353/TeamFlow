from datetime import datetime
from enum import StrEnum

from beanie import PydanticObjectId

from app.models.issue_link import LinkType
from app.schemas.common import ApiModel, OutModel
from app.schemas.task import IssueBrief


class LinkDirection(StrEnum):
    OUTWARD = "outward"
    INWARD = "inward"


class IssueLinkOut(OutModel):
    id: PydanticObjectId
    link_type: LinkType
    direction: LinkDirection
    label: str
    issue: IssueBrief
    created_at: datetime


class IssueLinkCreate(ApiModel):
    target: str
    link_type: LinkType
