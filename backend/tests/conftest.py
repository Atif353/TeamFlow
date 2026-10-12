import os
import uuid
from collections.abc import AsyncIterator, Iterator

TEST_DATABASE = f"teamflow_test_{uuid.uuid4().hex[:8]}"
os.environ["MONGODB_DB"] = TEST_DATABASE
os.environ["ENVIRONMENT"] = "test"
os.environ["RATE_LIMIT_ENABLED"] = "false"
for _name in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"):
    os.environ[_name] = ""
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret")

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.rate_limit import limiter
from app.main import app
from tests.factories import World, create_world


@pytest.fixture(scope="session")
async def client() -> AsyncIterator[AsyncClient]:
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test/api/v1") as http_client:
            yield http_client
        await app.state.mongo_client.drop_database(TEST_DATABASE)


@pytest.fixture
async def world(client: AsyncClient) -> World:
    return await create_world()


@pytest.fixture
def rate_limited() -> Iterator[None]:
    limiter.enabled = True
    limiter.reset()
    yield
    limiter.enabled = False
    limiter.reset()
