from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentAuth
from app.models.sprint import SprintState
from app.schemas.automation import AutomationRuleCreate, AutomationRuleOut, AutomationRuleUpdate
from app.schemas.project import ProjectOut, UpdateComponentsRequest
from app.schemas.report import (
    BurndownReport,
    CumulativeFlowReport,
    ProjectSummary,
    TimeTrackingReport,
    VelocityReport,
    WorkloadReport,
)
from app.schemas.saved_filter import SavedFilterCreate, SavedFilterOut
from app.schemas.sprint import (
    BacklogOut,
    SprintComplete,
    SprintCreate,
    SprintOut,
    SprintStart,
    SprintUpdate,
    VersionCreate,
    VersionOut,
    VersionUpdate,
)
from app.services import (
    automation_service,
    filter_service,
    project_service,
    report_service,
    sprint_service,
    version_service,
)

router = APIRouter(tags=["agile"])


@router.get("/projects/{project_id}/sprints", response_model=list[SprintOut])
async def list_sprints(
    auth: CurrentAuth, project_id: str, state: Annotated[list[SprintState] | None, Query()] = None
) -> list[SprintOut]:
    return await sprint_service.list_sprints(auth, project_id, state)


@router.post(
    "/projects/{project_id}/sprints", response_model=SprintOut, status_code=status.HTTP_201_CREATED
)
async def create_sprint(auth: CurrentAuth, project_id: str, data: SprintCreate) -> SprintOut:
    return await sprint_service.create_sprint(auth, project_id, data)


@router.get("/projects/{project_id}/backlog", response_model=BacklogOut)
async def backlog(auth: CurrentAuth, project_id: str) -> BacklogOut:
    return await sprint_service.get_backlog(auth, project_id)


@router.patch("/sprints/{sprint_id}", response_model=SprintOut)
async def update_sprint(auth: CurrentAuth, sprint_id: str, data: SprintUpdate) -> SprintOut:
    return await sprint_service.update_sprint(auth, sprint_id, data)


@router.post("/sprints/{sprint_id}/start", response_model=SprintOut)
async def start_sprint(auth: CurrentAuth, sprint_id: str, data: SprintStart) -> SprintOut:
    return await sprint_service.start_sprint(auth, sprint_id, data)


@router.post("/sprints/{sprint_id}/complete", response_model=SprintOut)
async def complete_sprint(auth: CurrentAuth, sprint_id: str, data: SprintComplete) -> SprintOut:
    return await sprint_service.complete_sprint(auth, sprint_id, data)


@router.delete("/sprints/{sprint_id}", status_code=204)
async def delete_sprint(auth: CurrentAuth, sprint_id: str) -> Response:
    await sprint_service.delete_sprint(auth, sprint_id)
    return Response(status_code=204)


@router.get("/sprints/{sprint_id}/burndown", response_model=BurndownReport)
async def burndown(auth: CurrentAuth, sprint_id: str) -> BurndownReport:
    return await report_service.burndown(auth, sprint_id)


@router.get("/projects/{project_id}/versions", response_model=list[VersionOut])
async def list_versions(auth: CurrentAuth, project_id: str) -> list[VersionOut]:
    return await version_service.list_versions(auth, project_id)


@router.post(
    "/projects/{project_id}/versions",
    response_model=VersionOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_version(auth: CurrentAuth, project_id: str, data: VersionCreate) -> VersionOut:
    return await version_service.create_version(auth, project_id, data)


@router.patch("/versions/{version_id}", response_model=VersionOut)
async def update_version(auth: CurrentAuth, version_id: str, data: VersionUpdate) -> VersionOut:
    return await version_service.update_version(auth, version_id, data)


@router.delete("/versions/{version_id}", status_code=204)
async def delete_version(auth: CurrentAuth, version_id: str) -> Response:
    await version_service.delete_version(auth, version_id)
    return Response(status_code=204)


@router.put("/projects/{project_id}/components", response_model=ProjectOut)
async def update_components(
    auth: CurrentAuth, project_id: str, data: UpdateComponentsRequest
) -> ProjectOut:
    return await project_service.update_components(auth, project_id, data)


@router.get("/projects/{project_id}/summary", response_model=ProjectSummary)
async def summary(auth: CurrentAuth, project_id: str) -> ProjectSummary:
    return await report_service.project_summary(auth, project_id)


@router.get("/projects/{project_id}/reports/velocity", response_model=VelocityReport)
async def velocity(auth: CurrentAuth, project_id: str) -> VelocityReport:
    return await report_service.velocity(auth, project_id)


@router.get("/projects/{project_id}/reports/cumulative-flow", response_model=CumulativeFlowReport)
async def cumulative_flow(auth: CurrentAuth, project_id: str) -> CumulativeFlowReport:
    return await report_service.cumulative_flow(auth, project_id)


@router.get("/projects/{project_id}/reports/time-tracking", response_model=TimeTrackingReport)
async def time_tracking(
    auth: CurrentAuth, project_id: str, days: Annotated[int, Query(ge=1, le=90)] = 30
) -> TimeTrackingReport:
    return await report_service.time_tracking(auth, project_id, days)


@router.get("/projects/{project_id}/reports/workload", response_model=WorkloadReport)
async def workload(auth: CurrentAuth, project_id: str) -> WorkloadReport:
    return await report_service.workload(auth, project_id)


@router.get("/projects/{project_id}/filters", response_model=list[SavedFilterOut])
async def list_filters(auth: CurrentAuth, project_id: str) -> list[SavedFilterOut]:
    return await filter_service.list_filters(auth, project_id)


@router.post(
    "/projects/{project_id}/filters",
    response_model=SavedFilterOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_filter(
    auth: CurrentAuth, project_id: str, data: SavedFilterCreate
) -> SavedFilterOut:
    return await filter_service.create_filter(auth, project_id, data)


@router.delete("/filters/{filter_id}", status_code=204)
async def delete_filter(auth: CurrentAuth, filter_id: str) -> Response:
    await filter_service.delete_filter(auth, filter_id)
    return Response(status_code=204)


@router.get("/projects/{project_id}/automation", response_model=list[AutomationRuleOut])
async def list_rules(auth: CurrentAuth, project_id: str) -> list[AutomationRuleOut]:
    return await automation_service.list_rules(auth, project_id)


@router.post(
    "/projects/{project_id}/automation",
    response_model=AutomationRuleOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    auth: CurrentAuth, project_id: str, data: AutomationRuleCreate
) -> AutomationRuleOut:
    return await automation_service.create_rule(auth, project_id, data)


@router.patch("/automation/{rule_id}", response_model=AutomationRuleOut)
async def update_rule(
    auth: CurrentAuth, rule_id: str, data: AutomationRuleUpdate
) -> AutomationRuleOut:
    return await automation_service.update_rule(auth, rule_id, data)


@router.delete("/automation/{rule_id}", status_code=204)
async def delete_rule(auth: CurrentAuth, rule_id: str) -> Response:
    await automation_service.delete_rule(auth, rule_id)
    return Response(status_code=204)
