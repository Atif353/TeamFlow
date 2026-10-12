from beanie import PydanticObjectId

from app.core.exceptions import ForbiddenError
from app.permissions.matrix import ROLE_PERMISSIONS, Permission
from app.permissions.roles import Role


def can(role: Role, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[role]


def require(role: Role, permission: Permission, message: str = "Permission denied") -> None:
    if not can(role, permission):
        raise ForbiddenError(message, code="permission_denied")


def effective_role(workspace_role: Role, override: Role | None) -> Role:
    if workspace_role == Role.SUPER_ADMIN:
        return Role.SUPER_ADMIN
    return override or workspace_role


def is_task_owner(
    user_id: PydanticObjectId, creator_id: PydanticObjectId, assignee_id: PydanticObjectId | None
) -> bool:
    return user_id in (creator_id, assignee_id)


def can_edit_task(
    role: Role,
    user_id: PydanticObjectId,
    creator_id: PydanticObjectId,
    assignee_id: PydanticObjectId | None,
) -> bool:
    if can(role, Permission.TASK_EDIT_ANY):
        return True
    return can(role, Permission.TASK_EDIT_OWN) and is_task_owner(user_id, creator_id, assignee_id)


def can_delete_task(
    role: Role,
    user_id: PydanticObjectId,
    creator_id: PydanticObjectId,
    assignee_id: PydanticObjectId | None,
) -> bool:
    if can(role, Permission.TASK_DELETE_ANY):
        return True
    return can(role, Permission.TASK_DELETE_OWN) and is_task_owner(user_id, creator_id, assignee_id)


def can_delete_comment(role: Role, user_id: PydanticObjectId, author_id: PydanticObjectId) -> bool:
    if can(role, Permission.COMMENT_DELETE_ANY):
        return True
    return can(role, Permission.COMMENT_CREATE) and user_id == author_id
