from app.core.exceptions import ConflictError, NotFoundError
from app.models.version import Version
from app.permissions.context import AuthContext
from app.permissions.matrix import Permission
from app.permissions.policies import require
from app.repositories.task_repository import task_repository
from app.repositories.version_repository import version_repository
from app.schemas.sprint import VersionCreate, VersionOut, VersionUpdate
from app.services import project_service
from app.utils.object_id import to_object_id
from app.utils.time import utcnow


async def _to_outputs(versions: list[Version]) -> list[VersionOut]:
    tasks = await task_repository.all_in_project(versions[0].project_id) if versions else []
    outputs: list[VersionOut] = []
    for version in versions:
        members = [task for task in tasks if task.version_id == version.pk]
        outputs.append(
            VersionOut(
                id=version.pk,
                project_id=version.project_id,
                name=version.name,
                description=version.description,
                start_date=version.start_date,
                release_date=version.release_date,
                released=version.released,
                released_at=version.released_at,
                issue_count=len(members),
                done_count=sum(1 for task in members if task.completed_at is not None),
            )
        )
    return outputs


async def list_versions(auth: AuthContext, project_id: str) -> list[VersionOut]:
    context = await project_service.get_context(auth, project_id)
    versions = await version_repository.list_for_project(context.project.pk)
    return await _to_outputs(versions)


async def create_version(auth: AuthContext, project_id: str, data: VersionCreate) -> VersionOut:
    context = await project_service.get_context(auth, project_id)
    require(context.role, Permission.SPRINT_MANAGE, "You cannot manage releases")
    if await version_repository.get_by_name(context.project.pk, data.name):
        raise ConflictError("A release with this name already exists", code="version_name_taken")
    version = await version_repository.insert(
        Version(project_id=context.project.pk, **data.model_dump())
    )
    [output] = await _to_outputs([version])
    return output


async def _load_version(auth: AuthContext, version_id: str) -> Version:
    version = await version_repository.get(to_object_id(version_id))
    if version is None:
        raise NotFoundError("Release not found", code="version_not_found")
    context = await project_service.get_context(auth, str(version.project_id))
    require(context.role, Permission.SPRINT_MANAGE, "You cannot manage releases")
    return version


async def update_version(auth: AuthContext, version_id: str, data: VersionUpdate) -> VersionOut:
    version = await _load_version(auth, version_id)
    changes = data.model_dump(exclude_unset=True)
    new_name = changes.get("name")
    renamed = bool(new_name) and new_name != version.name
    if renamed and await version_repository.get_by_name(version.project_id, str(new_name)):
        raise ConflictError("A release with this name already exists", code="version_name_taken")
    for field, value in changes.items():
        if field == "name" and value is None:
            continue
        setattr(version, field, value)
    if "released" in changes:
        version.released_at = utcnow() if version.released else None
    await version_repository.save(version)
    [output] = await _to_outputs([version])
    return output


async def delete_version(auth: AuthContext, version_id: str) -> None:
    version = await _load_version(auth, version_id)
    await task_repository.clear_version(version.pk)
    await version_repository.delete(version)
