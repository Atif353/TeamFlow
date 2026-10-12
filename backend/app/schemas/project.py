from datetime import datetime
from typing import Annotated

from beanie import PydanticObjectId
from pydantic import Field, StringConstraints, field_validator, model_validator

from app.permissions.roles import Role
from app.schemas.common import ApiModel, HexColor, OutModel, UserBrief

ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
ProjectKey = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Za-z][A-Za-z0-9]{1,9}$"),
]
StatusName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
ComponentName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)
]
MAX_STATUSES = 20
MAX_COMPONENTS = 50


class StatusOut(OutModel):
    id: str
    name: str
    color: str
    order: int
    is_done: bool
    wip_limit: int | None


class StatusIn(ApiModel):
    id: str | None = None
    name: StatusName
    color: HexColor
    is_done: bool = False
    wip_limit: int | None = Field(default=None, ge=1, le=999)


class UpdateStatusesRequest(ApiModel):
    statuses: list[StatusIn] = Field(min_length=1, max_length=MAX_STATUSES)


class UpdateWorkflowRequest(ApiModel):
    transitions: dict[str, list[str]] = Field(default_factory=dict, max_length=MAX_STATUSES)


class UpdateComponentsRequest(ApiModel):
    components: list[ComponentName] = Field(max_length=MAX_COMPONENTS)

    @field_validator("components")
    @classmethod
    def unique_components(cls, value: list[str]) -> list[str]:
        if len({name.lower() for name in value}) != len(value):
            raise ValueError("Component names must be unique")
        return value


class ProjectCreate(ApiModel):
    name: ProjectName
    key: ProjectKey
    description: str = Field(default="", max_length=2000)
    color: HexColor = "#6366F1"


class ProjectUpdate(ApiModel):
    name: ProjectName | None = None
    description: str | None = Field(default=None, max_length=2000)
    color: HexColor | None = None

    @model_validator(mode="after")
    def reject_null_name(self) -> "ProjectUpdate":
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null")
        return self


class ProjectOut(OutModel):
    id: PydanticObjectId
    workspace_id: PydanticObjectId
    name: str
    key: str
    description: str
    color: str
    statuses: list[StatusOut]
    components: list[str]
    transitions: dict[str, list[str]]
    created_by: PydanticObjectId
    created_at: datetime
    updated_at: datetime
    my_role: Role
    member_count: int
    task_count: int
    done_task_count: int
    members: list[UserBrief]


class ProjectMemberOut(OutModel):
    user_id: PydanticObjectId
    name: str
    email: str
    avatar_color: str
    is_active: bool
    workspace_role: Role
    role_override: Role | None
    effective_role: Role


class AddProjectMemberRequest(ApiModel):
    user_id: PydanticObjectId
    role_override: Role | None = None

    @field_validator("role_override")
    @classmethod
    def override_not_super_admin(cls, value: Role | None) -> Role | None:
        if value == Role.SUPER_ADMIN:
            raise ValueError("Super Admin cannot be used as a project role override")
        return value
