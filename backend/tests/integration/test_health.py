from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app


async def test_health_reports_database_up(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "up"}


async def test_unknown_route_uses_error_format(client: AsyncClient) -> None:
    response = await client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    assert set(response.json()) == {"code", "message", "details"}


async def test_security_headers_present(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


async def test_hsts_header_only_sent_in_production() -> None:
    production = create_app(
        Settings(
            mongodb_uri="mongodb://localhost:27017",
            mongodb_db="unused",
            jwt_secret="x" * 32,
            environment="production",
            _env_file=None,
        )
    )
    async with AsyncClient(
        transport=ASGITransport(app=production), base_url="http://test/api/v1"
    ) as http_client:
        response = await http_client.get("/does-not-exist")

    assert "max-age" in response.headers["strict-transport-security"]


async def test_hsts_header_absent_outside_production(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert "strict-transport-security" not in response.headers
