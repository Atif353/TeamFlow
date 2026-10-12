from collections.abc import Sequence
from typing import Any

from beanie import Document, init_beanie
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.models.activity_log import ActivityLog
from app.models.attachment import Attachment
from app.models.audit_log import AuditLog
from app.models.automation_rule import AutomationRule
from app.models.comment import Comment
from app.models.doc import Doc
from app.models.email_outbox import EmailOutbox
from app.models.email_verification import EmailVerification
from app.models.invitation import Invitation
from app.models.issue_link import IssueLink
from app.models.job_lock import JobLock
from app.models.label import Label
from app.models.notification import Notification
from app.models.password_reset_token import PasswordResetToken
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.refresh_token import RefreshToken
from app.models.saved_filter import SavedFilter
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.user import User
from app.models.version import Version
from app.models.worklog import Worklog
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember

DOCUMENT_MODELS: Sequence[type[Document]] = [
    User,
    Workspace,
    WorkspaceMember,
    Invitation,
    RefreshToken,
    Project,
    ProjectMember,
    Label,
    Task,
    Comment,
    Notification,
    Sprint,
    Worklog,
    IssueLink,
    Attachment,
    ActivityLog,
    Version,
    SavedFilter,
    AuditLog,
    PasswordResetToken,
    Doc,
    AutomationRule,
    EmailOutbox,
    EmailVerification,
    JobLock,
]


def create_client(uri: str) -> AsyncMongoClient[Any]:
    return AsyncMongoClient(uri, tz_aware=True, serverSelectionTimeoutMS=5000)


async def init_database(database: AsyncDatabase[Any]) -> None:
    await init_beanie(database=database, document_models=list(DOCUMENT_MODELS))


async def ping_database(client: AsyncMongoClient[Any]) -> bool:
    try:
        await client.admin.command("ping")
    except Exception:
        return False
    return True
