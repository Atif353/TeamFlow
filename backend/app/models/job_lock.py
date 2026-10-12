from datetime import datetime

from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class JobLock(BaseDocument):
    name: str
    expires_at: datetime

    class Settings:
        name = "job_locks"
        indexes = [
            IndexModel([("name", ASCENDING)], unique=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
