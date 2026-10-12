from beanie import PydanticObjectId

from app.core.exceptions import (
    BusinessRuleError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.core.storage import get_storage
from app.models.project import Project, ProjectStatus
from app.models.project_member import ProjectMember
from app.models.user import User
from app.models.workspace_member import WorkspaceMember
from app.permissions.context import AuthContext, ProjectContext
from app.permissions.matrix import Permission
from app.permissions.policies import effective_role, require
from app.permissions.roles import Role
from app.repositories.activity_repository import activity_repository
from app.repositories.attachment_repository import attachment_repository
from app.repositories.automation_repository import automation_repository
from app.repositories.comment_repository import comment_repository
from app.repositories.doc_repository import doc_repository
from app.repositories.issue_link_repository import issue_link_repository
from app.repositories.label_repository import label_repository
from app.repositories.notification_repository import notification_repository
from app.repositories.project_repository import project_repository
from app.repositories.saved_filter_repository import saved_filter_repository
from app.repositories.sprint_repository import sprint_repository
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.repositories.version_repository import version_repository
from app.repositories.worklog_repository import worklog_repository
from app.repositories.workspace_repository import workspace_repository
from app.schemas.common import Page, UserBrief
from app.schemas.project import (
    AddProjectMemberRequest,
    ProjectCreate,
    ProjectMemberOut,
    ProjectOut,
    ProjectUpdate,
    StatusOut,
    UpdateComponentsRequest,
    UpdateStatusesRequest,
    UpdateWorkflowRequest,
)
from app.services import audit_service
from app.utils.object_id import to_object_id
from app.utils.pagination import PageParams
from app.utils.time import utcnow

MEMBER_PREVIEW_LIMIT = 5


async def get_context(auth: AuthContext, project_id: str) -> ProjectContext:
    project = await project_repository.get(to_object_id(project_id))
    if project is None or project.workspace_id != auth.workspace_id:
        raise NotFoundError("Project not found", code="project_not_found")
    if auth.role == Role.SUPER_ADMIN:
        return ProjectContext(auth=auth, project=project, role=Role.SUPER_ADMIN)
    membership = await project_repository.get_member(project.pk, auth.user.pk)
    if membership is None:
        raise NotFoundError("Project not found", code="project_not_found")
    return ProjectContext(
        auth=auth, project=project, role=effective_role(auth.role, membership.role_override)
    )


async def visible_project_ids(auth: AuthContext) -> list[PydanticObjectId]:
    if auth.role == Role.SUPER_ADMIN:
        return await project_repository.ids_in_workspace(auth.workspace_id)
    visible = await project_repository.project_ids_for_user(auth.user.pk)
    workspace_ids = set(await project_repository.ids_in_workspace(auth.workspace_id))
    return [project_id for project_id in visible if project_id in workspace_ids]


async def _build_outputs(auth: AuthContext, projects: list[Project]) -> list[ProjectOut]:
    ids = [project.pk for project in projects]
    my_memberships = {
        member.project_id: member
        for member in await project_repository.memberships_for_user(auth.user.pk)
    }
    progress = await task_repository.project_progress(ids)
    members_by_project: dict[PydanticObjectId, list[ProjectMember]] = {pid: [] for pid in ids}
    for member in await project_repository.members_of_projects(ids):
        members_by_project[member.project_id].append(member)
    preview_ids = [
        member.user_id
        for members in members_by_project.values()
        for member in members[:MEMBER_PREVIEW_LIMIT]
    ]
    users = {user.pk: user for user in await user_repository.find_by_ids(preview_ids)}
    outputs: list[ProjectOut] = []
    for project in projects:
        membership = my_memberships.get(project.pk)
        role = (
            Role.SUPER_ADMIN
            if auth.role == Role.SUPER_ADMIN
            else effective_role(auth.role, membership.role_override if membership else None)
        )
        members = members_by_project[project.pk]
        total, done = progress.get(project.pk, (0, 0))
        outputs.append(
            ProjectOut(
                id=project.pk,
                workspace_id=project.workspace_id,
                name=project.name,
                key=project.key,
                description=project.description,
                color=project.color,
                statuses=[StatusOut.model_validate(item) for item in project.statuses],
                components=list(project.components),
                transitions=dict(project.transitions),
                created_by=project.created_by,
                created_at=project.created_at,
                updated_at=project.updated_at,
                my_role=role,
                member_count=len(members),
                task_count=total,
                done_task_count=done,
                members=[
                    UserBrief.from_user(users[member.user_id])
                    for member in members[:MEMBER_PREVIEW_LIMIT]
                    if member.user_id in users
                ],
            )
        )
    return outputs


async def build_output(auth: AuthContext, project: Project) -> ProjectOut:
    [output] = await _build_outputs(auth, [project])
    return output


async def create_project(auth: AuthContext, data: ProjectCreate) -> ProjectOut:
    require(auth.role, Permission.PROJECT_CREATE, "You cannot create projects")
    if await project_repository.get_by_key(auth.workspace_id, data.key):
        raise ConflictError("Project key is already in use", code="project_key_taken")
    project = await project_repository.insert(
        Project(
            workspace_id=auth.workspace_id,
            name=data.name,
            key=data.key,
            description=data.description,
            color=data.color,
            created_by=auth.user.pk,
        )
    )
    await project_repository.add_member(ProjectMember(project_id=project.pk, user_id=auth.user.pk))
    await audit_service.record(
        auth,
        "project_created",
        "project",
        f"Created project {project.name} ({project.key})",
        entity_id=str(project.pk),
    )
    return await build_output(auth, project)


async def list_projects(auth: AuthContext, params: PageParams, q: str | None) -> Page[ProjectOut]:
    visible = None if auth.role == Role.SUPER_ADMIN else await visible_project_ids(auth)
    projects, total = await project_repository.list_in_workspace(
        auth.workspace_id, visible, q, params.skip, params.limit
    )
    return Page(
        items=await _build_outputs(auth, projects),
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get_project(auth: AuthContext, project_id: str) -> ProjectOut:
    context = await get_context(auth, project_id)
    return await build_output(auth, context.project)


async def update_project(auth: AuthContext, project_id: str, data: ProjectUpdate) -> ProjectOut:
    context = await get_context(auth, project_id)
    require(context.role, Permission.PROJECT_MEMBERS, "You cannot manage this project")
    project = context.project
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(project, field, value)
    project.updated_at = utcnow()
    await project_repository.save(project)
    return await build_output(auth, project)


async def delete_project(auth: AuthContext, project_id: str) -> None:
    context = await get_context(auth, project_id)
    require(context.role, Permission.PROJECT_DELETE, "You cannot delete this project")
    project = context.project
    storage = get_storage()
    for attachment in await attachment_repository.list_for_project(project.pk):
        storage.delete(attachment.storage_key)
    await attachment_repository.delete_by_project(project.pk)
    await comment_repository.delete_by_project(project.pk)
    await notification_repository.delete_by_project(project.pk)
    await worklog_repository.delete_by_project(project.pk)
    await issue_link_repository.delete_by_project(project.pk)
    await activity_repository.delete_by_project(project.pk)
    await sprint_repository.delete_by_project(project.pk)
    await version_repository.delete_by_project(project.pk)
    await saved_filter_repository.delete_by_project(project.pk)
    await doc_repository.delete_by_project(project.pk)
    await automation_repository.delete_by_project(project.pk)
    await task_repository.delete_by_project(project.pk)
    await label_repository.delete_by_project(project.pk)
    await project_repository.delete_members_of_project(project.pk)
    await project_repository.delete(project)
    await audit_service.record(
        auth,
        "project_deleted",
        "project",
        f"Deleted project {project.name} ({project.key})",
        entity_id=str(project.pk),
    )


def _build_statuses(project: Project, data: UpdateStatusesRequest) -> list[ProjectStatus]:
    known_ids = {item.id for item in project.statuses}
    statuses: list[ProjectStatus] = []
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    for index, item in enumerate(data.statuses):
        if item.id is not None and (item.id not in known_ids or item.id in seen_ids):
            raise BusinessRuleError("Unknown or duplicate status id", code="invalid_status_id")
        if item.name.lower() in seen_names:
            raise BusinessRuleError("Status names must be unique", code="duplicate_status_name")
        seen_names.add(item.name.lower())
        status = ProjectStatus(
            name=item.name,
            color=item.color,
            order=index,
            is_done=item.is_done,
            wip_limit=item.wip_limit,
        )
        if item.id is not None:
            status.id = item.id
            seen_ids.add(item.id)
        statuses.append(status)
    return statuses


async def update_statuses(
    auth: AuthContext, project_id: str, data: UpdateStatusesRequest
) -> ProjectOut:
    context = await get_context(auth, project_id)
    require(context.role, Permission.PROJECT_MEMBERS, "You cannot manage this project")
    project = context.project
    statuses = _build_statuses(project, data)
    previous = {item.id: item for item in project.statuses}
    for removed_id in set(previous) - {item.id for item in statuses}:
        if await task_repository.count_in_status(project.pk, removed_id) > 0:
            raise ConflictError(
                "Reassign the tasks in this status before deleting it",
                code="status_has_tasks",
                details={"status_id": removed_id},
            )
    newly_done = [
        s.id for s in statuses if s.is_done and s.id in previous and not previous[s.id].is_done
    ]
    newly_open = [
        s.id for s in statuses if not s.is_done and s.id in previous and previous[s.id].is_done
    ]
    project.statuses = statuses
    remaining = {item.id for item in statuses}
    project.transitions = {
        source: [target for target in targets if target in remaining]
        for source, targets in project.transitions.items()
        if source in remaining
    }
    project.updated_at = utcnow()
    await project_repository.save(project)
    await task_repository.set_completion_for_statuses(project.pk, newly_done, utcnow())
    await task_repository.set_completion_for_statuses(project.pk, newly_open, None)
    return await build_output(auth, project)


async def update_workflow(
    auth: AuthContext, project_id: str, data: UpdateWorkflowRequest
) -> ProjectOut:
    context = await get_context(auth, project_id)
    require(context.role, Permission.PROJECT_MEMBERS, "You cannot manage this project")
    project = context.project
    known = {item.id for item in project.statuses}
    for source, targets in data.transitions.items():
        if source not in known or not set(targets) <= known:
            raise BusinessRuleError("Unknown status in workflow", code="invalid_status_id")
    project.transitions = {
        source: list(dict.fromkeys(target for target in targets if target != source))
        for source, targets in data.transitions.items()
    }
    project.updated_at = utcnow()
    await project_repository.save(project)
    return await build_output(auth, project)


async def update_components(
    auth: AuthContext, project_id: str, data: UpdateComponentsRequest
) -> ProjectOut:
    context = await get_context(auth, project_id)
    require(context.role, Permission.PROJECT_MEMBERS, "You cannot manage this project")
    project = context.project
    for removed in set(project.components) - set(data.components):
        await task_repository.remove_component(project.pk, removed)
    project.components = list(data.components)
    project.updated_at = utcnow()
    await project_repository.save(project)
    return await build_output(auth, project)


async def list_members(
    auth: AuthContext, project_id: str, params: PageParams
) -> Page[ProjectMemberOut]:
    context = await get_context(auth, project_id)
    members, total = await project_repository.list_members(
        context.project.pk, params.skip, params.limit
    )
    users = {
        user.pk: user for user in await user_repository.find_by_ids(m.user_id for m in members)
    }
    workspace_roles = {
        item.user_id: item.role
        for item in await workspace_repository.get_members_for_users([m.user_id for m in members])
    }
    items = [
        ProjectMemberOut(
            user_id=member.user_id,
            name=users[member.user_id].name,
            email=users[member.user_id].email,
            avatar_color=users[member.user_id].avatar_color,
            is_active=users[member.user_id].is_active,
            workspace_role=workspace_roles[member.user_id],
            role_override=member.role_override,
            effective_role=effective_role(workspace_roles[member.user_id], member.role_override),
        )
        for member in members
        if member.user_id in users and member.user_id in workspace_roles
    ]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


async def _workspace_member_or_404(auth: AuthContext, user_id: PydanticObjectId) -> WorkspaceMember:
    membership = await workspace_repository.get_member(user_id)
    if membership is None or membership.workspace_id != auth.workspace_id:
        raise NotFoundError("User not found", code="user_not_found")
    return membership


async def add_member(
    auth: AuthContext, project_id: str, data: AddProjectMemberRequest
) -> ProjectMemberOut:
    context = await get_context(auth, project_id)
    require(context.role, Permission.PROJECT_MEMBERS, "You cannot manage project members")
    if data.role_override is not None and auth.role != Role.SUPER_ADMIN:
        raise ForbiddenError("Only a Super Admin can set role overrides", code="permission_denied")
    workspace_member = await _workspace_member_or_404(auth, data.user_id)
    user = await user_repository.get(data.user_id)
    if user is None or not user.is_active:
        raise NotFoundError("User not found", code="user_not_found")
    if await project_repository.get_member(context.project.pk, data.user_id):
        raise ConflictError("User is already a project member", code="already_member")
    member = await upsert_member(
        context.project, workspace_member.user_id, workspace_member.role, data.role_override
    )
    return _member_output(user, workspace_member.role, member)


def _member_output(user: User, workspace_role: Role, member: ProjectMember) -> ProjectMemberOut:
    return ProjectMemberOut(
        user_id=user.pk,
        name=user.name,
        email=user.email,
        avatar_color=user.avatar_color,
        is_active=user.is_active,
        workspace_role=workspace_role,
        role_override=member.role_override,
        effective_role=effective_role(workspace_role, member.role_override),
    )


async def upsert_member(
    project: Project, user_id: PydanticObjectId, workspace_role: Role, role_override: Role | None
) -> ProjectMember:
    if role_override is not None and workspace_role == Role.SUPER_ADMIN:
        raise BusinessRuleError(
            "A Super Admin's role cannot be overridden", code="super_admin_override"
        )
    member = await project_repository.get_member(project.pk, user_id)
    if member is None:
        return await project_repository.add_member(
            ProjectMember(project_id=project.pk, user_id=user_id, role_override=role_override)
        )
    member.role_override = role_override
    return await project_repository.save_member(member)


async def remove_member_from_project(project: Project, user_id: PydanticObjectId) -> None:
    member = await project_repository.get_member(project.pk, user_id)
    if member is None:
        raise NotFoundError("Project member not found", code="member_not_found")
    await project_repository.remove_member(member)
    await task_repository.unassign_in_project(project.pk, user_id)


async def remove_member(auth: AuthContext, project_id: str, user_id: str) -> None:
    context = await get_context(auth, project_id)
    require(context.role, Permission.PROJECT_MEMBERS, "You cannot manage project members")
    await remove_member_from_project(context.project, to_object_id(user_id))
