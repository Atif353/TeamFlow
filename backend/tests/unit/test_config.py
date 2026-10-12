import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_missing_mongodb_uri_fails_fast(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MONGODB_URI", raising=False)

    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None)

    assert "mongodb_uri" in str(error.value)


def test_cors_origins_parsed_from_comma_separated_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test, http://b.test")

    settings = Settings(_env_file=None)

    assert settings.cors_origins == ["http://a.test", "http://b.test"]
