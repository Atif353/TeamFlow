from enum import StrEnum


class Role(StrEnum):
    SUPER_ADMIN = "super_admin"
    PROJECT_MANAGER = "project_manager"
    MEMBER = "member"
    VIEWER = "viewer"
