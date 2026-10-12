import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.utils.time import utcnow

ALGORITHM = "HS256"
ACCESS_TOKEN_TYPE = "access"

_hasher = PasswordHasher()
DUMMY_PASSWORD_HASH = _hasher.hash(secrets.token_urlsafe(16))


@dataclass(frozen=True)
class TokenClaims:
    user_id: str
    token_version: int


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(
    user_id: str, token_version: int, expires_delta: timedelta | None = None
) -> str:
    settings = get_settings()
    now = utcnow()
    lifetime = expires_delta or timedelta(minutes=settings.access_token_minutes)
    payload = {
        "sub": user_id,
        "tv": token_version,
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + lifetime,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> TokenClaims:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as error:
        raise UnauthorizedError("Access token expired", code="token_expired") from error
    except jwt.PyJWTError as error:
        raise UnauthorizedError("Invalid access token", code="invalid_token") from error
    if payload.get("type") != ACCESS_TOKEN_TYPE or "sub" not in payload or "tv" not in payload:
        raise UnauthorizedError("Invalid access token", code="invalid_token")
    return TokenClaims(user_id=str(payload["sub"]), token_version=int(payload["tv"]))


def generate_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
