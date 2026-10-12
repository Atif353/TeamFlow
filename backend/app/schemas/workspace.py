from datetime import datetime

from beanie import PydanticObjectId

from app.models.workspace import Workspace
from app.permissions.roles import Role
from app.schemas.common import ApiModel, OutModel, PersonName


class WorkspaceOut(OutModel):
    id: PydanticObjectId
    name: str
    owner_id: PydanticObjectId
    created_at: datetime

    @classmethod
    def from_workspace(cls, workspace: Workspace) -> "WorkspaceOut":
        return cls(
            id=workspace.pk,
            name=workspace.name,
            owner_id=workspace.owner_id,
            created_at=workspace.created_at,
        )


class UpdateWorkspaceRequest(ApiModel):
    name: PersonName


class WorkspaceMemberOut(OutModel):
    user_id: PydanticObjectId
    name: str
    email: str
    avatar_color: str
    role: Role
    is_active: bool
