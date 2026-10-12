from app.core.exceptions import NotFoundError
from app.models.saved_filter import SavedFilter
from app.permissions.context import AuthContext
from app.repositories.saved_filter_repository import saved_filter_repository
from app.schemas.saved_filter import SavedFilterCreate, SavedFilterOut
from app.services import project_service
from app.utils.object_id import to_object_id


async def list_filters(auth: AuthContext, project_id: str) -> list[SavedFilterOut]:
    context = await project_service.get_context(auth, project_id)
    items = await saved_filter_repository.list_for_user(auth.user.pk, context.project.pk)
    return [SavedFilterOut.model_validate(item) for item in items]


async def create_filter(
    auth: AuthContext, project_id: str, data: SavedFilterCreate
) -> SavedFilterOut:
    context = await project_service.get_context(auth, project_id)
    saved = await saved_filter_repository.insert(
        SavedFilter(
            user_id=auth.user.pk,
            project_id=context.project.pk,
            name=data.name,
            params=dict(data.params),
        )
    )
    return SavedFilterOut.model_validate(saved)


async def delete_filter(auth: AuthContext, filter_id: str) -> None:
    saved = await saved_filter_repository.get(to_object_id(filter_id))
    if saved is None or saved.user_id != auth.user.pk:
        raise NotFoundError("Saved filter not found", code="filter_not_found")
    await saved_filter_repository.delete(saved)
