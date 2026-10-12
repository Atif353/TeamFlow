from typing import Annotated

from fastapi import APIRouter, Cookie, Request, Response, status

from app.api.deps import CurrentAuth
from app.core.config import get_settings
from app.core.rate_limit import AUTH_RATE_LIMIT, limiter
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    RegisterResponse,
    ResendCodeRequest,
    ResendCodeResponse,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.schemas.user import UserOut
from app.schemas.workspace import WorkspaceOut
from app.services import auth_service, workspace_service
from app.services.auth_service import Session

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=settings.refresh_token_days * 86400,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


def auth_response(session: Session, response: Response) -> AuthResponse:
    set_refresh_cookie(response, session.tokens.refresh_token)
    return AuthResponse(
        user=UserOut.from_user(session.user),
        workspace=WorkspaceOut.from_workspace(session.workspace),
        role=session.role,
        access_token=session.tokens.access_token,
    )


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(AUTH_RATE_LIMIT)
async def register(request: Request, data: RegisterRequest) -> RegisterResponse:
    return await auth_service.register(data)


@router.post("/verify-email", response_model=AuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def verify_email(
    request: Request, data: VerifyEmailRequest, response: Response
) -> AuthResponse:
    return auth_response(await auth_service.verify_email(data), response)


@router.post("/resend-code", response_model=ResendCodeResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def resend_code(request: Request, data: ResendCodeRequest) -> ResendCodeResponse:
    return await auth_service.resend_code(data)


@router.post("/login", response_model=AuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def login(request: Request, data: LoginRequest, response: Response) -> AuthResponse:
    return auth_response(await auth_service.login(data), response)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def forgot_password(request: Request, data: ForgotPasswordRequest) -> ForgotPasswordResponse:
    return await auth_service.forgot_password(data)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(AUTH_RATE_LIMIT)
async def reset_password(request: Request, data: ResetPasswordRequest) -> Response:
    await auth_service.reset_password(data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    response: Response,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> AuthResponse:
    return auth_response(await auth_service.refresh(refresh_token), response)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    _: CurrentAuth,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> Response:
    await auth_service.logout(refresh_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_refresh_cookie(response)
    return response


@router.get("/me", response_model=MeResponse)
async def me(auth: CurrentAuth) -> MeResponse:
    workspace = await workspace_service.get_current(auth)
    return MeResponse(
        user=UserOut.from_user(auth.user),
        workspace=WorkspaceOut.from_workspace(workspace),
        role=auth.role,
    )
