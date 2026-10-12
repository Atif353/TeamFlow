from datetime import datetime
from typing import Annotated, Any

from beanie import PydanticObjectId
from pydantic import Field, StringConstraints

from app.schemas.common import ApiModel, OutModel

FilterName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class SavedFilterOut(OutModel):
    id: PydanticObjectId
    project_id: PydanticObjectId
    name: str
    params: dict[str, Any]
    created_at: datetime


class SavedFilterCreate(ApiModel):
    name: FilterName
    params: dict[str, str] = Field(default_factory=dict, max_length=20)
