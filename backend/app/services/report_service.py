from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from beanie import PydanticObjectId

from app.core.exceptions import NotFoundError
from app.models.project import Project
from app.models.sprint import Sprint, SprintState
from app.models.task import IssueType, Priority, Task
from app.permissions.context import AuthContext
from app.permissions.matrix import Permission
from app.permissions.policies import require
from app.repositories.activity_repository import activity_repository
from app.repositories.audit_repository import audit_repository
from app.repositories.project_repository import project_repository
from app.repositories.sprint_repository import sprint_repository
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.repositories.worklog_repository import worklog_repository
from app.repositories.workspace_repository import workspace_repository
from app.schemas.common import UserBrief
from app.schemas.report import (
    ActiveSprintSummary,
    ActivityRow,
    BurndownPoint,
    BurndownReport,
    CumulativeFlowReport,
    DayCount,
    DayCreatedResolved,
    DayMinutes,
    EpicProgress,
    FlowSeries,
    IssueTime,
    NamedCount,
    ProjectSummary,
    ProjectTotals,
    TeamMemberRow,
    TimeTrackingReport,
    UserCount,
    VelocityEntry,
    VelocityReport,
    WorkloadReport,
    WorkspaceAnalytics,
)
from app.services import project_service, sprint_service
from app.utils.object_id import to_object_id
from app.utils.time import utcnow

TYPE_COLORS = {
    IssueType.EPIC: "#8B5CF6",
    IssueType.STORY: "#10B981",
    IssueType.TASK: "#0EA5E9",
    IssueType.BUG: "#F43F5E",
    IssueType.SUBTASK: "#64748B",
    IssueType.FEATURE: "#6366F1",
    IssueType.IMPROVEMENT: "#14B8A6",
    IssueType.MERGE_REQUEST: "#F59E0B",
    IssueType.INCIDENT: "#DC2626",
    IssueType.SPIKE: "#EC4899",
    IssueType.TEST: "#84CC16",
}
PRIORITY_COLORS = {
    Priority.LOW: "#64748B",
    Priority.MEDIUM: "#0EA5E9",
    Priority.HIGH: "#F59E0B",
    Priority.URGENT: "#F43F5E",
}
SUMMARY_DAYS = 14
DUE_SOON_DAYS = 7
CFD_DAYS = 30
TOP_ISSUES_LIMIT = 10
RECENT_ACTIVITY_LIMIT = 12
VELOCITY_SPRINTS = 8
TOP_CONTRIBUTORS = 8
SIGNUP_DAYS = 30


def day_range(days: int, end: date | None = None) -> list[date]:
    last = end or utcnow().date()
    return [last - timedelta(days=offset) for offset in range(days - 1, -1, -1)]


def created_vs_resolved(tasks: list[Task], days: list[date]) -> list[DayCreatedResolved]:
    created = Counter(task.created_at.date() for task in tasks)
    resolved = Counter(task.completed_at.date() for task in tasks if task.completed_at)
    return [
        DayCreatedResolved(date=day, created=created.get(day, 0), resolved=resolved.get(day, 0))
        for day in days
    ]


def type_counts(tasks: list[Task]) -> list[NamedCount]:
    counts = Counter(task.issue_type for task in tasks)
    return [
        NamedCount(
            key=issue_type.value,
            name=issue_type.value.replace("_", " ").title(),
            color=TYPE_COLORS[issue_type],
            count=counts[issue_type],
        )
        for issue_type in IssueType
        if counts[issue_type]
    ]


def priority_counts(tasks: list[Task]) -> list[NamedCount]:
    counts = Counter(task.priority for task in tasks)
    return [
        NamedCount(
            key=priority.value,
            name=priority.value.title(),
            color=PRIORITY_COLORS[priority],
            count=counts[priority],
        )
        for priority in Priority
    ]


async def _user_briefs(user_ids: list[PydanticObjectId]) -> dict[PydanticObjectId, UserBrief]:
    return {
        user.pk: UserBrief.from_user(user) for user in await user_repository.find_by_ids(user_ids)
    }


async def _load(auth: AuthContext, project_id: str) -> tuple[Project, list[Task]]:
    context = await project_service.get_context(auth, project_id)
    return context.project, await task_repository.all_in_project(context.project.pk)


def _is_overdue(task: Task, now: datetime) -> bool:
    return task.due_date is not None and task.completed_at is None and task.due_date < now


