from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel

from app.core.database import ping_database

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    database: str


@router.get("/health", response_model=HealthResponse)
async def health(request: Request, response: Response) -> HealthResponse:
    database_up = await ping_database(request.app.state.mongo_client)
    if not database_up:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(
        status="ok" if database_up else "degraded",
        database="up" if database_up else "down",
    )
