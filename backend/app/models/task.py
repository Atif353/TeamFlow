from datetime import datetime
from enum import StrEnum
from uuid import uuid4

from beanie import PydanticObjectId
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class IssueType(StrEnum):
    EPIC = "epic"
    STORY = "story"
    TASK = "task"
    BUG = "bug"
    SUBTASK = "subtask"
    FEATURE = "feature"
    IMPROVEMENT = "improvement"
    MERGE_REQUEST = "merge_request"
    INCIDENT = "incident"
    SPIKE = "spike"
    TEST = "test"


PRIORITY_RANK = {Priority.LOW: 0, Priority.MEDIUM: 1, Priority.HIGH: 2, Priority.URGENT: 3}


class ChecklistItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    text: str
    done: bool = False


class Task(BaseDocument):
    project_id: PydanticObjectId
    issue_number: int = 0
    issue_type: IssueType = IssueType.TASK
    parent_id: PydanticObjectId | None = None
    epic_id: PydanticObjectId | None = None
    sprint_id: PydanticObjectId | None = None
    version_id: PydanticObjectId | None = None
    title: str
    description: str = ""
    environment: str = ""
    status_id: str
    priority: Priority = Priority.MEDIUM
    priority_rank: int = 1
    assignee_id: PydanticObjectId | None = None
    creator_id: PydanticObjectId
    start_date: datetime | None = None
    due_date: datetime | None = None
    label_ids: list[PydanticObjectId] = Field(default_factory=list)
    components: list[str] = Field(default_factory=list)
    watcher_ids: list[PydanticObjectId] = Field(default_factory=list)
    checklist: list[ChecklistItem] = Field(default_factory=list)
    story_points: float | None = None
    original_estimate_minutes: int | None = None
    remaining_estimate_minutes: int | None = None
    time_spent_minutes: int = 0
    flagged: bool = False
    overdue_notified: bool = False
    position: float = 0.0
    rank: float = 0.0
    completed_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "tasks"
        indexes = [
            IndexModel(
                [("project_id", ASCENDING), ("status_id", ASCENDING), ("position", ASCENDING)]
            ),
            IndexModel([("assignee_id", ASCENDING), ("due_date", ASCENDING)]),
            IndexModel([("parent_id", ASCENDING)]),
            IndexModel([("epic_id", ASCENDING)]),
            IndexModel([("project_id", ASCENDING), ("issue_number", ASCENDING)]),
            IndexModel([("project_id", ASCENDING), ("sprint_id", ASCENDING), ("rank", ASCENDING)]),
        ]

    def set_priority(self, priority: Priority) -> None:
        self.priority = priority
        self.priority_rank = PRIORITY_RANK[priority]
