from datetime import datetime
from enum import StrEnum

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class AutomationTrigger(StrEnum):
    STATUS_CHANGED = "status_changed"
    ISSUE_CREATED = "issue_created"
    ISSUE_ASSIGNED = "issue_assigned"


class AutomationAction(StrEnum):
    NOTIFY_ASSIGNEE = "notify_assignee"
    NOTIFY_WATCHERS = "notify_watchers"
    SET_PRIORITY = "set_priority"
    FLAG_ISSUE = "flag_issue"
    ADD_COMMENT = "add_comment"


class AutomationRule(BaseDocument):
    project_id: PydanticObjectId
    name: str
    trigger: AutomationTrigger
    trigger_status_id: str | None = None
    action: AutomationAction
    action_value: str | None = None
    enabled: bool = True
    run_count: int = 0
    created_by: PydanticObjectId
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "automation_rules"
        indexes = [IndexModel([("project_id", ASCENDING), ("enabled", ASCENDING)])]
