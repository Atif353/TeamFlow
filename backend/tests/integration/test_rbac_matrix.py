import pytest
from beanie import PydanticObjectId

from app.permissions.matrix import Permission
from app.permissions.policies import can, can_delete_comment, can_edit_task, effective_role
from app.permissions.roles import Role

SUPER, MANAGER, MEMBER, VIEWER = (
    Role.SUPER_ADMIN,
    Role.PROJECT_MANAGER,
    Role.MEMBER,
    Role.VIEWER,
)

SRS_MATRIX: dict[Permission, dict[Role, bool]] = {
    Permission.USER_MANAGE: {SUPER: True, MANAGER: False, MEMBER: False, VIEWER: False},
    Permission.ADMIN_ACCESS: {SUPER: True, MANAGER: False, MEMBER: False, VIEWER: False},
    Permission.PROJECT_CREATE: {SUPER: True, MANAGER: True, MEMBER: False, VIEWER: False},
    Permission.PROJECT_DELETE: {SUPER: True, MANAGER: True, MEMBER: False, VIEWER: False},
    Permission.PROJECT_MEMBERS: {SUPER: True, MANAGER: True, MEMBER: False, VIEWER: False},
    Permission.TASK_CREATE: {SUPER: True, MANAGER: True, MEMBER: True, VIEWER: False},
    Permission.TASK_EDIT_ANY: {SUPER: True, MANAGER: True, MEMBER: False, VIEWER: False},
    Permission.TASK_EDIT_OWN: {SUPER: True, MANAGER: True, MEMBER: True, VIEWER: False},
    Permission.TASK_DELETE_ANY: {SUPER: True, MANAGER: True, MEMBER: False, VIEWER: False},
    Permission.TASK_DELETE_OWN: {SUPER: True, MANAGER: True, MEMBER: True, VIEWER: False},
    Permission.COMMENT_CREATE: {SUPER: True, MANAGER: True, MEMBER: True, VIEWER: False},
    Permission.COMMENT_DELETE_ANY: {SUPER: True, MANAGER: True, MEMBER: False, VIEWER: False},
    Permission.DOC_WRITE: {SUPER: True, MANAGER: True, MEMBER: True, VIEWER: False},
    Permission.AUTOMATION_MANAGE: {SUPER: True, MANAGER: True, MEMBER: False, VIEWER: False},
    Permission.SPRINT_MANAGE: {SUPER: True, MANAGER: True, MEMBER: False, VIEWER: False},
    Permission.PROJECT_VIEW: {SUPER: True, MANAGER: True, MEMBER: True, VIEWER: True},
}

CASES = [
    (role, permission, allowed)
    for permission, by_role in SRS_MATRIX.items()
    for role, allowed in by_role.items()
]


def test_matrix_covers_every_permission() -> None:
    assert set(SRS_MATRIX) == set(Permission)


@pytest.mark.parametrize(("role", "permission", "allowed"), CASES)
def test_role_permission_matches_srs_appendix_b(
    role: Role, permission: Permission, allowed: bool
) -> None:
    assert can(role, permission) is allowed


def test_effective_role_prefers_override_except_for_super_admin() -> None:
    assert effective_role(MEMBER, VIEWER) == VIEWER
    assert effective_role(VIEWER, MANAGER) == MANAGER
    assert effective_role(MEMBER, None) == MEMBER
    assert effective_role(SUPER, VIEWER) == SUPER


def test_member_can_edit_only_owned_tasks() -> None:
    me, other = PydanticObjectId(), PydanticObjectId()

    assert can_edit_task(MEMBER, me, me, other)
    assert can_edit_task(MEMBER, me, other, me)
    assert not can_edit_task(MEMBER, me, other, other)
    assert can_edit_task(MANAGER, me, other, other)
    assert not can_edit_task(VIEWER, me, me, me)


def test_comment_deletion_rules() -> None:
    me, other = PydanticObjectId(), PydanticObjectId()

    assert can_delete_comment(MEMBER, me, me)
    assert not can_delete_comment(MEMBER, me, other)
    assert can_delete_comment(MANAGER, me, other)
    assert not can_delete_comment(VIEWER, me, me)
