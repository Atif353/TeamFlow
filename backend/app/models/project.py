from datetime import datetime
from uuid import uuid4

from beanie import PydanticObjectId
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class ProjectStatus(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    name: str
    color: str
    order: int
    is_done: bool = False
    wip_limit: int | None = None


DEFAULT_STATUSES = [
    ("To Do", "#64748B", False),
    ("In Progress", "#6366F1", False),
    ("In Review", "#8B5CF6", False),
    ("Done", "#10B981", True),
]


def default_statuses() -> list[ProjectStatus]:
    return [
        ProjectStatus(name=name, color=color, order=index, is_done=is_done)
        for index, (name, color, is_done) in enumerate(DEFAULT_STATUSES)
    ]


class Project(BaseDocument):
    workspace_id: PydanticObjectId
    name: str
    key: str
    description: str = ""
    color: str
    statuses: list[ProjectStatus] = Field(default_factory=default_statuses)
    components: list[str] = Field(default_factory=list)
    transitions: dict[str, list[str]] = Field(default_factory=dict)
    issue_counter: int = 0
    created_by: PydanticObjectId
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "projects"
        indexes = [
            IndexModel([("workspace_id", ASCENDING)]),
            IndexModel([("workspace_id", ASCENDING), ("key", ASCENDING)], unique=True),
        ]

    def status_by_id(self, status_id: str) -> ProjectStatus | None:
        return next((item for item in self.statuses if item.id == status_id), None)

    def allows_transition(self, source_id: str, target_id: str) -> bool:
        allowed = self.transitions.get(source_id)
        return allowed is None or source_id == target_id or target_id in allowed

    @property
    def done_status_ids(self) -> set[str]:
        return {item.id for item in self.statuses if item.is_done}
