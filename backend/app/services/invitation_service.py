import logging
from datetime import timedelta

from app.core.config import get_settings
from app.core.exceptions import ConflictError, GoneError, NotFoundError
from app.core.security import generate_opaque_token, hash_token
from app.models.invitation import Invitation, InvitationStatus
from app.permissions.context import AuthContext
from app.repositories.invitation_repository import invitation_repository
from app.repositories.user_repository import user_repository
from app.repositories.workspace_repository import workspace_repository
from app.schemas.common import Page, UserBrief
from app.schemas.invitation import (
    AcceptInvitationRequest,
    CreateInvitationRequest,
    InvitationCreated,
    InvitationOut,
    InvitationPreview,
)
from app.services import auth_service, email_service
from app.services.auth_service import Session
from app.utils.object_id import to_object_id
from app.utils.pagination import PageParams
from app.utils.time import utcnow

logger = logging.getLogger(__name__)
INVITATION_DAYS = 7


def effective_status(invitation: Invitation) -> InvitationStatus:
    if invitation.status == InvitationStatus.PENDING and invitation.expires_at < utcnow():
        return InvitationStatus.EXPIRED
    return invitation.status


def invite_url(token: str) -> str:
    return f"{get_settings().frontend_url.rstrip('/')}/invite/{token}"


async def _to_out(invitations: list[Invitation]) -> list[InvitationOut]:
    inviters = {
        user.pk: user
        for user in await user_repository.find_by_ids(item.invited_by for item in invitations)
    }
    return [
        InvitationOut(
            id=item.pk,
            email=item.email,
            role=item.role,
            status=effective_status(item),
            expires_at=item.expires_at,
            created_at=item.created_at,
            invited_by=UserBrief.from_user(inviters[item.invited_by])
            if item.invited_by in inviters
            else None,
        )
        for item in invitations
    ]


async def create(auth: AuthContext, data: CreateInvitationRequest) -> InvitationCreated:
    if await user_repository.get_by_email(data.email):
        raise ConflictError("A user with this email already exists", code="email_taken")
    for pending in await invitation_repository.find_pending_by_email(auth.workspace_id, data.email):
        pending.status = InvitationStatus.REVOKED
        await invitation_repository.save(pending)
    token = generate_opaque_token()
    invitation = await invitation_repository.insert(
        Invitation(
            workspace_id=auth.workspace_id,
            email=data.email,
            role=data.role,
            token_hash=hash_token(token),
            invited_by=auth.user.pk,
            expires_at=utcnow() + timedelta(days=INVITATION_DAYS),
        )
    )
    url = invite_url(token)
    logger.info("Invitation link for %s: %s", data.email, url)
    workspace = await workspace_repository.get(auth.workspace_id)
    await email_service.send_invitation(
        data.email,
        workspace.name if workspace else "your workspace",
        auth.user.name,
        data.role.value.replace("_", " ").title(),
        url,
        INVITATION_DAYS,
    )
    [out] = await _to_out([invitation])
    return InvitationCreated(**out.model_dump(), invite_url=url)


async def list_invitations(
    auth: AuthContext, params: PageParams, status: InvitationStatus | None
) -> Page[InvitationOut]:
    items, total = await invitation_repository.list(
        auth.workspace_id, status, utcnow(), params.skip, params.limit
    )
    return Page(
        items=await _to_out(items), total=total, page=params.page, page_size=params.page_size
    )


async def revoke(auth: AuthContext, invitation_id: str) -> None:
    invitation = await invitation_repository.get(to_object_id(invitation_id))
    if invitation is None or invitation.workspace_id != auth.workspace_id:
        raise NotFoundError("Invitation not found", code="invitation_not_found")
    if effective_status(invitation) != InvitationStatus.PENDING:
        raise ConflictError(
            "Only pending invitations can be revoked", code="invitation_not_pending"
        )
    invitation.status = InvitationStatus.REVOKED
    await invitation_repository.save(invitation)


async def _usable_invitation(token: str) -> Invitation:
    invitation = await invitation_repository.get_by_token_hash(hash_token(token))
    if invitation is None:
        raise NotFoundError("Invitation not found", code="invitation_not_found")
    status = effective_status(invitation)
    if status != InvitationStatus.PENDING:
        raise GoneError(f"This invitation is {status.value}", code=f"invitation_{status.value}")
    return invitation


async def preview(token: str) -> InvitationPreview:
    invitation = await _usable_invitation(token)
    workspace = await workspace_repository.get(invitation.workspace_id)
    inviter = await user_repository.get(invitation.invited_by)
    return InvitationPreview(
        workspace_name=workspace.name if workspace else "",
        email=invitation.email,
        role=invitation.role,
        invited_by_name=inviter.name if inviter else None,
        expires_at=invitation.expires_at,
    )


async def accept(token: str, data: AcceptInvitationRequest) -> Session:
    invitation = await _usable_invitation(token)
    if await user_repository.get_by_email(invitation.email):
        raise ConflictError("A user with this email already exists", code="email_taken")
    workspace = await workspace_repository.get(invitation.workspace_id)
    if workspace is None:
        raise NotFoundError("Workspace not found", code="workspace_not_found")
    if not await invitation_repository.mark_accepted(invitation.pk, utcnow()):
        raise GoneError("This invitation is no longer valid", code="invitation_accepted")
    user = await auth_service.create_user_with_membership(
        data.name, invitation.email, data.password, workspace, invitation.role
    )
    return Session(
        user=user,
        workspace=workspace,
        role=invitation.role,
        tokens=await auth_service.issue_tokens(user),
    )