async def _assignee_counts(open_tasks: list[Task]) -> list[UserCount]:
    briefs = await _user_briefs([t.assignee_id for t in open_tasks if t.assignee_id])
    grouped: dict[PydanticObjectId | None, list[Task]] = defaultdict(list)
    for task in open_tasks:
        grouped[task.assignee_id].append(task)
    rows = [
        UserCount(
            user=briefs.get(user_id) if user_id else None,
            count=len(items),
            points=sum(item.story_points or 0 for item in items),
            minutes=sum(item.remaining_estimate_minutes or 0 for item in items),
        )
        for user_id, items in grouped.items()
    ]
    return sorted(rows, key=lambda row: (-row.count, row.user.name if row.user else ""))


async def _recent_activity(project: Project, tasks: list[Task]) -> list[ActivityRow]:
    entries = await activity_repository.recent_for_projects([project.pk], RECENT_ACTIVITY_LIMIT)
    by_id = {task.pk: task for task in tasks}
    briefs = await _user_briefs([entry.actor_id for entry in entries])
    rows: list[ActivityRow] = []
    for entry in entries:
        task = by_id.get(entry.task_id)
        if task is None:
            continue
        rows.append(
            ActivityRow(
                task_id=task.pk,
                task_key=f"{project.key}-{task.issue_number}",
                task_title=task.title,
                actor=briefs.get(entry.actor_id),
                action=entry.action,
                field=entry.field,
                old_value=entry.old_value,
                new_value=entry.new_value,
                created_at=entry.created_at,
            )
        )
    return rows


def _epic_progress(project: Project, tasks: list[Task]) -> list[EpicProgress]:
    rows: list[EpicProgress] = []
    for epic in (task for task in tasks if task.issue_type == IssueType.EPIC):
        children = [task for task in tasks if task.epic_id == epic.pk]
        done = [task for task in children if task.completed_at is not None]
        rows.append(
            EpicProgress(
                id=epic.pk,
                key=f"{project.key}-{epic.issue_number}",
                title=epic.title,
                total=len(children),
                done=len(done),
                story_points=sum(task.story_points or 0 for task in children),
                done_points=sum(task.story_points or 0 for task in done),
            )
        )
    return rows


async def project_summary(auth: AuthContext, project_id: str) -> ProjectSummary:
    project, tasks = await _load(auth, project_id)
    now = utcnow()
    week_ago = now - timedelta(days=7)
    open_tasks = [task for task in tasks if task.completed_at is None]
    status_counter = Counter(task.status_id for task in tasks)
    sprint = await sprint_repository.active_for_project(project.pk)
    active = None
    if sprint is not None:
        members = [task for task in tasks if task.sprint_id == sprint.pk and task.parent_id is None]
        remaining = (sprint.end_date.date() - now.date()).days if sprint.end_date else None
        active = ActiveSprintSummary(
            sprint=sprint_service.to_output(sprint, members),
            days_remaining=max(remaining, 0) if remaining is not None else None,
        )
    return ProjectSummary(
        total=len(tasks),
        done=len(tasks) - len(open_tasks),
        open=len(open_tasks),
        overdue=sum(1 for task in tasks if _is_overdue(task, now)),
        due_soon=sum(
            1
            for task in open_tasks
            if task.due_date and now <= task.due_date <= now + timedelta(days=DUE_SOON_DAYS)
        ),
        unassigned=sum(1 for task in open_tasks if task.assignee_id is None),
        created_last_7_days=sum(1 for task in tasks if task.created_at >= week_ago),
        resolved_last_7_days=sum(1 for t in tasks if t.completed_at and t.completed_at >= week_ago),
        estimate_minutes=sum(task.original_estimate_minutes or 0 for task in tasks),
        spent_minutes=sum(task.time_spent_minutes for task in tasks),
        remaining_minutes=sum(task.remaining_estimate_minutes or 0 for task in open_tasks),
        status_counts=[
            NamedCount(
                key=status.id,
                name=status.name,
                color=status.color,
                count=status_counter.get(status.id, 0),
            )
            for status in sorted(project.statuses, key=lambda item: item.order)
        ],
        type_counts=type_counts(tasks),
        priority_counts=priority_counts(open_tasks),
        assignee_counts=await _assignee_counts(open_tasks),
        created_vs_resolved=created_vs_resolved(tasks, day_range(SUMMARY_DAYS)),
        active_sprint=active,
        epics=_epic_progress(project, tasks),
        recent_activity=await _recent_activity(project, tasks),
    )


async def _load_sprint(auth: AuthContext, sprint_id: str) -> tuple[Sprint, Project]:
    sprint = await sprint_repository.get(to_object_id(sprint_id))
    if sprint is None:
        raise NotFoundError("Sprint not found", code="sprint_not_found")
    context = await project_service.get_context(auth, str(sprint.project_id))
    return sprint, context.project


def _weight(task: Task, use_points: bool) -> float:
    return (task.story_points or 0) if use_points else 1.0


