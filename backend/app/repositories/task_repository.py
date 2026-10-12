import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from beanie import PydanticObjectId

from app.models.task import IssueType, Priority, Task
from app.repositories.base import ASC, DESC, BaseRepository, contains_pattern

SORT_FIELDS = {
    "position": "position",
    "rank": "rank",
    "created_at": "created_at",
    "updated_at": "updated_at",
    "due_date": "due_date",
    "priority": "priority_rank",
    "title": "title",
    "key": "issue_number",
    "story_points": "story_points",
}

ISSUE_KEY_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9]*-(\d+)$")


@dataclass
class TaskFilters:
    parent_id: PydanticObjectId | None = None
    include_subtasks: bool = False
    status_id: str | None = None
    assignee_id: PydanticObjectId | None = None
    unassigned: bool = False
    priority: Priority | None = None
    label_id: PydanticObjectId | None = None
    issue_types: list[IssueType] = field(default_factory=list)
    exclude_epics: bool = False
    epic_id: PydanticObjectId | None = None
    sprint_id: PydanticObjectId | None = None
    backlog: bool = False
    version_id: PydanticObjectId | None = None
    resolved: bool | None = None
    due_before: datetime | None = None
    due_after: datetime | None = None
    q: str | None = None


class TaskRepository(BaseRepository[Task]):
    def __init__(self) -> None:
        super().__init__(Task)

    async def list_for_projects(
        self,
        project_ids: list[PydanticObjectId],
        filters: TaskFilters,
        sort_field: str,
        descending: bool,
        skip: int,
        limit: int,
    ) -> tuple[list[Task], int]:
        query = self._build_query(project_ids, filters)
        direction = DESC if descending else ASC
        sort = [(SORT_FIELDS[sort_field], direction), ("_id", direction)]
        total = await Task.find(query).count()
        items = await Task.find(query).sort(sort).skip(skip).limit(limit).to_list()
        return items, total

    async def list_for_project(
        self,
        project_id: PydanticObjectId,
        filters: TaskFilters,
        sort_field: str,
        descending: bool,
        skip: int,
        limit: int,
    ) -> tuple[list[Task], int]:
        return await self.list_for_projects(
            [project_id], filters, sort_field, descending, skip, limit
        )

    async def all_in_project(self, project_id: PydanticObjectId) -> list[Task]:
        return await Task.find({"project_id": project_id}).to_list()

    async def get_by_number(self, project_id: PydanticObjectId, number: int) -> Task | None:
        return await Task.find_one({"project_id": project_id, "issue_number": number})

    async def list_children(self, parent_id: PydanticObjectId) -> list[Task]:
        return await Task.find({"parent_id": parent_id}).sort([("position", ASC)]).to_list()

    async def child_ids(self, parent_id: PydanticObjectId) -> list[PydanticObjectId]:
        return [child.pk for child in await self.list_children(parent_id)]

    async def epic_children(self, epic_id: PydanticObjectId) -> list[Task]:
        return await Task.find({"epic_id": epic_id}).sort([("rank", ASC)]).to_list()

    async def column(self, project_id: PydanticObjectId, status_id: str) -> list[Task]:
        return (
            await Task.find({"project_id": project_id, "status_id": status_id, "parent_id": None})
            .sort([("position", ASC), ("_id", ASC)])
            .to_list()
        )

    async def edge_position(
        self,
        project_id: PydanticObjectId,
        status_id: str,
        parent_id: PydanticObjectId | None,
        last: bool,
    ) -> float | None:
        direction = DESC if last else ASC
        tasks = (
            await Task.find(
                {"project_id": project_id, "status_id": status_id, "parent_id": parent_id}
            )
            .sort([("position", direction)])
            .limit(1)
            .to_list()
        )
        return tasks[0].position if tasks else None

    async def edge_rank(self, project_id: PydanticObjectId, last: bool) -> float | None:
        direction = DESC if last else ASC
        tasks = (
            await Task.find({"project_id": project_id})
            .sort([("rank", direction)])
            .limit(1)
            .to_list()
        )
        return tasks[0].rank if tasks else None

    async def ranked_scope(
        self, project_id: PydanticObjectId, sprint_id: PydanticObjectId | None
    ) -> list[Task]:
        return (
            await Task.find({"project_id": project_id, "sprint_id": sprint_id, "parent_id": None})
            .sort([("rank", ASC), ("_id", ASC)])
            .to_list()
        )

    async def count_in_status(self, project_id: PydanticObjectId, status_id: str) -> int:
        return await Task.find({"project_id": project_id, "status_id": status_id}).count()

    async def set_completion_for_statuses(
        self,
        project_id: PydanticObjectId,
        status_ids: list[str],
        completed_at: datetime | None,
    ) -> None:
        if not status_ids:
            return
        current = None if completed_at else {"$ne": None}
        await Task.find(
            {"project_id": project_id, "status_id": {"$in": status_ids}, "completed_at": current}
        ).update({"$set": {"completed_at": completed_at}})

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await Task.find({"project_id": project_id}).delete()

    async def delete_many(self, task_ids: list[PydanticObjectId]) -> None:
        if task_ids:
            await Task.find({"_id": {"$in": task_ids}}).delete()

    async def unassign_in_project(
        self, project_id: PydanticObjectId, user_id: PydanticObjectId
    ) -> None:
        await Task.find({"project_id": project_id, "assignee_id": user_id}).update(
            {"$set": {"assignee_id": None}}
        )
        await Task.find({"project_id": project_id, "watcher_ids": user_id}).update(
            {"$pull": {"watcher_ids": user_id}}
        )

    async def remove_label(self, project_id: PydanticObjectId, label_id: PydanticObjectId) -> None:
        await Task.find({"project_id": project_id, "label_ids": label_id}).update(
            {"$pull": {"label_ids": label_id}}
        )

    async def clear_epic(self, epic_id: PydanticObjectId) -> None:
        await Task.find({"epic_id": epic_id}).update({"$set": {"epic_id": None}})

    async def clear_sprint(self, sprint_id: PydanticObjectId) -> None:
        await Task.find({"sprint_id": sprint_id}).update({"$set": {"sprint_id": None}})

    async def clear_version(self, version_id: PydanticObjectId) -> None:
        await Task.find({"version_id": version_id}).update({"$set": {"version_id": None}})

    async def remove_component(self, project_id: PydanticObjectId, name: str) -> None:
        await Task.find({"project_id": project_id, "components": name}).update(
            {"$pull": {"components": name}}
        )

    async def move_unfinished_out_of_sprint(self, sprint_id: PydanticObjectId) -> None:
        await Task.find({"sprint_id": sprint_id, "completed_at": None}).update(
            {"$set": {"sprint_id": None}}
        )

    async def in_sprint(self, sprint_id: PydanticObjectId) -> list[Task]:
        return await Task.find({"sprint_id": sprint_id}).sort([("rank", ASC)]).to_list()

    async def subtask_counts(
        self, parent_ids: list[PydanticObjectId]
    ) -> dict[PydanticObjectId, tuple[int, int]]:
        return await self._group_counts("parent_id", parent_ids)

    async def epic_counts(
        self, epic_ids: list[PydanticObjectId]
    ) -> dict[PydanticObjectId, tuple[int, int]]:
        return await self._group_counts("epic_id", epic_ids)

    async def _group_counts(
        self, field_name: str, ids: list[PydanticObjectId]
    ) -> dict[PydanticObjectId, tuple[int, int]]:
        if not ids:
            return {}
        rows = await Task.aggregate(
            [
                {"$match": {field_name: {"$in": ids}}},
                {
                    "$group": {
                        "_id": f"${field_name}",
                        "total": {"$sum": 1},
                        "done": {"$sum": {"$cond": [{"$ne": ["$completed_at", None]}, 1, 0]}},
                    }
                },
            ]
        ).to_list()
        return {row["_id"]: (row["total"], row["done"]) for row in rows}

    async def project_progress(
        self, project_ids: list[PydanticObjectId]
    ) -> dict[PydanticObjectId, tuple[int, int]]:
        if not project_ids:
            return {}
        rows = await Task.aggregate(
            [
                {"$match": {"project_id": {"$in": project_ids}, "parent_id": None}},
                {
                    "$group": {
                        "_id": "$project_id",
                        "total": {"$sum": 1},
                        "done": {"$sum": {"$cond": [{"$ne": ["$completed_at", None]}, 1, 0]}},
                    }
                },
            ]
        ).to_list()
        return {row["_id"]: (row["total"], row["done"]) for row in rows}

    async def open_assigned(
        self, user_id: PydanticObjectId, project_ids: list[PydanticObjectId]
    ) -> list[Task]:
        if not project_ids:
            return []
        return await Task.find(
            {"assignee_id": user_id, "project_id": {"$in": project_ids}, "completed_at": None}
        ).to_list()

    async def assigned_to(
        self, user_id: PydanticObjectId, project_ids: list[PydanticObjectId]
    ) -> list[Task]:
        if not project_ids:
            return []
        return await Task.find(
            {"assignee_id": user_id, "project_id": {"$in": project_ids}}
        ).to_list()

    async def count_completed_since(
        self, user_id: PydanticObjectId, project_ids: list[PydanticObjectId], since: datetime
    ) -> int:
        if not project_ids:
            return 0
        return await Task.find(
            {
                "assignee_id": user_id,
                "project_id": {"$in": project_ids},
                "completed_at": {"$gte": since},
            }
        ).count()

    async def count_for_projects(
        self, project_ids: list[PydanticObjectId], completed: bool | None = None
    ) -> int:
        if not project_ids:
            return 0
        query: dict[str, Any] = {"project_id": {"$in": project_ids}}
        if completed is True:
            query["completed_at"] = {"$ne": None}
        elif completed is False:
            query["completed_at"] = None
        return await Task.find(query).count()

    async def for_projects(self, project_ids: list[PydanticObjectId]) -> list[Task]:
        if not project_ids:
            return []
        return await Task.find({"project_id": {"$in": project_ids}}).to_list()

    async def overdue_unnotified(self, now: datetime) -> list[Task]:
        return await Task.find(
            {
                "due_date": {"$ne": None, "$lt": now},
                "completed_at": None,
                "overdue_notified": False,
                "assignee_id": {"$ne": None},
            }
        ).to_list()

    @staticmethod
    def _build_query(project_ids: list[PydanticObjectId], filters: TaskFilters) -> dict[str, Any]:
        query: dict[str, Any] = {"project_id": {"$in": project_ids}}
        if filters.parent_id is not None:
            query["parent_id"] = filters.parent_id
        elif not filters.include_subtasks:
            query["parent_id"] = None
        if filters.status_id:
            query["status_id"] = filters.status_id
        if filters.unassigned:
            query["assignee_id"] = None
        elif filters.assignee_id:
            query["assignee_id"] = filters.assignee_id
        if filters.priority:
            query["priority"] = filters.priority.value
        if filters.label_id:
            query["label_ids"] = filters.label_id
        if filters.issue_types:
            query["issue_type"] = {"$in": [item.value for item in filters.issue_types]}
        elif filters.exclude_epics:
            query["issue_type"] = {"$ne": IssueType.EPIC.value}
        if filters.epic_id:
            query["epic_id"] = filters.epic_id
        if filters.sprint_id:
            query["sprint_id"] = filters.sprint_id
        elif filters.backlog:
            query["sprint_id"] = None
        if filters.version_id:
            query["version_id"] = filters.version_id
        if filters.resolved is True:
            query["completed_at"] = {"$ne": None}
        elif filters.resolved is False:
            query["completed_at"] = None
        due: dict[str, datetime] = {}
        if filters.due_after:
            due["$gte"] = filters.due_after
        if filters.due_before:
            due["$lte"] = filters.due_before
        if due:
            query["due_date"] = due
        if filters.q:
            pattern = contains_pattern(filters.q)
            clauses: list[dict[str, Any]] = [{"title": pattern}, {"description": pattern}]
            key_match = ISSUE_KEY_PATTERN.match(filters.q.strip())
            if key_match:
                clauses.append({"issue_number": int(key_match.group(1))})
            query["$or"] = clauses
        return query


task_repository = TaskRepository()
