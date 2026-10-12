from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.permissions.context import AuthContext, ProjectContext
from app.permissions.roles import Role
from app.repositories.user_repository import user_repository
from app.repositories.workspace_repository import workspace_repository
from app.services import project_service
from app.utils.object_id import to_object_id

bearer_scheme = HTTPBearer(auto_error=False)


async def get_auth_context(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AuthContext:
    if credentials is None:
        raise UnauthorizedError("Authentication required", code="not_authenticated")
    claims = decode_access_token(credentials.credentials)
    user = await user_repository.get(to_object_id(claims.user_id))
    if user is None or not user.is_active or user.token_version != claims.token_version:
        raise UnauthorizedError("Session is no longer valid", code="session_invalid")
    membership = await workspace_repository.get_member(user.pk)
    if membership is None:
        raise UnauthorizedError("Session is no longer valid", code="session_invalid")
    return AuthContext(user=user, membership=membership)


CurrentAuth = Annotated[AuthContext, Depends(get_auth_context)]


def require_roles(*roles: Role) -> Callable[[AuthContext], Coroutine[Any, Any, AuthContext]]:
    async def dependency(auth: CurrentAuth) -> AuthContext:
        if auth.role not in roles:
            raise ForbiddenError(
                "You do not have access to this resource", code="permission_denied"
            )
        return auth

    return dependency


SuperAdminAuth = Annotated[AuthContext, Depends(require_roles(Role.SUPER_ADMIN))]
ManagerAuth = Annotated[AuthContext, Depends(require_roles(Role.SUPER_ADMIN, Role.PROJECT_MANAGER))]


async def get_project_context(project_id: str, auth: CurrentAuth) -> ProjectContext:
    return await project_service.get_context(auth, project_id)


CurrentProject = Annotated[ProjectContext, Depends(get_project_context)]
