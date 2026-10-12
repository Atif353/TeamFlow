from dataclasses import dataclass

from beanie import PydanticObjectId

from app.models.project import Project
from app.models.user import User
from app.models.workspace_member import WorkspaceMember
from app.permissions.roles import Role


@dataclass(frozen=True)
class AuthContext:
    user: User
    membership: WorkspaceMember

    @property
    def role(self) -> Role:
        return self.membership.role

    @property
    def workspace_id(self) -> PydanticObjectId:
        return self.membership.workspace_id


@dataclass(frozen=True)
class ProjectContext:
    auth: AuthContext
    project: Project
    role: Role
