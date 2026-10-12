from datetime import date, datetime

from beanie import PydanticObjectId

from app.schemas.common import OutModel, UserBrief
from app.schemas.sprint import SprintOut


class NamedCount(OutModel):
    key: str
    name: str
    color: str | None = None
    count: int


class UserCount(OutModel):
    user: UserBrief | None
    count: int
    points: float = 0.0
    minutes: int = 0


class DayCreatedResolved(OutModel):
    date: date
    created: int
    resolved: int


class DayCount(OutModel):
    date: date
    count: int


class DayMinutes(OutModel):
    date: date
    minutes: int


class EpicProgress(OutModel):
    id: PydanticObjectId
    key: str
    title: str
    total: int
    done: int
    story_points: float
    done_points: float


class ActivityRow(OutModel):
    task_id: PydanticObjectId
    task_key: str
    task_title: str
    actor: UserBrief | None
    action: str
    field: str | None
    old_value: str | None
    new_value: str | None
    created_at: datetime


class ActiveSprintSummary(OutModel):
    sprint: SprintOut
    days_remaining: int | None


class ProjectSummary(OutModel):
    total: int
    done: int
    open: int
    overdue: int
    due_soon: int
    unassigned: int
    created_last_7_days: int
    resolved_last_7_days: int
    estimate_minutes: int
    spent_minutes: int
    remaining_minutes: int
    status_counts: list[NamedCount]
    type_counts: list[NamedCount]
    priority_counts: list[NamedCount]
    assignee_counts: list[UserCount]
    created_vs_resolved: list[DayCreatedResolved]
    active_sprint: ActiveSprintSummary | None
    epics: list[EpicProgress]
    recent_activity: list[ActivityRow]


class BurndownPoint(OutModel):
    date: date
    ideal: float
    remaining: float | None


class BurndownReport(OutModel):
    sprint: SprintOut
    unit: str
    total: float
    points: list[BurndownPoint]


class VelocityEntry(OutModel):
    sprint_id: PydanticObjectId
    name: str
    committed_points: float
    completed_points: float
    committed_issues: int
    completed_issues: int


class VelocityReport(OutModel):
    sprints: list[VelocityEntry]
    average_points: float


class FlowSeries(OutModel):
    status_id: str
    name: str
    color: str
    counts: list[int]


class CumulativeFlowReport(OutModel):
    dates: list[date]
    series: list[FlowSeries]


class IssueTime(OutModel):
    task_id: PydanticObjectId
    key: str
    title: str
    spent_minutes: int
    estimate_minutes: int | None
    remaining_minutes: int | None


class TimeTrackingReport(OutModel):
    estimate_minutes: int
    spent_minutes: int
    remaining_minutes: int
    by_user: list[UserCount]
    by_day: list[DayMinutes]
    top_issues: list[IssueTime]


class WorkloadReport(OutModel):
    rows: list[UserCount]


class ProjectTotals(OutModel):
    project_id: PydanticObjectId
    name: str
    key: str
    color: str
    total: int
    done: int


class TeamMemberRow(OutModel):
    user: UserBrief
    role: str
    open_issues: int
    overdue: int
    completed_30_days: int
    minutes_30_days: int


class WorkspaceAnalytics(OutModel):
    team: list[TeamMemberRow]
    total_open: int
    total_overdue: int
    total_completed_30_days: int
    projects: list[ProjectTotals]
    type_counts: list[NamedCount]
    priority_counts: list[NamedCount]
    created_vs_resolved: list[DayCreatedResolved]
    signups: list[DayCount]
    top_contributors: list[UserCount]
    active_sprints: int
    total_minutes_logged: int
    audit_events: list[NamedCount]
