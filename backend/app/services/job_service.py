from collections.abc import Awaitable, Callable
from datetime import timedelta
from typing import TypeVar

from pymongo.errors import DuplicateKeyError

from app.models.job_lock import JobLock
from app.utils.time import utcnow

T = TypeVar("T")


async def run_exclusive(name: str, ttl_seconds: int, job: Callable[[], Awaitable[T]]) -> T | None:
    try:
        await JobLock(name=name, expires_at=utcnow() + timedelta(seconds=ttl_seconds)).insert()
    except DuplicateKeyError:
        existing = await JobLock.find_one({"name": name})
        if existing is None or existing.expires_at > utcnow():
            return None
        await existing.delete()
        return await run_exclusive(name, ttl_seconds, job)
    try:
        return await job()
    finally:
        await JobLock.find({"name": name}).delete()
