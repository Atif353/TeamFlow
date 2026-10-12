from datetime import UTC, date, datetime, time


def utcnow() -> datetime:
    return datetime.now(UTC)


def date_to_datetime(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=UTC)


def datetime_to_date(value: datetime | None) -> date | None:
    return value.date() if value else None
