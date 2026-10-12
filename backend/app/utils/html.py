import re

import nh3

ALLOWED_TAGS = {
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "code",
    "pre",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "a",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "img",
    "mark",
}
ALLOWED_ATTRIBUTES = {"a": {"href", "title"}, "img": {"src", "alt"}, "td": {"colspan", "rowspan"}}
ALLOWED_URL_SCHEMES = {"http", "https", "mailto"}
TAG_PATTERN = re.compile(r"</?[a-zA-Z][^>]*>")


def sanitize(content: str) -> str:
    return nh3.clean(
        content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes=ALLOWED_URL_SCHEMES,
    )


def sanitize_rich_text(content: str) -> str:
    return sanitize(content) if TAG_PATTERN.search(content) else content
