from datetime import date, datetime
from typing import Annotated

from beanie import PydanticObjectId
from pydantic import Field, StringConstraints, model_validator

from app.models.sprint import SprintState
from app.schemas.common import ApiModel, OutModel
from app.schemas.task import TaskOut

SprintName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class SprintOut(OutModel):
    id: PydanticObjectId
    project_id: PydanticObjectId
    name: str
    goal: str
    state: SprintState
    start_date: date | None
    end_date: date | None
    started_at: datetime | None
    completed_at: datetime | None
    issue_count: int
    done_count: int
    story_points: float
    done_points: float
    committed_points: float
    committed_issues: int
    completed_points: float
    completed_issues: int


class SprintCreate(ApiModel):
    name: SprintName
    goal: str = Field(default="", max_length=1000)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def check_dates(self) -> "SprintCreate":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class SprintUpdate(ApiModel):
    name: SprintName | None = None
    goal: str | None = Field(default=None, max_length=1000)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def check_dates(self) -> "SprintUpdate":
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null")
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class SprintStart(ApiModel):
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def check_dates(self) -> "SprintStart":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class SprintComplete(ApiModel):
    move_to_sprint_id: PydanticObjectId | None = None


class BacklogSprint(OutModel):
    sprint: SprintOut
    issues: list[TaskOut]


class BacklogOut(OutModel):
    sprints: list[BacklogSprint]
    backlog: list[TaskOut]
    epics: list[TaskOut]


class VersionOut(OutModel):
    id: PydanticObjectId
    project_id: PydanticObjectId
    name: str
    description: str
    start_date: date | None
    release_date: date | None
    released: bool
    released_at: datetime | None
    issue_count: int
    done_count: int


class VersionCreate(ApiModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    description: str = Field(default="", max_length=1000)
    start_date: date | None = None
    release_date: date | None = None


class VersionUpdate(ApiModel):
    name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)] | None
    ) = None
    description: str | None = Field(default=None, max_length=1000)
    start_date: date | None = None
    release_date: date | None = None
    released: bool | None = None
