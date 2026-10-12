from datetime import datetime
from enum import StrEnum

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.permissions.roles import Role
from app.utils.time import utcnow


class InvitationStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    EXPIRED = "expired"


class Invitation(BaseDocument):
    workspace_id: PydanticObjectId
    email: str
    role: Role
    token_hash: str
    status: InvitationStatus = InvitationStatus.PENDING
    invited_by: PydanticObjectId
    expires_at: datetime
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "invitations"
        indexes = [
            IndexModel([("token_hash", ASCENDING)], unique=True),
            IndexModel([("workspace_id", ASCENDING), ("status", ASCENDING)]),
            IndexModel([("email", ASCENDING)]),
        ]
