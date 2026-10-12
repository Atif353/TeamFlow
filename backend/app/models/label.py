from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class Label(BaseDocument):
    project_id: PydanticObjectId
    name: str
    color: str

    class Settings:
        name = "labels"
        indexes = [IndexModel([("project_id", ASCENDING), ("name", ASCENDING)], unique=True)]
