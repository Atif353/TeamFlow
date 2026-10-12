from fastapi import APIRouter, Response, status

from app.api.deps import SuperAdminAuth
from app.api.v1.endpoints.auth import auth_response
from app.models.invitation import InvitationStatus
from app.schemas.auth import AuthResponse
from app.schemas.common import Page
from app.schemas.invitation import (
    AcceptInvitationRequest,
    CreateInvitationRequest,
    InvitationCreated,
    InvitationOut,
    InvitationPreview,
)
from app.services import invitation_service
from app.utils.pagination import PageQuery

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.post("", response_model=InvitationCreated, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    auth: SuperAdminAuth, data: CreateInvitationRequest
) -> InvitationCreated:
    return await invitation_service.create(auth, data)


@router.get("", response_model=Page[InvitationOut])
async def list_invitations(
    auth: SuperAdminAuth, params: PageQuery, status: InvitationStatus | None = None
) -> Page[InvitationOut]:
    return await invitation_service.list_invitations(auth, params, status)


@router.delete("/{invitation_id}", status_code=204)
async def revoke_invitation(auth: SuperAdminAuth, invitation_id: str) -> Response:
    await invitation_service.revoke(auth, invitation_id)
    return Response(status_code=204)


@router.get("/preview/{token}", response_model=InvitationPreview)
async def preview_invitation(token: str) -> InvitationPreview:
    return await invitation_service.preview(token)


@router.post("/accept/{token}", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def accept_invitation(
    token: str, data: AcceptInvitationRequest, response: Response
) -> AuthResponse:
    return auth_response(await invitation_service.accept(token, data), response)
