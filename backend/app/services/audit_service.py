from datetime import datetime
from typing import Any

from beanie import PydanticObjectId

from app.models.audit_log import AuditLog
from app.permissions.context import AuthContext
from app.repositories.audit_repository import audit_repository
from app.repositories.user_repository import user_repository
from app.schemas.audit import AuditActionsOut, AuditLogOut
from app.schemas.common import Page, UserBrief
from app.utils.pagination import PageParams


async def record(
    auth: AuthContext,
    action: str,
    entity_type: str,
    summary: str,
    entity_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    await audit_repository.insert(
        AuditLog(
            workspace_id=auth.workspace_id,
            actor_id=auth.user.pk,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
            metadata=metadata or {},
        )
    )


async def search(
    auth: AuthContext,
    params: PageParams,
    action: str | None,
    actor_id: PydanticObjectId | None,
    q: str | None,
    since: datetime | None,
) -> Page[AuditLogOut]:
    items, total = await audit_repository.search(
        auth.workspace_id, action, actor_id, q, since, params.skip, params.limit
    )
    actors = {
        user.pk: user for user in await user_repository.find_by_ids(i.actor_id for i in items)
    }
    outputs = [
        AuditLogOut(
            id=item.pk,
            action=item.action,
            entity_type=item.entity_type,
            entity_id=item.entity_id,
            summary=item.summary,
            metadata=item.metadata,
            actor=UserBrief.from_user(actors[item.actor_id]) if item.actor_id in actors else None,
            created_at=item.created_at,
        )
        for item in items
    ]
    return Page(items=outputs, total=total, page=params.page, page_size=params.page_size)


async def actions(auth: AuthContext) -> AuditActionsOut:
    return AuditActionsOut(actions=await audit_repository.distinct_actions(auth.workspace_id))