async def burndown(auth: AuthContext, sprint_id: str) -> BurndownReport:
    sprint, _ = await _load_sprint(auth, sprint_id)
    members = [t for t in await task_repository.in_sprint(sprint.pk) if t.parent_id is None]
    use_points = sum(task.story_points or 0 for task in members) > 0 or sprint.committed_points > 0
    if sprint.state == SprintState.COMPLETED:
        total = sprint.committed_points if use_points else float(sprint.committed_issues)
    else:
        total = sum(_weight(task, use_points) for task in members)
    start = (sprint.start_date or sprint.created_at).date()
    end = (sprint.end_date or (sprint.start_date or sprint.created_at) + timedelta(days=14)).date()
    last_actual = (sprint.completed_at or utcnow()).date()
    span = max((end - start).days, 1)
    points: list[BurndownPoint] = []
    for offset in range((end - start).days + 1):
        day = start + timedelta(days=offset)
        completed = sum(
            _weight(task, use_points)
            for task in members
            if task.completed_at and task.completed_at.date() <= day
        )
        points.append(
            BurndownPoint(
                date=day,
                ideal=round(total * (1 - offset / span), 2),
                remaining=round(max(total - completed, 0), 2) if day <= last_actual else None,
            )
        )
    return BurndownReport(
        sprint=sprint_service.to_output(sprint, members),
        unit="points" if use_points else "issues",
        total=total,
        points=points,
    )


async def velocity(auth: AuthContext, project_id: str) -> VelocityReport:
    context = await project_service.get_context(auth, project_id)
    completed = await sprint_repository.recent_completed(context.project.pk, VELOCITY_SPRINTS)
    entries = [
        VelocityEntry(
            sprint_id=sprint.pk,
            name=sprint.name,
            committed_points=sprint.committed_points,
            completed_points=sprint.completed_points,
            committed_issues=sprint.committed_issues,
            completed_issues=sprint.completed_issues,
        )
        for sprint in reversed(completed)
    ]
    average = sum(e.completed_points for e in entries) / len(entries) if entries else 0.0
    return VelocityReport(sprints=entries, average_points=round(average, 1))


async def cumulative_flow(auth: AuthContext, project_id: str) -> CumulativeFlowReport:
    project, tasks = await _load(auth, project_id)
    days = day_range(CFD_DAYS)
    events: dict[PydanticObjectId, list[tuple[datetime, str]]] = defaultdict(list)
    for entry in await activity_repository.all_status_events(project.pk):
        if entry.new_id:
            events[entry.task_id].append((entry.created_at, entry.new_id))
    statuses = sorted(project.statuses, key=lambda item: item.order)
    counts = {status.id: [0] * len(days) for status in statuses}
    for task in tasks:
        timeline = sorted(events.get(task.pk, []))
        if not timeline or timeline[0][0] > task.created_at:
            timeline.insert(0, (task.created_at, timeline[0][1] if timeline else task.status_id))
        for index, day in enumerate(days):
            day_end = datetime.combine(day, datetime.max.time(), tzinfo=task.created_at.tzinfo)
            if task.created_at > day_end:
                continue
            current = None
            for moment, status_id in timeline:
                if moment <= day_end:
                    current = status_id
            if current in counts:
                counts[current][index] += 1
    return CumulativeFlowReport(
        dates=days,
        series=[
            FlowSeries(status_id=s.id, name=s.name, color=s.color, counts=counts[s.id])
            for s in reversed(statuses)
        ],
    )


async def time_tracking(auth: AuthContext, project_id: str, days: int) -> TimeTrackingReport:
    project, tasks = await _load(auth, project_id)
    since = utcnow() - timedelta(days=days)
    logs = await worklog_repository.for_project_since(project.pk, since)
    briefs = await _user_briefs([log.author_id for log in logs])
    by_user: dict[PydanticObjectId, int] = defaultdict(int)
    by_day: dict[date, int] = defaultdict(int)
    for log in logs:
        by_user[log.author_id] += log.minutes
        by_day[log.started_at.date()] += log.minutes
    ranked = sorted(tasks, key=lambda task: -task.time_spent_minutes)[:TOP_ISSUES_LIMIT]
    return TimeTrackingReport(
        estimate_minutes=sum(task.original_estimate_minutes or 0 for task in tasks),
        spent_minutes=sum(task.time_spent_minutes for task in tasks),
        remaining_minutes=sum(
            task.remaining_estimate_minutes or 0 for task in tasks if task.completed_at is None
        ),
        by_user=[
            UserCount(user=briefs.get(user_id), count=0, minutes=minutes)
            for user_id, minutes in sorted(by_user.items(), key=lambda item: -item[1])
        ],
        by_day=[DayMinutes(date=day, minutes=by_day.get(day, 0)) for day in day_range(days)],
        top_issues=[
            IssueTime(
                task_id=task.pk,
                key=f"{project.key}-{task.issue_number}",
                title=task.title,
                spent_minutes=task.time_spent_minutes,
                estimate_minutes=task.original_estimate_minutes,
                remaining_minutes=task.remaining_estimate_minutes,
            )
            for task in ranked
            if task.time_spent_minutes > 0
        ],
    )


