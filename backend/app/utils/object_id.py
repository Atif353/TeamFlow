from beanie import PydanticObjectId
from bson.errors import InvalidId

from app.core.exceptions import NotFoundError


def to_object_id(value: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except (InvalidId, TypeError) as error:
        raise NotFoundError("Resource not found") from error
