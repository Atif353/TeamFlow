from beanie import PydanticObjectId

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.user import User
from app.models.workspace_member import WorkspaceMember
from app.permissions.context import AuthContext
from app.permissions.policies import effective_role
from app.permissions.roles import Role
from app.repositories.invitation_repository import invitation_repository
from app.repositories.project_repository import project_repository
from app.repositories.task_repository import task_repository
from app.repositories.user_repository import user_repository
from app.repositories.workspace_repository import workspace_repository
from app.schemas.admin import (
    AdminPasswordReset,
    AdminStats,
    AdminUserCreate,
    AdminUserDetail,
    AdminUserOut,
    AdminUserProject,
    AdminUserUpdate,
)
from app.schemas.common import Page
from app.services import audit_service, auth_service, email_service, project_service
from app.utils.object_id import to_object_id
from app.utils.pagination import PageParams
from app.utils.time import utcnow


async def get_stats(auth: AuthContext) -> AdminStats:
    workspace_id = auth.workspace_id
    user_ids = await workspace_repository.member_user_ids(workspace_id)
    active = await user_repository.count_in(user_ids, True)
    project_ids = await project_repository.ids_in_workspace(workspace_id)
    return AdminStats(
        total_users=len(user_ids),
        active_users=active,
        inactive_users=len(user_ids) - active,
        users_by_role=await workspace_repository.count_by_role(workspace_id),
        pending_invitations=await invitation_repository.count_pending(workspace_id, utcnow()),
        total_projects=len(project_ids),
        total_tasks=await task_repository.count_for_projects(project_ids),
        completed_tasks=await task_repository.count_for_projects(project_ids, completed=True),
    )


def _user_output(user: User, role: Role, project_count: int) -> AdminUserOut:
    return AdminUserOut(
        id=user.pk,
        name=user.name,
        email=user.email,
        avatar_color=user.avatar_color,
        role=role,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        project_count=project_count,
    )


async def list_users(
    auth: AuthContext,
    params: PageParams,
    q: str | None,
    role: Role | None,
    is_active: bool | None,
) -> Page[AdminUserOut]:
    ids = await workspace_repository.member_user_ids(auth.workspace_id, [role] if role else None)
    users, total = await user_repository.search(ids, q, is_active, params.skip, params.limit)
    user_ids = [user.pk for user in users]
    roles = {m.user_id: m.role for m in await workspace_repository.get_members_for_users(user_ids)}
    counts = await project_repository.project_counts_for_users(user_ids)
    items = [
        _user_output(user, roles[user.pk], counts.get(user.pk, 0))
        for user in users
        if user.pk in roles
    ]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


async def _target(auth: AuthContext, user_id: str) -> tuple[User, WorkspaceMember]:
    object_id = to_object_id(user_id)
    membership = await workspace_repository.get_member(object_id)
    user = await user_repository.get(object_id)
    if membership is None or user is None or membership.workspace_id != auth.workspace_id:
        raise NotFoundError("User not found", code="user_not_found")
    return user, membership


async def _detail(user: User, membership: WorkspaceMember) -> AdminUserDetail:
    memberships = await project_repository.memberships_for_user(user.pk)
    projects = {
        project.pk: project
        for project in await project_repository.find_by_ids(m.project_id for m in memberships)
    }
    rows = [
        AdminUserProject(
            project_id=m.project_id,
            name=projects[m.project_id].name,
            key=projects[m.project_id].key,
            color=projects[m.project_id].color,
            role_override=m.role_override,
            effective_role=effective_role(membership.role, m.role_override),
        )
        for m in memberships
        if m.project_id in projects
    ]
    base = _user_output(user, membership.role, len(rows))
    return AdminUserDetail(**base.model_dump(), projects=rows)


async def get_user(auth: AuthContext, user_id: str) -> AdminUserDetail:
    user, membership = await _target(auth, user_id)
    return await _detail(user, membership)


async def _ensure_not_last_super_admin(auth: AuthContext, target: WorkspaceMember) -> None:
    super_admin_ids = await workspace_repository.member_user_ids(
        auth.workspace_id, [Role.SUPER_ADMIN]
    )
    if (
        await user_repository.count_in(super_admin_ids, True) <= 1
        and target.user_id in super_admin_ids
    ):
        raise ConflictError(
            "The workspace must keep at least one active Super Admin", code="last_super_admin"
        )


