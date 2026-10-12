from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Any

from beanie import PydanticObjectId
from pydantic import Field, StringConstraints, model_validator

from app.models.sprint import SprintState
from app.models.task import IssueType, Priority
from app.schemas.common import ApiModel, OutModel, UserBrief
from app.schemas.label import LabelOut

TaskTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ChecklistText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
ComponentName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)
]
MAX_ESTIMATE_MINUTES = 60 * 24 * 365
MAX_STORY_POINTS = 1000
NON_NULLABLE_UPDATE_FIELDS = (
    "title",
    "description",
    "priority",
    "status_id",
    "label_ids",
    "issue_type",
    "components",
    "environment",
)


class TaskSortField(StrEnum):
    POSITION = "position"
    RANK = "rank"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    DUE_DATE = "due_date"
    PRIORITY = "priority"
    TITLE = "title"
    KEY = "key"
    STORY_POINTS = "story_points"


class SortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


class ChecklistItemOut(OutModel):
    id: str
    text: str
    done: bool


class IssueBrief(OutModel):
    id: PydanticObjectId
    key: str
    title: str
    issue_type: IssueType
    status_id: str
    priority: Priority
    done: bool


class SprintBrief(OutModel):
    id: PydanticObjectId
    name: str
    state: SprintState


class VersionBrief(OutModel):
    id: PydanticObjectId
    name: str
    released: bool


class TaskOut(OutModel):
    id: PydanticObjectId
    key: str
    issue_number: int
    issue_type: IssueType
    project_id: PydanticObjectId
    parent_id: PydanticObjectId | None
    parent: IssueBrief | None
    epic_id: PydanticObjectId | None
    epic: IssueBrief | None
    sprint_id: PydanticObjectId | None
    sprint: SprintBrief | None
    version_id: PydanticObjectId | None
    version: VersionBrief | None
    title: str
    description: str
    environment: str
    status_id: str
    priority: Priority
    assignee_id: PydanticObjectId | None
    assignee: UserBrief | None
    creator_id: PydanticObjectId
    creator: UserBrief | None
    start_date: date | None
    due_date: date | None
    labels: list[LabelOut]
    components: list[str]
    checklist: list[ChecklistItemOut]
    checklist_total: int
    checklist_done: int
    subtask_total: int
    subtask_done: int
    child_total: int
    child_done: int
    story_points: float | None
    original_estimate_minutes: int | None
    remaining_estimate_minutes: int | None
    time_spent_minutes: int
    flagged: bool
    watchers: list[UserBrief]
    is_watching: bool
    blocked_by_open: int
    position: float
    rank: float
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TaskCreate(ApiModel):
    title: TaskTitle
    description: str = Field(default="", max_length=20000)
    issue_type: IssueType = IssueType.TASK
    status_id: str | None = None
    priority: Priority = Priority.MEDIUM
    assignee_id: PydanticObjectId | None = None
    start_date: date | None = None
    due_date: date | None = None
    label_ids: list[PydanticObjectId] = Field(default_factory=list, max_length=20)
    components: list[ComponentName] = Field(default_factory=list, max_length=20)
    parent_id: PydanticObjectId | None = None
    epic_id: PydanticObjectId | None = None
    sprint_id: PydanticObjectId | None = None
    version_id: PydanticObjectId | None = None
    environment: str = Field(default="", max_length=2000)
    story_points: float | None = Field(default=None, ge=0, le=MAX_STORY_POINTS)
    original_estimate_minutes: int | None = Field(default=None, ge=0, le=MAX_ESTIMATE_MINUTES)


class TaskUpdate(ApiModel):
    title: TaskTitle | None = None
    description: str | None = Field(default=None, max_length=20000)
    issue_type: IssueType | None = None
    status_id: str | None = None
    priority: Priority | None = None
    assignee_id: PydanticObjectId | None = None
    start_date: date | None = None
    due_date: date | None = None
    label_ids: list[PydanticObjectId] | None = Field(default=None, max_length=20)
    components: list[ComponentName] | None = Field(default=None, max_length=20)
    epic_id: PydanticObjectId | None = None
    sprint_id: PydanticObjectId | None = None
    version_id: PydanticObjectId | None = None
    environment: str | None = Field(default=None, max_length=2000)
    story_points: float | None = Field(default=None, ge=0, le=MAX_STORY_POINTS)
    original_estimate_minutes: int | None = Field(default=None, ge=0, le=MAX_ESTIMATE_MINUTES)
    remaining_estimate_minutes: int | None = Field(default=None, ge=0, le=MAX_ESTIMATE_MINUTES)
    flagged: bool | None = None

    @model_validator(mode="after")
    def reject_null_for_required_fields(self) -> "TaskUpdate":
        for field in (*NON_NULLABLE_UPDATE_FIELDS, "flagged"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self

    def changes(self) -> dict[str, Any]:
        return {field: getattr(self, field) for field in self.model_fields_set}


class TaskMove(ApiModel):
    status_id: str
    previous_task_id: PydanticObjectId | None = None
    next_task_id: PydanticObjectId | None = None


class TaskRankMove(ApiModel):
    previous_task_id: PydanticObjectId | None = None
    next_task_id: PydanticObjectId | None = None
    sprint_id: PydanticObjectId | None = None
    change_sprint: bool = False


class ChecklistCreate(ApiModel):
    text: ChecklistText


class ChecklistUpdate(ApiModel):
    text: ChecklistText | None = None
    done: bool | None = None


class TaskBulkRequest(ApiModel):
    task_ids: list[PydanticObjectId] = Field(min_length=1, max_length=100)
    changes: TaskUpdate | None = None
    delete: bool = False

    @model_validator(mode="after")
    def require_exactly_one_action(self) -> "TaskBulkRequest":
        if self.delete == (self.changes is not None):
            raise ValueError("Provide either changes or delete")
        return self


class BulkFailure(OutModel):
    task_id: PydanticObjectId
    message: str
    code: str


class BulkResult(OutModel):
    succeeded: int
    failed: list[BulkFailure]
