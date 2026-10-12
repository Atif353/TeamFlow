import logging
from dataclasses import dataclass
from datetime import timedelta

from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.exceptions import (
    BusinessRuleError,
    ConflictError,
    ForbiddenError,
    GoneError,
    UnauthorizedError,
)
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    generate_opaque_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember
from app.permissions.roles import Role
from app.repositories.password_reset_repository import password_reset_repository
from app.repositories.refresh_token_repository import refresh_token_repository
from app.repositories.user_repository import user_repository
from app.repositories.workspace_repository import workspace_repository
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    ResendCodeRequest,
    ResendCodeResponse,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services import email_service, verification_service
from app.utils.avatar import avatar_color_for
from app.utils.time import utcnow

logger = logging.getLogger(__name__)
RESET_TOKEN_HOURS = 1
RESET_MESSAGE = "If an account exists for that email, a reset link has been sent"


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str


@dataclass(frozen=True)
class Session:
    user: User
    workspace: Workspace
    role: Role
    tokens: TokenPair


async def issue_tokens(user: User) -> TokenPair:
    settings = get_settings()
    raw_refresh = generate_opaque_token()
    await refresh_token_repository.insert(
        RefreshToken(
            user_id=user.pk,
            jti_hash=hash_token(raw_refresh),
            expires_at=utcnow() + timedelta(days=settings.refresh_token_days),
        )
    )
    access = create_access_token(str(user.pk), user.token_version)
    return TokenPair(access_token=access, refresh_token=raw_refresh)


async def revoke_all_sessions(user: User) -> None:
    user.token_version += 1
    user.updated_at = utcnow()
    await user_repository.save(user)
    await refresh_token_repository.revoke_all_for_user(user.pk)


async def create_user_with_membership(
    name: str, email: str, password: str, workspace: Workspace, role: Role
) -> User:
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        avatar_color=avatar_color_for(email),
    )
    try:
        await user_repository.insert(user)
    except DuplicateKeyError as error:
        raise ConflictError("Email is already registered", code="email_taken") from error
    await workspace_repository.add_member(
        WorkspaceMember(workspace_id=workspace.pk, user_id=user.pk, role=role)
    )
    return user


async def _session_for(user: User, workspace: Workspace, role: Role) -> Session:
    return Session(user=user, workspace=workspace, role=role, tokens=await issue_tokens(user))


def _exposes_dev_secrets() -> bool:
    settings = get_settings()
    return not settings.is_production and not settings.email_enabled


async def register(data: RegisterRequest) -> RegisterResponse:
    if await user_repository.get_by_email(data.email):
        raise ConflictError("Email is already registered", code="email_taken")
    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        avatar_color=avatar_color_for(data.email),
        email_verified=False,
    )
    try:
        await user_repository.insert(user)
    except DuplicateKeyError as error:
        raise ConflictError("Email is already registered", code="email_taken") from error
    workspace = await workspace_repository.insert(
        Workspace(name=data.workspace_name or f"{data.name}'s Workspace", owner_id=user.pk)
    )
    await workspace_repository.add_member(
        WorkspaceMember(workspace_id=workspace.pk, user_id=user.pk, role=Role.SUPER_ADMIN)
    )
    code = await verification_service.issue_code(user)
    return RegisterResponse(email=user.email, dev_code=code if _exposes_dev_secrets() else None)


def _invalid_code() -> BusinessRuleError:
    return BusinessRuleError("That code is not correct", code="invalid_code")


async def verify_email(data: VerifyEmailRequest) -> Session:
    user = await user_repository.get_by_email(data.email)
    if user is None or user.email_verified or not user.is_active:
        raise _invalid_code()
    await verification_service.check_code(user, data.code)
    user.email_verified = True
    user.last_login_at = utcnow()
    await user_repository.save(user)
    return await _load_session(user)


async def resend_code(data: ResendCodeRequest) -> ResendCodeResponse:
    user = await user_repository.get_by_email(data.email)
    if user is None or user.email_verified or not user.is_active:
        return ResendCodeResponse()
    code = await verification_service.issue_code(user)
    return ResendCodeResponse(dev_code=code if _exposes_dev_secrets() else None)


async def login(data: LoginRequest) -> Session:
    user = await user_repository.get_by_email(data.email)
    password_ok = verify_password(
        user.password_hash if user else DUMMY_PASSWORD_HASH, data.password
    )
    if user is None or not password_ok:
        raise UnauthorizedError("Invalid email or password", code="invalid_credentials")
    if not user.is_active:
        raise ForbiddenError("This account has been deactivated", code="account_deactivated")
    if not user.email_verified:
        raise ForbiddenError("Verify your email to continue", code="email_not_verified")
    user.last_login_at = utcnow()
    await user_repository.save(user)
    return await _load_session(user)


async def _load_session(user: User) -> Session:
    membership = await workspace_repository.get_member(user.pk)
    workspace = await workspace_repository.get(membership.workspace_id) if membership else None
    if membership is None or workspace is None:
        raise UnauthorizedError("Account has no workspace", code="invalid_credentials")
    return await _session_for(user, workspace, membership.role)


async def refresh(raw_token: str | None) -> Session:
    invalid = UnauthorizedError("Invalid refresh token", code="invalid_refresh_token")
    if not raw_token:
        raise invalid
    record = await refresh_token_repository.get_by_hash(hash_token(raw_token))
    if record is None or record.revoked_at is not None or record.expires_at <= utcnow():
        raise invalid
    if not await refresh_token_repository.revoke_if_active(record.pk):
        raise invalid
    user = await user_repository.get(record.user_id)
    if user is None or not user.is_active:
        raise invalid
    return await _load_session(user)


async def logout(raw_token: str | None) -> None:
    if raw_token:
        await refresh_token_repository.revoke_by_hash(hash_token(raw_token))


async def forgot_password(data: ForgotPasswordRequest) -> ForgotPasswordResponse:
    settings = get_settings()
    user = await user_repository.get_by_email(data.email)
    if user is None or not user.is_active:
        return ForgotPasswordResponse(message=RESET_MESSAGE)
    now = utcnow()
    await password_reset_repository.invalidate_for_user(user.pk, now)
    token = generate_opaque_token()
    await password_reset_repository.insert(
        PasswordResetToken(
            user_id=user.pk,
            token_hash=hash_token(token),
            expires_at=now + timedelta(hours=RESET_TOKEN_HOURS),
        )
    )
    url = f"{settings.frontend_url.rstrip('/')}/reset-password/{token}"
    logger.info("Password reset link for %s: %s", user.email, url)
    await email_service.send_password_reset(user, url, RESET_TOKEN_HOURS)
    return ForgotPasswordResponse(
        message=RESET_MESSAGE, reset_url=url if _exposes_dev_secrets() else None
    )


async def reset_password(data: ResetPasswordRequest) -> None:
    gone = GoneError("This reset link is invalid or has expired", code="reset_token_invalid")
    record = await password_reset_repository.get_by_hash(hash_token(data.token))
    now = utcnow()
    if record is None or record.used_at is not None or record.expires_at <= now:
        raise gone
    if not await password_reset_repository.consume(record.pk, now):
        raise gone
    user = await user_repository.get(record.user_id)
    if user is None or not user.is_active:
        raise gone
    user.password_hash = hash_password(data.password)
    await revoke_all_sessions(user)