async def workload(auth: AuthContext, project_id: str) -> WorkloadReport:
    _, tasks = await _load(auth, project_id)
    open_tasks = [task for task in tasks if task.completed_at is None]
    return WorkloadReport(rows=await _assignee_counts(open_tasks))


async def workspace_analytics(auth: AuthContext) -> WorkspaceAnalytics:
    require(auth.role, Permission.ADMIN_ACCESS, "Admin access required")
    project_ids = await project_repository.ids_in_workspace(auth.workspace_id)
    projects = await project_repository.find_by_ids(project_ids)
    tasks = await task_repository.for_projects(project_ids)
    by_project: dict[PydanticObjectId, list[Task]] = defaultdict(list)
    for task in tasks:
        by_project[task.project_id].append(task)
    now = utcnow()
    month_ago = now - timedelta(days=30)
    contributors: dict[PydanticObjectId, list[Task]] = defaultdict(list)
    for task in tasks:
        if task.assignee_id and task.completed_at and task.completed_at >= month_ago:
            contributors[task.assignee_id].append(task)
    logs = await worklog_repository.for_projects_since(project_ids, month_ago)
    minutes_by_user: dict[PydanticObjectId, int] = defaultdict(int)
    for log in logs:
        minutes_by_user[log.author_id] += log.minutes
    contributor_ids = set(contributors) | set(minutes_by_user)
    briefs = await _user_briefs(list(contributor_ids))
    contributor_rows = sorted(
        (
            UserCount(
                user=briefs.get(user_id),
                count=len(contributors.get(user_id, [])),
                points=sum(t.story_points or 0 for t in contributors.get(user_id, [])),
                minutes=minutes_by_user.get(user_id, 0),
            )
            for user_id in contributor_ids
        ),
        key=lambda row: (-row.count, -row.minutes),
    )[:TOP_CONTRIBUTORS]
    member_ids = await workspace_repository.member_user_ids(auth.workspace_id)
    users = await user_repository.find_by_ids(member_ids)
    signups = Counter(user.created_at.date() for user in users)
    since = now - timedelta(days=7)
    audit_rows, _ = await audit_repository.search(
        auth.workspace_id, None, None, None, since, 0, 500
    )
    audit_counter = Counter(row.action for row in audit_rows)
    active_sprints = 0
    for project_id in project_ids:
        if await sprint_repository.active_for_project(project_id):
            active_sprints += 1
    roles = {
        m.user_id: m.role for m in await workspace_repository.get_members_for_users(member_ids)
    }
    team_rows = []
    for user in sorted(users, key=lambda item: item.name.lower()):
        mine = [task for task in tasks if task.assignee_id == user.pk]
        team_rows.append(
            TeamMemberRow(
                user=UserBrief.from_user(user),
                role=roles[user.pk].value if user.pk in roles else "member",
                open_issues=sum(1 for task in mine if task.completed_at is None),
                overdue=sum(1 for task in mine if _is_overdue(task, now)),
                completed_30_days=len(contributors.get(user.pk, [])),
                minutes_30_days=minutes_by_user.get(user.pk, 0),
            )
        )
    return WorkspaceAnalytics(
        team=team_rows,
        total_open=sum(1 for task in tasks if task.completed_at is None),
        total_overdue=sum(1 for task in tasks if _is_overdue(task, now)),
        total_completed_30_days=sum(len(items) for items in contributors.values()),
        projects=[
            ProjectTotals(
                project_id=project.pk,
                name=project.name,
                key=project.key,
                color=project.color,
                total=len(by_project.get(project.pk, [])),
                done=sum(1 for t in by_project.get(project.pk, []) if t.completed_at),
            )
            for project in sorted(projects, key=lambda item: item.name.lower())
        ],
        type_counts=type_counts(tasks),
        priority_counts=priority_counts([task for task in tasks if task.completed_at is None]),
        created_vs_resolved=created_vs_resolved(tasks, day_range(SIGNUP_DAYS)),
        signups=[DayCount(date=day, count=signups.get(day, 0)) for day in day_range(SIGNUP_DAYS)],
        top_contributors=contributor_rows,
        active_sprints=active_sprints,
        total_minutes_logged=sum(minutes_by_user.values()),
        audit_events=[
            NamedCount(key=action, name=action.replace("_", " ").title(), count=count)
            for action, count in audit_counter.most_common()
        ],
    )
