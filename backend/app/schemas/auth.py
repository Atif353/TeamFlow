from pydantic import Field

from app.permissions.roles import Role
from app.schemas.common import ApiModel, Email, OutModel, Password, PersonName
from app.schemas.user import UserOut
from app.schemas.workspace import WorkspaceOut


class RegisterRequest(ApiModel):
    name: PersonName
    email: Email
    password: Password
    workspace_name: PersonName | None = None


class LoginRequest(ApiModel):
    email: Email
    password: str = Field(min_length=1, max_length=128)


class MeResponse(OutModel):
    user: UserOut
    workspace: WorkspaceOut
    role: Role


class AuthResponse(MeResponse):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(ApiModel):
    email: Email


class ForgotPasswordResponse(OutModel):
    message: str
    reset_url: str | None = None


class ResetPasswordRequest(ApiModel):
    token: str = Field(min_length=10, max_length=200)
    password: Password


class RegisterResponse(OutModel):
    email: str
    verification_required: bool = True
    dev_code: str | None = None


class VerifyEmailRequest(ApiModel):
    email: Email
    code: str = Field(pattern=r"^\d{6}$")


class ResendCodeRequest(ApiModel):
    email: Email


class ResendCodeResponse(OutModel):
    dev_code: str | None = None
