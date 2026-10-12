import hmac
from datetime import timedelta

from app.core.exceptions import BusinessRuleError, GoneError, TooManyRequestsError
from app.core.security import hash_token
from app.models.email_verification import EmailVerification
from app.models.user import User
from app.repositories.email_verification_repository import email_verification_repository
from app.services import email_service
from app.utils.time import utcnow

CODE_TTL_MINUTES = email_service.VERIFICATION_MINUTES
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60
MAX_SENDS_PER_HOUR = 5
WINDOW = timedelta(hours=1)


def _digest(user: User, code: str) -> str:
    return hash_token(f"{user.pk}:{code}")


async def issue_code(user: User) -> str:
    now = utcnow()
    record = await email_verification_repository.for_user(user.pk)
    code = email_service.generate_code()
    if record is None:
        record = EmailVerification(
            user_id=user.pk, code_hash="", expires_at=now + timedelta(minutes=CODE_TTL_MINUTES)
        )
    else:
        if (now - record.sent_at).total_seconds() < RESEND_COOLDOWN_SECONDS:
            raise TooManyRequestsError(
                "Please wait a minute before requesting another code", code="resend_too_soon"
            )
        if now - record.window_started_at > WINDOW:
            record.window_started_at, record.sends_in_window = now, 0
        if record.sends_in_window >= MAX_SENDS_PER_HOUR:
            raise TooManyRequestsError(
                "Too many codes requested, try again later", code="resend_limit_reached"
            )
        record.sends_in_window += 1
    record.code_hash = _digest(user, code)
    record.expires_at = now + timedelta(minutes=CODE_TTL_MINUTES)
    record.attempts = 0
    record.sent_at = now
    await email_verification_repository.save(record)
    await email_service.send_verification_code(user, code)
    return code


async def check_code(user: User, code: str) -> None:
    record = await email_verification_repository.for_user(user.pk)
    if record is None or record.expires_at <= utcnow():
        raise GoneError("This code has expired. Request a new one", code="code_expired")
    if record.attempts >= MAX_ATTEMPTS:
        raise TooManyRequestsError(
            "Too many wrong attempts. Request a new code", code="too_many_attempts"
        )
    if not hmac.compare_digest(record.code_hash, _digest(user, code)):
        record.attempts += 1
        await email_verification_repository.save(record)
        raise BusinessRuleError("That code is not correct", code="invalid_code")
    await email_verification_repository.delete(record)
