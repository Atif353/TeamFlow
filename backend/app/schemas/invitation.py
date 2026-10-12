from datetime import datetime

from beanie import PydanticObjectId

from app.models.invitation import InvitationStatus
from app.permissions.roles import Role
from app.schemas.common import ApiModel, Email, OutModel, Password, PersonName, UserBrief


class CreateInvitationRequest(ApiModel):
    email: Email
    role: Role


class InvitationOut(OutModel):
    id: PydanticObjectId
    email: str
    role: Role
    status: InvitationStatus
    expires_at: datetime
    created_at: datetime
    invited_by: UserBrief | None


class InvitationCreated(InvitationOut):
    invite_url: str


class InvitationPreview(OutModel):
    workspace_name: str
    email: str
    role: Role
    invited_by_name: str | None
    expires_at: datetime


class AcceptInvitationRequest(ApiModel):
    name: PersonName
    password: Password
