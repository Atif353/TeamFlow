from datetime import date, datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class Version(BaseDocument):
    project_id: PydanticObjectId
    name: str
    description: str = ""
    start_date: date | None = None
    release_date: date | None = None
    released: bool = False
    released_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "versions"
        indexes = [IndexModel([("project_id", ASCENDING), ("name", ASCENDING)], unique=True)]
