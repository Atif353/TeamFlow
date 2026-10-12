from typing import Annotated, Generic, TypeVar

from beanie import PydanticObjectId
from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.models.user import User

T = TypeVar("T")


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class OutModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(OutModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


def validate_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not any(char.isalpha() for char in value):
        raise ValueError("Password must contain at least one letter")
    if not any(char.isdigit() for char in value):
        raise ValueError("Password must contain at least one number")
    return value


Password = Annotated[str, Field(max_length=128), AfterValidator(validate_password)]
Email = Annotated[EmailStr, AfterValidator(lambda value: value.lower())]
PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
HexColor = Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]


class UserBrief(OutModel):
    id: PydanticObjectId
    name: str
    avatar_color: str
    is_active: bool

    @classmethod
    def from_user(cls, user: User) -> "UserBrief":
        return cls(
            id=user.pk, name=user.name, avatar_color=user.avatar_color, is_active=user.is_active
        )
