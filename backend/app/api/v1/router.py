from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    agile,
    auth,
    comments,
    dashboard,
    docs,
    health,
    invitations,
    labels,
    notifications,
    project_members,
    projects,
    tasks,
    users,
    work,
    workspaces,
)

api_router = APIRouter()
for module in (
    health,
    auth,
    users,
    workspaces,
    invitations,
    projects,
    project_members,
    labels,
    tasks,
    work,
    agile,
    docs,
    comments,
    notifications,
    dashboard,
    admin,
):
    api_router.include_router(module.router)
