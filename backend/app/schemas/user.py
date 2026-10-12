from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field

from app.models.user import User
from app.schemas.common import ApiModel, OutModel, Password, PersonName


class EmailPreferencesModel(ApiModel):
    assigned: bool
    mentioned: bool
    overdue: bool
    comments: bool
    status_changes: bool
    daily_digest: bool


class UserOut(OutModel):
    id: PydanticObjectId
    name: str
    email: str
    avatar_color: str
    is_active: bool
    email_verified: bool
    email_preferences: EmailPreferencesModel
    last_login_at: datetime | None
    created_at: datetime

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(
            id=user.pk,
            name=user.name,
            email=user.email,
            avatar_color=user.avatar_color,
            is_active=user.is_active,
            email_verified=user.email_verified,
            email_preferences=EmailPreferencesModel.model_validate(
                user.email_preferences.model_dump()
            ),
            last_login_at=user.last_login_at,
            created_at=user.created_at,
        )


class UpdateProfileRequest(ApiModel):
    name: PersonName


class ChangePasswordRequest(ApiModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password


class AccessTokenResponse(OutModel):
    access_token: str
    token_type: str = "bearer"
