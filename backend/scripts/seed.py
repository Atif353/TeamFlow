import argparse
import asyncio
import random
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from beanie import PydanticObjectId

from app.core.config import get_settings
from app.core.database import create_client, init_database
from app.core.security import hash_password
from app.models.activity_log import ActivityLog
from app.models.attachment import Attachment
from app.models.audit_log import AuditLog
from app.models.comment import Comment
from app.models.doc import Doc
from app.models.invitation import Invitation
from app.models.notification import Notification
from app.models.project import Project
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.user import User
from app.models.version import Version
from app.models.worklog import Worklog
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember
from app.permissions.context import AuthContext
from app.schemas.automation import AutomationRuleCreate
from app.schemas.comment import CommentCreate
from app.schemas.doc import DocCreate, DocLinkRequest, DocUpdate
from app.schemas.invitation import CreateInvitationRequest
from app.schemas.issue_link import IssueLinkCreate
from app.schemas.label import LabelCreate
from app.schemas.project import (
    AddProjectMemberRequest,
    ProjectCreate,
    StatusIn,
    UpdateComponentsRequest,
    UpdateStatusesRequest,
    UpdateWorkflowRequest,
)
from app.schemas.saved_filter import SavedFilterCreate
from app.schemas.sprint import (
    SprintComplete,
    SprintCreate,
    SprintStart,
    VersionCreate,
    VersionUpdate,
)
from app.schemas.task import ChecklistCreate, ChecklistUpdate, TaskCreate, TaskMove, TaskUpdate
from app.schemas.worklog import WorklogCreate
from app.services import (
    admin_service,
    attachment_service,
    audit_service,
    automation_service,
    bulk_service,
    comment_service,
    doc_service,
    email_service,
    filter_service,
    invitation_service,
    label_service,
    link_service,
    project_service,
    sprint_service,
    task_service,
    version_service,
    worklog_service,
)
from app.utils.avatar import avatar_color_for
from app.utils.time import utcnow
from scripts.seed_data import (
    ATTACHMENTS,
    BLUEPRINTS,
    COMMENTS,
    DEACTIVATED,
    DEMO_PASSWORD,
    DESCRIPTIONS,
    DIGEST_SUBSCRIBERS,
    PENDING_INVITES,
    PROJECT_START,
    REVOKED_INVITES,
    SPRINT_GOALS,
    SPRINT_SCHEDULE,
    SUBTASK_TITLES,
    USERS,
    Blueprint,
)

EMAIL_DOMAIN = "teamflow.demo"
SPRINT_SHARE = 0.88
SUBTASK_MIN_POINTS = 5


@dataclass
class Plan:
    title: str
    issue_type: str
    points: int
    epic: str | None
    component: str | None
    sprint_index: int | None
    created: datetime
    assignee: str | None
    creator: str
    priority: str
    due: date | None
    start: date | None
    description: str
    task_id: str = ""
    status: str = ""
    done_at: datetime | None = None
    subtask_ids: list[str] = field(default_factory=list)


async def silent_queue(*_: Any, **__: Any) -> None:
    return None


def at(day: date, hour: int = 10) -> datetime:
    return datetime.combine(day, time(hour=hour), tzinfo=UTC)


def to_date(parts: tuple[int, int, int]) -> date:
    return date(*parts)


