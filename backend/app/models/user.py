from datetime import datetime

from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.utils.time import utcnow


class EmailPreferences(BaseModel):
    assigned: bool = True
    mentioned: bool = True
    overdue: bool = True
    comments: bool = False
    status_changes: bool = False
    daily_digest: bool = False


class User(BaseDocument):
    name: str
    email: str
    password_hash: str
    avatar_color: str
    is_active: bool = True
    email_verified: bool = True
    email_preferences: EmailPreferences = Field(default_factory=EmailPreferences)
    last_digest_on: str | None = None
    token_version: int = 0
    last_login_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "users"
        indexes = [IndexModel([("email", ASCENDING)], unique=True)]
