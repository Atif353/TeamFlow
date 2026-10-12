from fastapi import APIRouter, Response

from app.api.deps import CurrentAuth
from app.api.v1.endpoints.auth import set_refresh_cookie
from app.schemas.user import (
    AccessTokenResponse,
    ChangePasswordRequest,
    EmailPreferencesModel,
    UpdateProfileRequest,
    UserOut,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me", response_model=UserOut)
async def update_me(auth: CurrentAuth, data: UpdateProfileRequest) -> UserOut:
    return UserOut.from_user(await user_service.update_profile(auth, data))


@router.put("/me/email-preferences", response_model=UserOut)
async def update_email_preferences(auth: CurrentAuth, data: EmailPreferencesModel) -> UserOut:
    return UserOut.from_user(await user_service.update_email_preferences(auth, data))


@router.post("/me/password", response_model=AccessTokenResponse)
async def change_password(
    auth: CurrentAuth, data: ChangePasswordRequest, response: Response
) -> AccessTokenResponse:
    tokens = await user_service.change_password(auth, data)
    set_refresh_cookie(response, tokens.refresh_token)
    return AccessTokenResponse(access_token=tokens.access_token)
