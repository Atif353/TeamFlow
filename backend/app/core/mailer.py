import logging
from email.message import EmailMessage
from typing import Protocol

import aiosmtplib

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)
SMTP_TIMEOUT_SECONDS = 20


class Mailer(Protocol):
    async def send(self, to_address: str, subject: str, html: str, text: str) -> None: ...


class SmtpMailer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _message(self, to_address: str, subject: str, html: str, text: str) -> EmailMessage:
        message = EmailMessage()
        message["From"] = f"{self.settings.app_name} <{self.settings.sender_address}>"
        message["To"] = to_address
        message["Subject"] = subject
        message.set_content(text)
        message.add_alternative(html, subtype="html")
        return message

    async def send(self, to_address: str, subject: str, html: str, text: str) -> None:
        settings = self.settings
        await aiosmtplib.send(
            self._message(to_address, subject, html, text),
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_login,
            password=settings.smtp_secret,
            use_tls=settings.smtp_security == "ssl",
            start_tls=settings.smtp_security == "starttls",
            timeout=SMTP_TIMEOUT_SECONDS,
        )


class LogMailer:
    async def send(self, to_address: str, subject: str, html: str, text: str) -> None:
        logger.info("Email to %s | %s\n%s", to_address, subject, text)


_override: Mailer | None = None


def set_mailer(mailer: Mailer | None) -> None:
    global _override
    _override = mailer


def get_mailer() -> Mailer:
    if _override is not None:
        return _override
    settings = get_settings()
    return SmtpMailer(settings) if settings.email_enabled else LogMailer()
