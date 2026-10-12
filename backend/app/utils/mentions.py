import re
from collections.abc import Iterable
from typing import TypeVar

T = TypeVar("T")


def extract_mentioned_ids(body: str, members: Iterable[tuple[T, str]]) -> list[T]:
    remaining = body
    found: list[T] = []
    for member_id, name in sorted(members, key=lambda member: len(member[1]), reverse=True):
        pattern = re.compile(rf"(?<![\w@])@{re.escape(name)}(?!\w)", re.IGNORECASE)
        if pattern.search(remaining):
            found.append(member_id)
            remaining = pattern.sub(lambda match: " " * len(match.group(0)), remaining)
    return found
