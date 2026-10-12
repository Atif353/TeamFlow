import asyncio
import logging
from collections.abc import Awaitable, Callable

from app.services import automation_service, email_service
from app.services.job_service import run_exclusive

logger = logging.getLogger(__name__)
TICK_SECONDS = 15
OVERDUE_EVERY_TICKS = 60
DIGEST_EVERY_TICKS = 240
LOCK_SECONDS = 120


async def _guarded(name: str, job: Callable[[], Awaitable[object]]) -> None:
    try:
        await run_exclusive(name, LOCK_SECONDS, job)
    except Exception:
        logger.exception("Scheduled job %s failed", name)


async def run_scheduler() -> None:
    tick = 0
    while True:
        await asyncio.sleep(TICK_SECONDS)
        tick += 1
        await _guarded("email-delivery", email_service.deliver_pending)
        if tick % OVERDUE_EVERY_TICKS == 0:
            await _guarded("overdue-scan", automation_service.notify_overdue_tasks)
        if tick % DIGEST_EVERY_TICKS == 0:
            await _guarded("daily-digest", email_service.send_daily_digests)
