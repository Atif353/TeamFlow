from datetime import datetime

from beanie import PydanticObjectId
from fastapi import APIRouter, status

from app.api.deps import SuperAdminAuth
from app.permissions.roles import Role
from app.schemas.admin import (
    AdminPasswordReset,
    AdminStats,
    AdminUserCreate,
    AdminUserDetail,
    AdminUserOut,
    AdminUserUpdate,
    ChangeRoleRequest,
    ChangeStatusRequest,
    SetProjectOverrideRequest,
)
from app.schemas.audit import AuditActionsOut, AuditLogOut
from app.schemas.common import Page
from app.schemas.report import WorkspaceAnalytics
from app.services import admin_service, audit_service, report_service
from app.utils.pagination import PageQuery

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
async def stats(auth: SuperAdminAuth) -> AdminStats:
    return await admin_service.get_stats(auth)


@router.get("/users", response_model=Page[AdminUserOut])
async def list_users(
    auth: SuperAdminAuth,
    params: PageQuery,
    q: str | None = None,
    role: Role | None = None,
    is_active: bool | None = None,
) -> Page[AdminUserOut]:
    return await admin_service.list_users(auth, params, q, role, is_active)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user(auth: SuperAdminAuth, user_id: str) -> AdminUserDetail:
    return await admin_service.get_user(auth, user_id)


@router.patch("/users/{user_id}/role", response_model=AdminUserDetail)
async def change_role(
    auth: SuperAdminAuth, user_id: str, data: ChangeRoleRequest
) -> AdminUserDetail:
    return await admin_service.change_role(auth, user_id, data.role)


@router.patch("/users/{user_id}/status", response_model=AdminUserDetail)
async def change_status(
    auth: SuperAdminAuth, user_id: str, data: ChangeStatusRequest
) -> AdminUserDetail:
    return await admin_service.change_status(auth, user_id, data.is_active)


@router.put("/users/{user_id}/projects/{project_id}", response_model=AdminUserDetail)
async def set_project_override(
    auth: SuperAdminAuth, user_id: str, project_id: str, data: SetProjectOverrideRequest
) -> AdminUserDetail:
    return await admin_service.set_project_override(auth, user_id, project_id, data.role_override)


@router.delete("/users/{user_id}/projects/{project_id}", response_model=AdminUserDetail)
async def remove_from_project(
    auth: SuperAdminAuth, user_id: str, project_id: str
) -> AdminUserDetail:
    return await admin_service.remove_from_project(auth, user_id, project_id)


@router.post("/users", response_model=AdminUserDetail, status_code=status.HTTP_201_CREATED)
async def create_user(auth: SuperAdminAuth, data: AdminUserCreate) -> AdminUserDetail:
    return await admin_service.create_user(auth, data)


@router.patch("/users/{user_id}", response_model=AdminUserDetail)
async def update_user(auth: SuperAdminAuth, user_id: str, data: AdminUserUpdate) -> AdminUserDetail:
    return await admin_service.update_user(auth, user_id, data)


@router.post("/users/{user_id}/password", response_model=AdminUserDetail)
async def reset_password(
    auth: SuperAdminAuth, user_id: str, data: AdminPasswordReset
) -> AdminUserDetail:
    return await admin_service.reset_user_password(auth, user_id, data)


@router.get("/analytics", response_model=WorkspaceAnalytics)
async def analytics(auth: SuperAdminAuth) -> WorkspaceAnalytics:
    return await report_service.workspace_analytics(auth)


@router.get("/audit-logs", response_model=Page[AuditLogOut])
async def audit_logs(
    auth: SuperAdminAuth,
    params: PageQuery,
    action: str | None = None,
    actor_id: PydanticObjectId | None = None,
    q: str | None = None,
    since: datetime | None = None,
) -> Page[AuditLogOut]:
    return await audit_service.search(auth, params, action, actor_id, q, since)


@router.get("/audit-logs/actions", response_model=AuditActionsOut)
async def audit_actions(auth: SuperAdminAuth) -> AuditActionsOut:
    return await audit_service.actions(auth)
