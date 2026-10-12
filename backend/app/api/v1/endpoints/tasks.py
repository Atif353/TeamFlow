from datetime import date
from typing import Annotated

from beanie import PydanticObjectId
from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentAuth
from app.models.task import IssueType, Priority
from app.repositories.task_repository import TaskFilters
from app.schemas.activity import ActivityOut
from app.schemas.common import Page
from app.schemas.task import (
    BulkResult,
    ChecklistCreate,
    ChecklistUpdate,
    SortOrder,
    TaskBulkRequest,
    TaskCreate,
    TaskMove,
    TaskOut,
    TaskRankMove,
    TaskSortField,
    TaskUpdate,
)
from app.services import bulk_service, task_service
from app.utils.pagination import PageQuery
from app.utils.time import date_to_datetime

router = APIRouter(tags=["tasks"])


@router.get("/projects/{project_id}/tasks", response_model=Page[TaskOut])
async def list_tasks(
    auth: CurrentAuth,
    project_id: str,
    params: PageQuery,
    status_id: str | None = None,
    assignee_id: PydanticObjectId | None = None,
    unassigned: bool = False,
    priority: Priority | None = None,
    label_id: PydanticObjectId | None = None,
    issue_type: Annotated[list[IssueType] | None, Query()] = None,
    exclude_epics: bool = False,
    epic_id: PydanticObjectId | None = None,
    sprint_id: PydanticObjectId | None = None,
    backlog: bool = False,
    version_id: PydanticObjectId | None = None,
    resolved: bool | None = None,
    due_before: date | None = None,
    due_after: date | None = None,
    q: str | None = None,
    parent_id: PydanticObjectId | None = None,
    include_subtasks: bool = False,
    sort: TaskSortField = TaskSortField.POSITION,
    order: SortOrder = SortOrder.ASC,
) -> Page[TaskOut]:
    filters = TaskFilters(
        parent_id=parent_id,
        include_subtasks=include_subtasks,
        status_id=status_id,
        assignee_id=assignee_id,
        unassigned=unassigned,
        priority=priority,
        label_id=label_id,
        issue_types=issue_type or [],
        exclude_epics=exclude_epics,
        epic_id=epic_id,
        sprint_id=sprint_id,
        backlog=backlog,
        version_id=version_id,
        resolved=resolved,
        due_before=date_to_datetime(due_before) if due_before else None,
        due_after=date_to_datetime(due_after) if due_after else None,
        q=q,
    )
    return await task_service.list_tasks(auth, project_id, filters, sort, order, params)


@router.post(
    "/projects/{project_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED
)
async def create_task(auth: CurrentAuth, project_id: str, data: TaskCreate) -> TaskOut:
    return await task_service.create_task(auth, project_id, data)


@router.post("/projects/{project_id}/tasks/bulk", response_model=BulkResult)
async def bulk_tasks(auth: CurrentAuth, project_id: str, data: TaskBulkRequest) -> BulkResult:
    return await bulk_service.apply_bulk(auth, project_id, data)


@router.post("/tasks/{task_ref}/clone", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def clone_task(auth: CurrentAuth, task_ref: str) -> TaskOut:
    return await bulk_service.clone_task(auth, task_ref)


@router.get("/tasks/{task_ref}", response_model=TaskOut)
async def get_task(auth: CurrentAuth, task_ref: str) -> TaskOut:
    return await task_service.get_task(auth, task_ref)


@router.patch("/tasks/{task_ref}", response_model=TaskOut)
async def update_task(auth: CurrentAuth, task_ref: str, data: TaskUpdate) -> TaskOut:
    return await task_service.update_task(auth, task_ref, data)


@router.patch("/tasks/{task_ref}/move", response_model=TaskOut)
async def move_task(auth: CurrentAuth, task_ref: str, data: TaskMove) -> TaskOut:
    return await task_service.move_task(auth, task_ref, data)


@router.patch("/tasks/{task_ref}/rank", response_model=TaskOut)
async def rank_task(auth: CurrentAuth, task_ref: str, data: TaskRankMove) -> TaskOut:
    return await task_service.rank_task(auth, task_ref, data)


@router.delete("/tasks/{task_ref}", status_code=204)
async def delete_task(auth: CurrentAuth, task_ref: str) -> Response:
    await task_service.delete_task(auth, task_ref)
    return Response(status_code=204)


@router.put("/tasks/{task_ref}/watch", response_model=TaskOut)
async def watch_task(auth: CurrentAuth, task_ref: str) -> TaskOut:
    return await task_service.set_watching(auth, task_ref, True)


@router.delete("/tasks/{task_ref}/watch", response_model=TaskOut)
async def unwatch_task(auth: CurrentAuth, task_ref: str) -> TaskOut:
    return await task_service.set_watching(auth, task_ref, False)


@router.get("/tasks/{task_ref}/activity", response_model=list[ActivityOut])
async def task_activity(auth: CurrentAuth, task_ref: str) -> list[ActivityOut]:
    return await task_service.get_activity(auth, task_ref)


@router.post(
    "/tasks/{task_ref}/checklist", response_model=TaskOut, status_code=status.HTTP_201_CREATED
)
async def add_checklist_item(auth: CurrentAuth, task_ref: str, data: ChecklistCreate) -> TaskOut:
    return await task_service.add_checklist_item(auth, task_ref, data)


@router.patch("/tasks/{task_ref}/checklist/{item_id}", response_model=TaskOut)
async def update_checklist_item(
    auth: CurrentAuth, task_ref: str, item_id: str, data: ChecklistUpdate
) -> TaskOut:
    return await task_service.update_checklist_item(auth, task_ref, item_id, data)


@router.delete("/tasks/{task_ref}/checklist/{item_id}", response_model=TaskOut)
async def delete_checklist_item(auth: CurrentAuth, task_ref: str, item_id: str) -> TaskOut:
    return await task_service.delete_checklist_item(auth, task_ref, item_id)
