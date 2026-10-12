import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.database import create_client, init_database
from app.core.exceptions import error_response, register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import SecurityHeadersMiddleware
from app.core.migrations import run_migrations
from app.core.rate_limit import limiter
from app.services.scheduler import run_scheduler

API_PREFIX = "/api/v1"


async def handle_rate_limit(_: Request, __: Exception) -> Response:
    return error_response(429, "too_many_requests", "Too many requests, try again later")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.environment)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        client = create_client(settings.mongodb_uri)
        app.state.mongo_client = client
        await init_database(client[settings.mongodb_db])
        await run_migrations()
        scan = None if settings.environment == "test" else asyncio.create_task(run_scheduler())
        yield
        if scan is not None:
            scan.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await scan
        await client.close()

    app = FastAPI(title="TeamFlow API", version="1.0.0", lifespan=lifespan)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, handle_rate_limit)
    register_exception_handlers(app)
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(SecurityHeadersMiddleware, enable_hsts=settings.is_production)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(api_router, prefix=API_PREFIX)
    return app


app = create_app()
