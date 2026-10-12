from collections import Counter
from datetime import UTC, date, datetime, time, timedelta

from beanie import PydanticObjectId

from app.models.project import Project
from app.models.task import Task
from app.permissions.context import AuthContext
from app.repositories.project_repository import project_repository
from app.repositories.task_repository import task_repository
from app.repositories.worklog_repository import worklog_repository
from app.schemas.dashboard import (
    DashboardCharts,
    DashboardOut,
    DashboardProject,
    DashboardStats,
    DashboardTask,
)
from app.schemas.report import DayCount, DayMinutes, NamedCount
from app.services import project_service
from app.services.report_service import day_range, priority_counts, type_counts
from app.utils.time import datetime_to_date, utcnow

MY_TASKS_LIMIT = 10
CHART_DAYS = 14
DASHBOARD_PROJECTS_LIMIT = 12


async def _charts(
    auth: AuthContext,
    projects: dict[PydanticObjectId, Project],
    project_ids: list[PydanticObjectId],
    open_tasks: list[Task],
) -> DashboardCharts:
    days = day_range(CHART_DAYS)
    window_start = datetime.combine(days[0], time.min, tzinfo=UTC)
    assigned = await task_repository.assigned_to(auth.user.pk, project_ids)
    completed = Counter(
        task.completed_at.date()
        for task in assigned
        if task.completed_at and task.completed_at >= window_start
    )
    logs = await worklog_repository.for_user_since(auth.user.pk, window_start)
    logged: Counter[date] = Counter()
    for log in logs:
        logged[log.started_at.date()] += log.minutes
    status_names: dict[str, tuple[str, int]] = {}
    for task in open_tasks:
        status = projects[task.project_id].status_by_id(task.status_id)
        if status is None:
            continue
        color, count = status_names.get(status.name, (status.color, 0))
        status_names[status.name] = (color, count + 1)
    week_start = utcnow().date() - timedelta(days=utcnow().date().weekday())
    return DashboardCharts(
        by_status=[
            NamedCount(key=name, name=name, color=color, count=count)
            for name, (color, count) in status_names.items()
        ],
        by_type=type_counts(open_tasks),
        by_priority=priority_counts(open_tasks),
        completed_per_day=[DayCount(date=day, count=completed.get(day, 0)) for day in days],
        logged_per_day=[DayMinutes(date=day, minutes=logged.get(day, 0)) for day in days],
        minutes_logged_week=sum(m for d, m in logged.items() if d >= week_start),
    )


def _is_overdue(task: Task, today: date) -> bool:
    due = datetime_to_date(task.due_date)
    return due is not None and due < today


def _task_row(task: Task, project: Project, today: date) -> DashboardTask:
    status = project.status_by_id(task.status_id)
    return DashboardTask(
        id=task.pk,
        key=f"{project.key}-{task.issue_number}",
        issue_type=task.issue_type,
        title=task.title,
        project_id=project.pk,
        project_key=project.key,
        project_name=project.name,
        priority=task.priority,
        due_date=datetime_to_date(task.due_date),
        status_name=status.name if status else "",
        status_color=status.color if status else "#64748B",
        is_overdue=_is_overdue(task, today),
    )


async def get_dashboard(auth: AuthContext) -> DashboardOut:
    now = utcnow()
    today = now.date()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    week_start_dt = datetime.combine(week_start, time.min, tzinfo=UTC)

    project_ids = await project_service.visible_project_ids(auth)
    projects = {
        project.pk: project for project in await project_repository.find_by_ids(project_ids)
    }
    open_tasks = await task_repository.open_assigned(auth.user.pk, project_ids)

    overdue = [t for t in open_tasks if _is_overdue(t, today)]
    due_this_week = [t for t in open_tasks if _due_within(t, today, week_end)]
    completed = await task_repository.count_completed_since(
        auth.user.pk, project_ids, week_start_dt
    )

    far_future = today + timedelta(days=36500)
    ordered = sorted(
        open_tasks,
        key=lambda t: (datetime_to_date(t.due_date) or far_future, -t.priority_rank, str(t.pk)),
    )[:MY_TASKS_LIMIT]

    progress = await task_repository.project_progress(project_ids)
    recent_projects = sorted(projects.values(), key=lambda p: p.updated_at, reverse=True)[
        :DASHBOARD_PROJECTS_LIMIT
    ]
    return DashboardOut(
        charts=await _charts(auth, projects, project_ids, open_tasks),
        stats=DashboardStats(
            assigned_open=len(open_tasks),
            overdue=len(overdue),
            due_this_week=len(due_this_week),
            completed_this_week=completed,
        ),
        my_tasks=[_task_row(t, projects[t.project_id], today) for t in ordered],
        projects=[
            DashboardProject(
                id=project.pk,
                name=project.name,
                key=project.key,
                color=project.color,
                total_tasks=progress.get(project.pk, (0, 0))[0],
                done_tasks=progress.get(project.pk, (0, 0))[1],
                progress_percent=_percent(*progress.get(project.pk, (0, 0))),
            )
            for project in recent_projects
        ],
    )


def _due_within(task: Task, start: date, end: date) -> bool:
    due = datetime_to_date(task.due_date)
    return due is not None and start <= due <= end


def _percent(total: int, done: int) -> int:
    return round(done * 100 / total) if total else 0
