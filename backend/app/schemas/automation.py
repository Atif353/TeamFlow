from datetime import datetime
from typing import Annotated

from beanie import PydanticObjectId
from pydantic import StringConstraints, model_validator

from app.models.automation_rule import AutomationAction, AutomationTrigger
from app.schemas.common import ApiModel, OutModel

RuleName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
VALUE_ACTIONS = (AutomationAction.SET_PRIORITY, AutomationAction.ADD_COMMENT)


class AutomationRuleOut(OutModel):
    id: PydanticObjectId
    project_id: PydanticObjectId
    name: str
    trigger: AutomationTrigger
    trigger_status_id: str | None
    action: AutomationAction
    action_value: str | None
    enabled: bool
    run_count: int
    created_at: datetime


class AutomationRuleCreate(ApiModel):
    name: RuleName
    trigger: AutomationTrigger
    trigger_status_id: str | None = None
    action: AutomationAction
    action_value: str | None = None
    enabled: bool = True

    @model_validator(mode="after")
    def check_consistency(self) -> "AutomationRuleCreate":
        if self.trigger == AutomationTrigger.STATUS_CHANGED and not self.trigger_status_id:
            raise ValueError("trigger_status_id is required for status change rules")
        if self.action in VALUE_ACTIONS and not self.action_value:
            raise ValueError("action_value is required for this action")
        return self


class AutomationRuleUpdate(ApiModel):
    name: RuleName | None = None
    enabled: bool | None = None
