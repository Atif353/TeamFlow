from beanie import PydanticObjectId

from app.models.activity_log import ActivityLog
from app.models.task import Task
from app.permissions.context import AuthContext
from app.repositories.activity_repository import activity_repository
from app.repositories.user_repository import user_repository
from app.schemas.activity import ActivityOut
from app.schemas.common import UserBrief


async def record(
    task: Task,
    actor_id: PydanticObjectId,
    action: str,
    field: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    old_id: str | None = None,
    new_id: str | None = None,
) -> None:
    await activity_repository.insert(
        ActivityLog(
            task_id=task.pk,
            project_id=task.project_id,
            actor_id=actor_id,
            action=action,
            field=field,
            old_value=old_value,
            new_value=new_value,
            old_id=old_id,
            new_id=new_id,
        )
    )


async def to_outputs(entries: list[ActivityLog]) -> list[ActivityOut]:
    actors = {
        user.pk: user
        for user in await user_repository.find_by_ids(entry.actor_id for entry in entries)
    }
    return [
        ActivityOut(
            id=entry.pk,
            task_id=entry.task_id,
            action=entry.action,
            field=entry.field,
            old_value=entry.old_value,
            new_value=entry.new_value,
            actor=UserBrief.from_user(actors[entry.actor_id]) if entry.actor_id in actors else None,
            created_at=entry.created_at,
        )
        for entry in entries
    ]


async def list_for_task(auth: AuthContext, task: Task) -> list[ActivityOut]:
    return await to_outputs(await activity_repository.list_for_task(task.pk))
