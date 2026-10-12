from fastapi import APIRouter

from app.api.deps import CurrentAuth
from app.schemas.dashboard import DashboardOut
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/me", response_model=DashboardOut)
async def my_dashboard(auth: CurrentAuth) -> DashboardOut:
    return await dashboard_service.get_dashboard(auth)
