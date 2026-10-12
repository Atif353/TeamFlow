from typing import Annotated

from beanie import PydanticObjectId
from pydantic import StringConstraints

from app.schemas.common import ApiModel, HexColor, OutModel

LabelName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


class LabelOut(OutModel):
    id: PydanticObjectId
    project_id: PydanticObjectId
    name: str
    color: str


class LabelCreate(ApiModel):
    name: LabelName
    color: HexColor = "#6366F1"


class LabelUpdate(ApiModel):
    name: LabelName | None = None
    color: HexColor | None = None