class Seeder:
    def __init__(self, today: date) -> None:
        self.today = today
        self.now = utcnow() if today == date.today() else at(today, 18)
        self.rng = random.Random(20260901)
        self.people: dict[str, AuthContext] = {}
        self.admin: AuthContext
        self.status_ids: dict[str, str] = {}
        self.project_start = at(to_date(PROJECT_START), 8)

    def between(self, first: datetime, last: datetime) -> datetime:
        if last <= first:
            return first
        return first + (last - first) * self.rng.random()

    def clamp(self, value: datetime) -> datetime:
        return min(value, self.now)

    async def create_users(self) -> None:
        password_hash = hash_password(DEMO_PASSWORD)
        created: list[tuple[User, Any]] = []
        for name, prefix, role in USERS:
            email = f"{prefix}@{EMAIL_DOMAIN}"
            user = User(
                name=name,
                email=email,
                password_hash=password_hash,
                avatar_color=avatar_color_for(email),
            )
            await user.insert()
            created.append((user, role))
        workspace = Workspace(name="Acme Demo", owner_id=created[0][0].pk)
        workspace.created_at = self.project_start - timedelta(days=2)
        await workspace.insert()
        signup = self.project_start
        window = max((self.now - self.project_start).days - 3, 1)
        for index, (user, role) in enumerate(created):
            membership = WorkspaceMember(workspace_id=workspace.pk, user_id=user.pk, role=role)
            await membership.insert()
            prefix = USERS[index][1]
            self.people[prefix] = AuthContext(user=user, membership=membership)
            user.created_at = signup + timedelta(
                days=0 if index < 3 else self.rng.randint(0, window)
            )
            user.last_login_at = self.now - timedelta(hours=self.rng.randint(1, 72))
            if prefix in DIGEST_SUBSCRIBERS:
                user.email_preferences.daily_digest = True
                user.email_preferences.comments = True
            await user.save()
        self.admin = self.people["admin"]

    def pick_other(self, names: list[str], author: str) -> str:
        choices = [name for name in names if name != author]
        return self.people[self.rng.choice(choices)].user.name

    async def seed_project(self, bp: Blueprint) -> None:
        manager = self.people[bp.manager]
        members = [self.people[key] for key in [*bp.members, *bp.viewers]]
        project = await project_service.create_project(
            manager,
            ProjectCreate(name=bp.name, key=bp.key, description=bp.description, color=bp.color),
        )
        pid = str(project.id)
        for member in members:
            await project_service.add_member(
                manager, pid, AddProjectMemberRequest(user_id=member.user.pk)
            )
        original = list(project.statuses)
        project = await project_service.update_statuses(
            manager,
            pid,
            UpdateStatusesRequest(
                statuses=[
                    StatusIn(
                        id=original[source].id if source is not None else None,
                        name=name,
                        color=color,
                        is_done=done,
                        wip_limit=wip,
                    )
                    for name, color, done, wip, source in bp.statuses
                ]
            ),
        )
        self.status_ids = {status.name: status.id for status in project.statuses}
        await project_service.update_components(
            manager, pid, UpdateComponentsRequest(components=bp.components)
        )
        label_ids = [
            str((await label_service.create_label(manager, pid, LabelCreate(name=n, color=c))).id)
            for n, c in bp.labels
        ]
        for rule in bp.rules:
            await automation_service.create_rule(
                manager,
                pid,
                AutomationRuleCreate(
                    name=rule.name,
                    trigger=rule.trigger,
                    trigger_status_id=self.status_ids[rule.status] if rule.status else None,
                    action=rule.action,
                    action_value=rule.value,
                ),
            )
        version_ids = await self.create_versions(manager, pid, bp)
        epic_ids = await self.create_epics(manager, pid, bp)
        sprint_ids = await self.create_sprints(manager, pid) if bp.mode == "sprints" else []
        plans = self.plan_tasks(bp, sprint_ids)
        await self.create_tasks(bp, pid, plans, epic_ids, sprint_ids, label_ids)
        if bp.mode == "sprints":
            await self.run_sprints(bp, manager, sprint_ids, plans)
        else:
            await self.settle_kanban(bp, plans)
        await self.finish_epics(bp, manager, epic_ids)
        await self.add_work_and_talk(bp, plans)
        await self.assign_versions(manager, bp, plans, version_ids)
        await self.link_issues(manager, plans)
        await self.add_documents(manager, pid, bp, plans)
        await self.add_attachments(plans)
        for name, params in bp.filters:
            await filter_service.create_filter(
                manager, pid, SavedFilterCreate(name=name, params=params)
            )
        await project_service.update_workflow(
            manager,
            pid,
            UpdateWorkflowRequest(
                transitions={
                    self.status_ids[source]: [self.status_ids[target] for target in targets]
                    for source, targets in bp.transitions.items()
                }
            ),
        )
        for key, role in bp.overrides.items():
            await admin_service.set_project_override(
                self.admin, str(self.people[key].user.pk), pid, role
            )
        await self.retime_project(PydanticObjectId(pid), bp, plans, epic_ids)

    async def create_versions(
        self, manager: AuthContext, pid: str, bp: Blueprint
    ) -> dict[str, tuple[str, date]]:
        result: dict[str, tuple[str, date]] = {}
        for name, release, description in bp.versions:
            release_date = to_date(release)
            version = await version_service.create_version(
                manager,
                pid,
                VersionCreate(
                    name=name,
                    description=description,
                    start_date=release_date - timedelta(days=28),
                    release_date=release_date,
                ),
            )
            if release_date <= self.today:
                await version_service.update_version(
                    manager, str(version.id), VersionUpdate(released=True)
                )
                await Version.find_one({"_id": version.id}).update(
                    {"$set": {"released_at": at(release_date, 15)}}
                )
            result[name] = (str(version.id), release_date)
        return result

    async def create_epics(
        self, manager: AuthContext, pid: str, bp: Blueprint
    ) -> dict[str, tuple[str, date]]:
        result: dict[str, tuple[str, date]] = {}
        for title, start, due in bp.epics:
            epic = await task_service.create_task(
                manager,
                pid,
                TaskCreate(
                    title=title,
                    issue_type="epic",
                    start_date=to_date(start),
                    due_date=to_date(due),
                    description=f"<p>Umbrella for everything related to {title.lower()}.</p>",
                ),
            )
            result[title] = (str(epic.id), to_date(due))
        return result

    async def create_sprints(self, manager: AuthContext, pid: str) -> list[str]:
        ids: list[str] = []
        for index, (name, _, _) in enumerate(SPRINT_SCHEDULE):
            sprint = await sprint_service.create_sprint(
                manager, pid, SprintCreate(name=name, goal=SPRINT_GOALS[index])
            )
            ids.append(str(sprint.id))
        return ids

    def plan_tasks(self, bp: Blueprint, sprint_ids: list[str]) -> list[Plan]:
        total = len(bp.pool)
        per_sprint = max(1, round(total * SPRINT_SHARE / len(SPRINT_SCHEDULE)))
        start = to_date(PROJECT_START)
        span = max((self.today - start).days, 1)
        plans: list[Plan] = []
        for index, (title, issue_type, points, epic_index, component_index) in enumerate(bp.pool):
            sprint_index: int | None = None
            if bp.mode == "sprints" and index // per_sprint < len(SPRINT_SCHEDULE):
                sprint_index = index // per_sprint
            if sprint_index is not None:
                sprint_start = to_date(SPRINT_SCHEDULE[sprint_index][1])
                created_day = sprint_start - timedelta(days=self.rng.randint(0, 8))
                due: date | None = (
                    to_date(SPRINT_SCHEDULE[sprint_index][2]) if self.rng.random() < 0.65 else None
                )
                begin: date | None = (
                    sprint_start + timedelta(days=self.rng.randint(0, 4))
                    if self.rng.random() < 0.4
                    else None
                )
            else:
                spread = span * index // total + self.rng.randint(-2, 2)
                created_day = start + timedelta(days=max(spread, 0))
                due = created_day + timedelta(days=self.rng.randint(7, 40))
                begin = None
            created_day = min(max(created_day, start), self.today)
            plans.append(
                Plan(
                    title=title,
                    issue_type=issue_type,
                    points=points,
                    epic=bp.epics[epic_index][0] if epic_index is not None else None,
                    component=bp.components[component_index]
                    if component_index is not None
                    else None,
                    sprint_index=sprint_index,
                    created=self.clamp(at(created_day, self.rng.randint(8, 17))),
                    assignee=self.choose_assignee(bp, sprint_index),
                    creator=bp.manager if self.rng.random() < 0.5 else self.rng.choice(bp.members),
                    priority=self.choose_priority(issue_type),
                    due=due,
                    start=begin,
                    description=self.rng.choice(DESCRIPTIONS).format(title=title),
                )
            )
        return plans

    def choose_assignee(self, bp: Blueprint, sprint_index: int | None) -> str | None:
        unassigned = 0.35 if bp.mode == "sprints" and sprint_index is None else 0.08
        if self.rng.random() < unassigned:
            return None
        return self.rng.choice(bp.members)

    def choose_priority(self, issue_type: str) -> str:
        if issue_type == "incident":
            return self.rng.choice(["urgent", "urgent", "high"])
        if issue_type == "bug":
            return self.rng.choice(["urgent", "high", "high", "medium", "medium", "low"])
        return self.rng.choice(["high", "medium", "medium", "medium", "low"])

    def actor(self, plan: Plan, bp: Blueprint) -> AuthContext:
        return self.people[plan.assignee or bp.manager]

    async def create_tasks(
        self,
        bp: Blueprint,
        pid: str,
        plans: list[Plan],
        epic_ids: dict[str, tuple[str, date]],
        sprint_ids: list[str],
        label_ids: list[str],
    ) -> None:
        label_by_type = {"bug": 0, "incident": 0, "feature": 1, "story": 1}
        for plan in plans:
            creator = self.people[plan.creator]
            labels = [label_ids[label_by_type.get(plan.issue_type, 3)]]
            task = await task_service.create_task(
                creator,
                pid,
                TaskCreate(
                    title=plan.title,
                    description=plan.description,
                    issue_type=plan.issue_type,
                    priority=plan.priority,
                    assignee_id=self.people[plan.assignee].user.pk if plan.assignee else None,
                    start_date=plan.start,
                    due_date=plan.due,
                    label_ids=[PydanticObjectId(label) for label in labels],
                    epic_id=PydanticObjectId(epic_ids[plan.epic][0]) if plan.epic else None,
                    sprint_id=(
                        PydanticObjectId(sprint_ids[plan.sprint_index])
                        if plan.sprint_index is not None
                        else None
                    ),
                    story_points=plan.points,
                    original_estimate_minutes=plan.points * self.rng.choice([90, 120, 150]),
                    components=[plan.component] if plan.component else [],
                    environment="Production" if plan.issue_type in ("bug", "incident") else "",
                ),
            )
            plan.task_id = str(task.id)
            plan.status = bp.flow[0]
            await self.decorate(pid, plan, creator)

    async def decorate(self, pid: str, plan: Plan, creator: AuthContext) -> None:
        if plan.issue_type not in ("bug", "incident", "merge_request") and self.rng.random() < 0.3:
            for text in self.rng.sample(
                ["Design reviewed", "Edge cases listed", "Tests written", "Docs updated", "Demoed"],
                self.rng.randint(2, 4),
            ):
                await task_service.add_checklist_item(
                    creator, plan.task_id, ChecklistCreate(text=text)
                )
        if plan.issue_type in ("story", "feature") and plan.points >= SUBTASK_MIN_POINTS:
            for title in self.rng.sample(SUBTASK_TITLES, self.rng.randint(2, 3)):
                subtask = await task_service.create_task(
                    creator,
                    pid,
                    TaskCreate(
                        title=f"{title}: {plan.title}"[:200],
                        parent_id=PydanticObjectId(plan.task_id),
                        assignee_id=self.people[plan.assignee].user.pk if plan.assignee else None,
                    ),
                )
                plan.subtask_ids.append(str(subtask.id))

    async def advance(self, bp: Blueprint, plan: Plan, target: str) -> None:
        if plan.status == target:
            return
        actor = self.actor(plan, bp)
        if target == bp.blocked:
            await self.advance(bp, plan, bp.flow[1])
            await self.move(actor, plan.task_id, target)
            plan.status = target
            return
        names = bp.flow
        start = names.index(plan.status) + 1 if plan.status in names else 1
        for name in names[start : names.index(target) + 1]:
            await self.move(actor, plan.task_id, name)
        plan.status = target

    async def move(self, actor: AuthContext, task_id: str, name: str) -> None:
        await task_service.move_task(actor, task_id, TaskMove(status_id=self.status_ids[name]))

    async def finish(self, bp: Blueprint, plan: Plan, done_at: datetime) -> None:
        await self.advance(bp, plan, bp.flow[-1])
        plan.done_at = done_at
        for subtask_id in plan.subtask_ids:
            await self.move(self.actor(plan, bp), subtask_id, bp.flow[-1])

    async def start_progress(self, bp: Blueprint, plan: Plan) -> None:
        middle = bp.flow[1:-1]
        await self.advance(bp, plan, self.rng.choice(middle))
        if plan.subtask_ids:
            await self.move(self.actor(plan, bp), plan.subtask_ids[0], bp.flow[-1])

    async def run_sprints(
        self,
        bp: Blueprint,
        manager: AuthContext,
        sprint_ids: list[str],
        plans: list[Plan],
    ) -> None:
        by_id = {plan.task_id: plan for plan in plans}
        for index, (_, start, end) in enumerate(SPRINT_SCHEDULE):
            start_day, end_day = to_date(start), to_date(end)
            sprint_id = sprint_ids[index]
            if start_day > self.today:
                break
            await sprint_service.start_sprint(
                manager, sprint_id, SprintStart(start_date=start_day, end_date=end_day)
            )
            tasks = await Task.find(
                {"sprint_id": PydanticObjectId(sprint_id), "parent_id": None}
            ).to_list()
            members = [by_id[str(task.id)] for task in tasks if str(task.id) in by_id]
            finished = end_day < self.today
            elapsed = (
                1.0
                if finished
                else (self.today - start_day).days / max((end_day - start_day).days, 1)
            )
            for plan in members:
                await self.progress_in_sprint(bp, plan, start_day, end_day, finished, elapsed)
            if finished:
                following = sprint_ids[index + 1] if index + 1 < len(sprint_ids) else None
                await sprint_service.complete_sprint(
                    manager,
                    sprint_id,
                    SprintComplete(
                        move_to_sprint_id=PydanticObjectId(following) if following else None
                    ),
                )
                await Sprint.find_one({"_id": PydanticObjectId(sprint_id)}).update(
                    {
                        "$set": {
                            "created_at": at(start_day - timedelta(days=4), 9),
                            "started_at": at(start_day, 9),
                            "completed_at": at(end_day, 17),
                        }
                    }
                )
            else:
                await Sprint.find_one({"_id": PydanticObjectId(sprint_id)}).update(
                    {
                        "$set": {
                            "created_at": at(start_day - timedelta(days=4), 9),
                            "started_at": at(start_day, 9),
                        }
                    }
                )

    async def progress_in_sprint(
        self,
        bp: Blueprint,
        plan: Plan,
        start_day: date,
        end_day: date,
        finished: bool,
        elapsed: float,
    ) -> None:
        window_end = at(min(end_day, self.today), 16)
        window_start = at(start_day + timedelta(days=1), 10)
        roll = self.rng.random()
        done_chance = 0.85 if finished else elapsed * 0.65
        if roll < done_chance and window_start < window_end:
            await self.finish(bp, plan, self.clamp(self.between(window_start, window_end)))
        elif roll < done_chance + (0.12 if finished else 0.5):
            await self.start_progress(bp, plan)

    async def settle_kanban(self, bp: Blueprint, plans: list[Plan]) -> None:
        for plan in plans:
            age = (self.now - plan.created).days
            roll = self.rng.random()
            done_chance = min(0.85, age / 55)
            if roll < done_chance and age >= 1:
                finished_at = plan.created + timedelta(days=self.rng.randint(1, min(18, age)))
                await self.finish(bp, plan, self.clamp(finished_at))
            elif roll < done_chance + 0.25:
                await self.start_progress(bp, plan)
            elif bp.blocked and roll > 0.93:
                await self.advance(bp, plan, bp.blocked)

    async def finish_epics(
        self,
        bp: Blueprint,
        manager: AuthContext,
        epic_ids: dict[str, tuple[str, date]],
    ) -> None:
        for title, (epic_id, due) in epic_ids.items():
            start = next(to_date(item[1]) for item in bp.epics if item[0] == title)
            if due < self.today:
                target = bp.flow[-1]
            elif start < self.today:
                target = bp.flow[1]
            else:
                continue
            for name in bp.flow[1 : bp.flow.index(target) + 1]:
                await self.move(manager, epic_id, name)

    async def add_work_and_talk(self, bp: Blueprint, plans: list[Plan]) -> None:
        participants = list(bp.members)
        for plan in plans:
            started = plan.status != bp.flow[0]
            end = plan.done_at or self.clamp(plan.created + timedelta(days=self.rng.randint(3, 14)))
            actor = self.actor(plan, bp)
            if started and plan.assignee:
                total = int(plan.points * self.rng.uniform(80, 140))
                entries = self.rng.randint(1, 3)
                for _ in range(entries):
                    logged_at = self.clamp(
                        self.between(
                            plan.created + timedelta(hours=24),
                            max(end, plan.created + timedelta(hours=25)),
                        )
                    )
                    await worklog_service.create_worklog(
                        actor,
                        plan.task_id,
                        WorklogCreate(
                            minutes=max(15, total // entries),
                            started_at=logged_at,
                            comment=self.rng.choice(
                                ["", "", "Pairing session", "Investigation", "Implementation"]
                            ),
                        ),
                    )
            if self.rng.random() < 0.5:
                for _ in range(self.rng.randint(1, 3)):
                    author = self.rng.choice([bp.manager, *participants])
                    body = self.rng.choice(COMMENTS).format(
                        other=self.pick_other(participants, author)
                    )
                    await comment_service.create_comment(
                        self.people[author], plan.task_id, CommentCreate(body=body)
                    )
            if self.rng.random() < 0.15:
                watcher = self.people[self.rng.choice(participants)]
                await task_service.set_watching(watcher, plan.task_id, True)
            if plan.done_at is None and plan.priority == "urgent" and self.rng.random() < 0.5:
                await task_service.update_task(
                    self.people[bp.manager], plan.task_id, TaskUpdate(flagged=True)
                )
            await self.tick_checklist(actor, plan)

    async def tick_checklist(self, actor: AuthContext, plan: Plan) -> None:
        task = await Task.get(plan.task_id)
        assert task is not None
        for item in task.checklist:
            done = plan.done_at is not None or self.rng.random() < 0.4
            if done:
                await task_service.update_checklist_item(
                    actor, plan.task_id, item.id, ChecklistUpdate(done=True)
                )

    async def assign_versions(
        self,
        manager: AuthContext,
        bp: Blueprint,
        plans: list[Plan],
        version_ids: dict[str, tuple[str, date]],
    ) -> None:
        ordered = sorted(version_ids.values(), key=lambda item: item[1])
        for plan in plans:
            if plan.issue_type in ("incident", "spike", "test") or self.rng.random() < 0.3:
                continue
            reference = (plan.done_at.date() if plan.done_at else plan.due) or self.today
            target = next((item for item in ordered if item[1] >= reference), ordered[-1])
            await task_service.update_task(
                manager, plan.task_id, TaskUpdate(version_id=PydanticObjectId(target[0]))
            )

    async def link_issues(self, manager: AuthContext, plans: list[Plan]) -> None:
        used: set[tuple[int, int]] = set()
        bugs = [index for index, plan in enumerate(plans) if plan.issue_type == "bug"]
        plan_kinds = [("blocks", 6), ("relates_to", 6)]
        for link_type, count in plan_kinds:
            made = 0
            while made < count:
                first, second = sorted(self.rng.sample(range(len(plans)), 2))
                if (first, second) in used:
                    continue
                used.add((first, second))
                await link_service.create_link(
                    manager,
                    plans[first].task_id,
                    IssueLinkCreate(target=plans[second].task_id, link_type=link_type),
                )
                made += 1
        if len(bugs) >= 2:
            first, second = bugs[0], bugs[-1]
            if (first, second) not in used:
                await link_service.create_link(
                    manager,
                    plans[second].task_id,
                    IssueLinkCreate(target=plans[first].task_id, link_type="duplicates"),
                )
        copy = await bulk_service.clone_task(manager, plans[self.rng.randrange(len(plans))].task_id)
        await Task.find_one({"_id": copy.id}).update(
            {"$set": {"created_at": self.now - timedelta(days=self.rng.randint(1, 4))}}
        )

    async def add_documents(
        self, manager: AuthContext, pid: str, bp: Blueprint, plans: list[Plan]
    ) -> None:
        for index, spec in enumerate(bp.docs):
            doc = await doc_service.create_doc(
                manager, pid, DocCreate(title=spec.title, content=spec.body)
            )
            await doc_service.update_doc(
                manager, str(doc.id), DocUpdate(content=spec.body + spec.addition)
            )
            for plan in self.rng.sample(plans, 2):
                await doc_service.link_task(manager, str(doc.id), DocLinkRequest(task=plan.task_id))
            created = self.project_start + timedelta(days=3 + index * 9)
            updated = self.clamp(created + timedelta(days=self.rng.randint(4, 20)))
            stored = await Doc.get(doc.id)
            assert stored is not None
            stored.created_at, stored.updated_at = created, updated
            for number, version in enumerate(stored.versions):
                version.saved_at = created + (updated - created) * (
                    number / max(len(stored.versions), 1)
                )
            await stored.save()

    async def add_attachments(self, plans: list[Plan]) -> None:
        for plan in self.rng.sample(plans, 3):
            name, content_type, content = self.rng.choice(ATTACHMENTS)
            uploader = self.people[plan.assignee or plan.creator]
            await attachment_service.upload(uploader, plan.task_id, name, content_type, content)

    async def retime_project(
        self,
        pid: PydanticObjectId,
        bp: Blueprint,
        plans: list[Plan],
        epic_ids: dict[str, tuple[str, date]],
    ) -> None:
        project = await Project.get(pid)
        assert project is not None
        project.created_at = self.project_start
        project.updated_at = self.clamp(self.project_start + timedelta(days=5))
        await project.save()
        await Version.find({"project_id": pid}).update({"$set": {"created_at": self.project_start}})
        for plan in plans:
            end = plan.done_at or self.clamp(plan.created + timedelta(days=self.rng.randint(3, 14)))
            await self.retime_task(plan.task_id, plan.created, end, plan.done_at)
            for subtask_id in plan.subtask_ids:
                await self.retime_task(subtask_id, plan.created, end, plan.done_at)
        for title, (epic_id, due) in epic_ids.items():
            start = next(item[1] for item in bp.epics if item[0] == title)
            created = max(at(to_date(start) - timedelta(days=2), 9), self.project_start)
            finished = at(due, 16) if due < self.today else None
            await self.retime_task(
                epic_id, min(created, self.now), min(finished or self.now, self.now), finished
            )

    async def retime_task(
        self, task_id: str, created: datetime, end: datetime, done_at: datetime | None
    ) -> None:
        oid = PydanticObjectId(task_id)
        end = min(max(end, created + timedelta(hours=1)), self.now)
        task = await Task.get(oid)
        if task is None:
            return
        task.created_at = created
        task.updated_at = end
        task.completed_at = done_at if task.completed_at is not None else None
        await task.save()
        logs = await ActivityLog.find({"task_id": oid}).sort("_id").to_list()
        for index, log in enumerate(logs):
            log.created_at = created + (end - created) * (index / max(len(logs) - 1, 1))
            await log.save()
        comments = await Comment.find({"task_id": oid}).sort("_id").to_list()
        for index, comment in enumerate(comments):
            comment.created_at = created + (end - created) * ((index + 1) / (len(comments) + 1))
            await comment.save()
        for entry in await Worklog.find({"task_id": oid}).to_list():
            entry.created_at = entry.updated_at = entry.started_at + timedelta(hours=2)
            await entry.save()
        for attachment in await Attachment.find({"task_id": oid}).to_list():
            attachment.created_at = min(created + timedelta(days=1), end)
            await attachment.save()
        for note in await Notification.find({"task_id": oid}).to_list():
            note.created_at = self.between(created, end)
            note.is_read = note.created_at < self.now - timedelta(days=3) or self.rng.random() < 0.3
            await note.save()

    async def finish_workspace(self) -> None:
        for email, role in PENDING_INVITES:
            await invitation_service.create(
                self.admin, CreateInvitationRequest(email=email, role=role)
            )
        for email, role in REVOKED_INVITES:
            created = await invitation_service.create(
                self.admin, CreateInvitationRequest(email=email, role=role)
            )
            await invitation_service.revoke(self.admin, str(created.id))
        for invitation in await Invitation.find_all().to_list():
            invitation.created_at = self.now - timedelta(days=self.rng.randint(1, 5))
            await invitation.save()
        await admin_service.change_status(self.admin, str(self.people[DEACTIVATED].user.pk), False)
        await audit_service.record(
            self.admin,
            "demo_seeded",
            "workspace",
            "Seeded the workspace with September to November data",
        )
        entries = await AuditLog.find_all().sort("_id").to_list()
        for index, entry in enumerate(entries):
            entry.created_at = self.project_start + (self.now - self.project_start) * (
                index / max(len(entries) - 1, 1)
            )
            await entry.save()


async def flush(database: Any) -> None:
    for name in await database.list_collection_names():
        await database[name].delete_many({})


async def run(today: date) -> None:
    settings = get_settings()
    client = create_client(settings.mongodb_uri)
    database = client[settings.mongodb_db]
    await init_database(database)
    await flush(database)
    email_service.queue = silent_queue
    seeder = Seeder(today)
    await seeder.create_users()
    for blueprint in BLUEPRINTS:
        await seeder.seed_project(blueprint)
        print(f"  seeded {blueprint.name} ({blueprint.key})")
    await seeder.finish_workspace()
    await client.close()
    print(f"Done. Data runs from 2026-09-01; history is filled up to {today}.")
    print(f"Sign in with any account below (password: {DEMO_PASSWORD}):")
    for name, prefix, role in USERS:
        print(f"  {role.value:<16} {prefix + '@' + EMAIL_DOMAIN:<26} {name}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Flush the database and seed September to November 2026"
    )
    parser.add_argument(
        "--today",
        type=date.fromisoformat,
        default=date.today(),
        help="Treat this date as today; work before it is finished, work after it is planned",
    )
    arguments = parser.parse_args()
    asyncio.run(run(arguments.today))


if __name__ == "__main__":
    main()
