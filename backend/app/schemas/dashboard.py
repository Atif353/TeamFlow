from datetime import date

from beanie import PydanticObjectId

from app.models.task import IssueType, Priority
from app.schemas.common import OutModel
from app.schemas.report import DayCount, DayMinutes, NamedCount


class DashboardStats(OutModel):
    assigned_open: int
    overdue: int
    due_this_week: int
    completed_this_week: int


class DashboardTask(OutModel):
    id: PydanticObjectId
    key: str
    issue_type: IssueType
    title: str
    project_id: PydanticObjectId
    project_key: str
    project_name: str
    priority: Priority
    due_date: date | None
    status_name: str
    status_color: str
    is_overdue: bool


class DashboardProject(OutModel):
    id: PydanticObjectId
    name: str
    key: str
    color: str
    total_tasks: int
    done_tasks: int
    progress_percent: int


class DashboardCharts(OutModel):
    by_status: list[NamedCount]
    by_type: list[NamedCount]
    by_priority: list[NamedCount]
    completed_per_day: list[DayCount]
    logged_per_day: list[DayMinutes]
    minutes_logged_week: int


class DashboardOut(OutModel):
    stats: DashboardStats
    charts: DashboardCharts
    my_tasks: list[DashboardTask]
    projects: list[DashboardProject]
