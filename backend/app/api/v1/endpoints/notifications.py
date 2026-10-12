from fastapi import APIRouter

from app.api.deps import CurrentAuth
from app.schemas.common import Page
from app.schemas.notification import MarkedReadOut, NotificationOut, UnreadCountOut
from app.services import notification_service
from app.utils.pagination import PageQuery

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=Page[NotificationOut])
async def list_notifications(
    auth: CurrentAuth, params: PageQuery, unread_only: bool = False
) -> Page[NotificationOut]:
    return await notification_service.list_notifications(auth, params, unread_only)


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(auth: CurrentAuth) -> UnreadCountOut:
    return await notification_service.unread_count(auth)


@router.post("/read-all", response_model=MarkedReadOut)
async def read_all(auth: CurrentAuth) -> MarkedReadOut:
    return await notification_service.mark_all_read(auth)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(auth: CurrentAuth, notification_id: str) -> NotificationOut:
    return await notification_service.mark_read(auth, notification_id)