async def change_role(auth: AuthContext, user_id: str, role: Role) -> AdminUserDetail:
    user, membership = await _target(auth, user_id)
    if membership.role == Role.SUPER_ADMIN and role != Role.SUPER_ADMIN and user.is_active:
        await _ensure_not_last_super_admin(auth, membership)
    previous_role = membership.role
    membership.role = role
    await workspace_repository.save_member(membership)
    if role == Role.SUPER_ADMIN:
        await _clear_overrides(user.pk)
    if previous_role != role:
        await audit_service.record(
            auth,
            "role_changed",
            "user",
            f"Changed role of {user.name} from {previous_role.value} to {role.value}",
            entity_id=str(user.pk),
            metadata={"from": previous_role.value, "to": role.value},
        )
    return await _detail(user, membership)


async def _clear_overrides(user_id: PydanticObjectId) -> None:
    for member in await project_repository.memberships_for_user(user_id):
        if member.role_override is not None:
            member.role_override = None
            await project_repository.save_member(member)


async def change_status(auth: AuthContext, user_id: str, is_active: bool) -> AdminUserDetail:
    user, membership = await _target(auth, user_id)
    if not is_active:
        if user.pk == auth.user.pk:
            raise ConflictError("You cannot deactivate yourself", code="cannot_deactivate_self")
        if membership.role == Role.SUPER_ADMIN and user.is_active:
            await _ensure_not_last_super_admin(auth, membership)
    if user.is_active == is_active:
        return await _detail(user, membership)
    user.is_active = is_active
    if not is_active:
        await auth_service.revoke_all_sessions(user)
    else:
        user.updated_at = utcnow()
        await user_repository.save(user)
    verb = "Deactivated" if not is_active else "Reactivated"
    await audit_service.record(
        auth,
        "user_deactivated" if not is_active else "user_reactivated",
        "user",
        f"{verb} {user.name}",
        entity_id=str(user.pk),
    )
    return await _detail(user, membership)


async def set_project_override(
    auth: AuthContext, user_id: str, project_id: str, role_override: Role | None
) -> AdminUserDetail:
    user, membership = await _target(auth, user_id)
    context = await project_service.get_context(auth, project_id)
    await project_service.upsert_member(context.project, user.pk, membership.role, role_override)
    scope = role_override.value if role_override else "workspace role"
    await audit_service.record(
        auth,
        "project_override_set",
        "user",
        f"Set {user.name} to {scope} in {context.project.key}",
        entity_id=str(user.pk),
    )
    return await _detail(user, membership)


async def remove_from_project(auth: AuthContext, user_id: str, project_id: str) -> AdminUserDetail:
    user, membership = await _target(auth, user_id)
    context = await project_service.get_context(auth, project_id)
    await project_service.remove_member_from_project(context.project, user.pk)
    await audit_service.record(
        auth,
        "member_removed",
        "user",
        f"Removed {user.name} from {context.project.key}",
        entity_id=str(user.pk),
    )
    return await _detail(user, membership)


async def create_user(auth: AuthContext, data: AdminUserCreate) -> AdminUserDetail:
    if await user_repository.get_by_email(data.email):
        raise ConflictError("A user with this email already exists", code="email_taken")
    workspace = await workspace_repository.get(auth.workspace_id)
    if workspace is None:
        raise NotFoundError("Workspace not found", code="workspace_not_found")
    user = await auth_service.create_user_with_membership(
        data.name, data.email, data.password, workspace, data.role
    )
    await audit_service.record(
        auth,
        "user_created",
        "user",
        f"Created user {user.name} ({user.email}) as {data.role.value}",
        entity_id=str(user.pk),
    )
    await email_service.send_account_created(
        user, workspace.name, auth.user.name, data.role.value.replace("_", " ").title()
    )
    membership = await workspace_repository.get_member(user.pk)
    assert membership is not None
    return await _detail(user, membership)


async def update_user(auth: AuthContext, user_id: str, data: AdminUserUpdate) -> AdminUserDetail:
    user, membership = await _target(auth, user_id)
    if data.email is not None and data.email != user.email:
        if await user_repository.get_by_email(data.email):
            raise ConflictError("A user with this email already exists", code="email_taken")
        user.email = data.email
    if data.name is not None:
        user.name = data.name
    user.updated_at = utcnow()
    await user_repository.save(user)
    await audit_service.record(
        auth, "user_updated", "user", f"Updated profile of {user.name}", entity_id=str(user.pk)
    )
    return await _detail(user, membership)


async def reset_user_password(
    auth: AuthContext, user_id: str, data: AdminPasswordReset
) -> AdminUserDetail:
    user, membership = await _target(auth, user_id)
    user.password_hash = hash_password(data.password)
    await auth_service.revoke_all_sessions(user)
    await audit_service.record(
        auth,
        "password_reset",
        "user",
        f"Reset the password of {user.name}",
        entity_id=str(user.pk),
    )
    return await _detail(user, membership)
