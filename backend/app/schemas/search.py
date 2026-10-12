from beanie import PydanticObjectId

from app.schemas.common import OutModel
from app.schemas.task import IssueBrief


class SearchIssue(IssueBrief):
    project_id: PydanticObjectId
    project_name: str


class SearchDoc(OutModel):
    id: PydanticObjectId
    title: str
    project_id: PydanticObjectId
    project_name: str


class SearchProject(OutModel):
    id: PydanticObjectId
    name: str
    key: str
    color: str


class SearchResults(OutModel):
    issues: list[SearchIssue]
    docs: list[SearchDoc]
    projects: list[SearchProject]
