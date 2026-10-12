import re
from collections.abc import Iterable
from typing import Any, Generic, TypeVar

from beanie import PydanticObjectId
from beanie.odm.enums import SortDirection

from app.models.base import BaseDocument

ASC = SortDirection.ASCENDING
DESC = SortDirection.DESCENDING

DocT = TypeVar("DocT", bound=BaseDocument)


def contains_pattern(text: str) -> dict[str, Any]:
    return {"$regex": re.escape(text), "$options": "i"}


class BaseRepository(Generic[DocT]):
    def __init__(self, model: type[DocT]) -> None:
        self.model = model

    async def get(self, doc_id: PydanticObjectId) -> DocT | None:
        return await self.model.get(doc_id)

    async def insert(self, doc: DocT) -> DocT:
        await doc.insert()
        return doc

    async def save(self, doc: DocT) -> DocT:
        await doc.save()
        return doc

    async def delete(self, doc: DocT) -> None:
        await doc.delete()

    async def find_by_ids(self, ids: Iterable[PydanticObjectId]) -> list[DocT]:
        unique_ids = list(set(ids))
        if not unique_ids:
            return []
        return await self.model.find({"_id": {"$in": unique_ids}}).to_list()


def modified_count(result: object) -> int:
    return int(getattr(result, "modified_count", 0))
