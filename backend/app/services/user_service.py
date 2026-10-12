from app.core.exceptions import DomainError
from app.core.security import hash_password, verify_password
from app.models.user import EmailPreferences, User
from app.permissions.context import AuthContext
from app.repositories.user_repository import user_repository
from app.schemas.user import ChangePasswordRequest, EmailPreferencesModel, UpdateProfileRequest
from app.services import auth_service
from app.services.auth_service import TokenPair
from app.utils.time import utcnow


async def update_profile(auth: AuthContext, data: UpdateProfileRequest) -> User:
    user = auth.user
    user.name = data.name
    user.updated_at = utcnow()
    return await user_repository.save(user)


async def change_password(auth: AuthContext, data: ChangePasswordRequest) -> TokenPair:
    user = auth.user
    if not verify_password(user.password_hash, data.current_password):
        raise DomainError("Current password is incorrect", code="invalid_current_password")
    user.password_hash = hash_password(data.new_password)
    await auth_service.revoke_all_sessions(user)
    return await auth_service.issue_tokens(user)


async def update_email_preferences(auth: AuthContext, data: EmailPreferencesModel) -> User:
    user = auth.user
    user.email_preferences = EmailPreferences(**data.model_dump())
    user.updated_at = utcnow()
    return await user_repository.save(user)
