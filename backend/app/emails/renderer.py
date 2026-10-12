import html as html_lib
import re
from pathlib import Path
from typing import Any

import nh3
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import get_settings

TEMPLATE_DIR = Path(__file__).parent / "templates"
_environment = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)
BLOCK_BREAKS = re.compile(r"</(p|tr|h1|li|table)>|<br\s*/?>", re.IGNORECASE)
LINK = re.compile(r'<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)


def to_text(markup: str) -> str:
    with_links = LINK.sub(lambda match: f"{match.group(2)} ({match.group(1)})", markup)
    broken = BLOCK_BREAKS.sub("\n", with_links)
    plain = html_lib.unescape(nh3.clean(broken, tags=set()))
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in plain.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def render(template: str, subject: str, preheader: str, **context: Any) -> tuple[str, str]:
    settings = get_settings()
    markup = _environment.get_template(f"{template}.html").render(
        subject=subject,
        preheader=preheader,
        app_name=settings.app_name,
        frontend_url=settings.frontend_url.rstrip("/"),
        **context,
    )
    return markup, to_text(markup)
