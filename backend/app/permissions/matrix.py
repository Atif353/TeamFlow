from enum import StrEnum

from app.permissions.roles import Role


class Permission(StrEnum):
    ADMIN_ACCESS = "admin:access"
    USER_MANAGE = "user:manage"
    PROJECT_CREATE = "project:create"
    PROJECT_DELETE = "project:delete"
    PROJECT_MEMBERS = "project:members"
    PROJECT_VIEW = "project:view"
    TASK_CREATE = "task:create"
    TASK_EDIT_ANY = "task:edit_any"
    TASK_EDIT_OWN = "task:edit_own"
    TASK_DELETE_ANY = "task:delete_any"
    TASK_DELETE_OWN = "task:delete_own"
    COMMENT_CREATE = "comment:create"
    COMMENT_DELETE_ANY = "comment:delete_any"
    DOC_WRITE = "doc:write"
    AUTOMATION_MANAGE = "automation:manage"
    SPRINT_MANAGE = "sprint:manage"


MEMBER_PERMISSIONS = frozenset(
    {
        Permission.PROJECT_VIEW,
        Permission.TASK_CREATE,
        Permission.TASK_EDIT_OWN,
        Permission.TASK_DELETE_OWN,
        Permission.COMMENT_CREATE,
        Permission.DOC_WRITE,
    }
)

PROJECT_MANAGER_PERMISSIONS = MEMBER_PERMISSIONS | frozenset(
    {
        Permission.PROJECT_CREATE,
        Permission.PROJECT_DELETE,
        Permission.PROJECT_MEMBERS,
        Permission.TASK_EDIT_ANY,
        Permission.TASK_DELETE_ANY,
        Permission.COMMENT_DELETE_ANY,
        Permission.AUTOMATION_MANAGE,
        Permission.SPRINT_MANAGE,
    }
)

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.SUPER_ADMIN: frozenset(Permission),
    Role.PROJECT_MANAGER: PROJECT_MANAGER_PERMISSIONS,
    Role.MEMBER: MEMBER_PERMISSIONS,
    Role.VIEWER: frozenset({Permission.PROJECT_VIEW}),
}
