from app.core.exceptions import ConflictError, NotFoundError
from app.models.label import Label
from app.permissions.context import AuthContext
from app.permissions.matrix import Permission
from app.permissions.policies import require
from app.repositories.label_repository import label_repository
from app.repositories.task_repository import task_repository
from app.schemas.label import LabelCreate, LabelOut, LabelUpdate
from app.services import project_service
from app.utils.object_id import to_object_id


async def list_labels(auth: AuthContext, project_id: str) -> list[LabelOut]:
    context = await project_service.get_context(auth, project_id)
    labels = await label_repository.list_for_project(context.project.pk)
    return [LabelOut.model_validate(label) for label in labels]


async def create_label(auth: AuthContext, project_id: str, data: LabelCreate) -> LabelOut:
    context = await project_service.get_context(auth, project_id)
    require(context.role, Permission.TASK_CREATE, "You cannot create labels")
    if await label_repository.get_by_name(context.project.pk, data.name):
        raise ConflictError("A label with this name already exists", code="label_name_taken")
    label = await label_repository.insert(
        Label(project_id=context.project.pk, name=data.name, color=data.color)
    )
    return LabelOut.model_validate(label)


async def _label_in_managed_project(auth: AuthContext, label_id: str) -> Label:
    label = await label_repository.get(to_object_id(label_id))
    if label is None:
        raise NotFoundError("Label not found", code="label_not_found")
    context = await project_service.get_context(auth, str(label.project_id))
    require(context.role, Permission.TASK_EDIT_ANY, "You cannot manage labels")
    return label


async def update_label(auth: AuthContext, label_id: str, data: LabelUpdate) -> LabelOut:
    label = await _label_in_managed_project(auth, label_id)
    renamed = data.name is not None and data.name.lower() != label.name.lower()
    if renamed and await label_repository.get_by_name(label.project_id, str(data.name)):
        raise ConflictError("A label with this name already exists", code="label_name_taken")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(label, field, value)
    await label_repository.save(label)
    return LabelOut.model_validate(label)


async def delete_label(auth: AuthContext, label_id: str) -> None:
    label = await _label_in_managed_project(auth, label_id)
    await task_repository.remove_label(label.project_id, label.pk)
    await label_repository.delete(label)
