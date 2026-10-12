from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = Field(min_length=1)
    mongodb_db: str = Field(min_length=1)
    jwt_secret: str = Field(min_length=16)
    access_token_minutes: int = Field(default=15, gt=0)
    refresh_token_days: int = Field(default=7, gt=0)
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    frontend_url: str = "http://localhost:5173"
    environment: Literal["development", "test", "production"] = "development"
    rate_limit_enabled: bool = True
    storage_dir: str = "storage"
    max_upload_bytes: int = 10 * 1024 * 1024
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_security: Literal["starttls", "ssl", "none"] = "starttls"
    app_name: str = "TeamFlow"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str) and not value.startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def sender_address(self) -> str:
        return self.smtp_from or self.smtp_user or "no-reply@teamflow.local"

    @property
    def smtp_login(self) -> str:
        user, sender = self.smtp_user or "", self.smtp_from or ""
        return sender if "@" not in user and "@" in sender else user

    @property
    def smtp_secret(self) -> str:
        return "".join((self.smtp_password or "").split())

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
