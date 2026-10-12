from datetime import datetime
from enum import StrEnum

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class SprintState(StrEnum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"


class Sprint(BaseDocument):
    project_id: PydanticObjectId
    name: str
    goal: str = ""
    state: SprintState = SprintState.PLANNED
    start_date: datetime | None = None
    end_date: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    committed_points: float = 0.0
    committed_issues: int = 0
    completed_points: float = 0.0
    completed_issues: int = 0
    created_by: PydanticObjectId
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "sprints"
        indexes = [IndexModel([("project_id", ASCENDING), ("state", ASCENDING)])]
