from datetime import datetime

from beanie import PydanticObjectId
from pydantic import field_validator

from app.permissions.roles import Role
from app.schemas.common import ApiModel, Email, OutModel, Password, PersonName


class AdminStats(OutModel):
    total_users: int
    active_users: int
    inactive_users: int
    users_by_role: dict[str, int]
    pending_invitations: int
    total_projects: int
    total_tasks: int
    completed_tasks: int


class AdminUserOut(OutModel):
    id: PydanticObjectId
    name: str
    email: str
    avatar_color: str
    role: Role
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    project_count: int


class AdminUserProject(OutModel):
    project_id: PydanticObjectId
    name: str
    key: str
    color: str
    role_override: Role | None
    effective_role: Role


class AdminUserDetail(AdminUserOut):
    projects: list[AdminUserProject]


class ChangeRoleRequest(ApiModel):
    role: Role


class ChangeStatusRequest(ApiModel):
    is_active: bool


class SetProjectOverrideRequest(ApiModel):
    role_override: Role | None = None

    @field_validator("role_override")
    @classmethod
    def override_not_super_admin(cls, value: Role | None) -> Role | None:
        if value == Role.SUPER_ADMIN:
            raise ValueError("Super Admin cannot be used as a project role override")
        return value


class AdminUserCreate(ApiModel):
    name: PersonName
    email: Email
    password: Password
    role: Role


class AdminUserUpdate(ApiModel):
    name: PersonName | None = None
    email: Email | None = None


class AdminPasswordReset(ApiModel):
    password: Password
