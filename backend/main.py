from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.config import get_settings
from app.db import close_pool, create_pool
from app.errors import ApiError
from app.routes import (
    auth_router,
    categories_router,
    locations_router,
    movements_router,
    orgs_router,
    products_router,
    purchase_orders_router,
    reports_router,
    suppliers_router,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("inventory")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await create_pool()
    logger.info("database pool ready")
    try:
        yield
    finally:
        await close_pool()
        logger.info("database pool closed")


app = FastAPI(
    title="Inventory Management System",
    version="1.0.0",
    description="Multi-tenant inventory tracking API.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.body())


@app.exception_handler(ValidationError)
async def validation_error_handler(_request: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"error": str(exc), "code": "VALIDATION_ERROR"})


@app.exception_handler(asyncpg.PostgresError)
async def postgres_error_handler(_request: Request, exc: asyncpg.PostgresError) -> JSONResponse:
    logger.warning("postgres error: %s", exc)
    # Keyed by SQLSTATE, not constraint name.
    mapping = {
        "23505": ("CONFLICT", 409),               # unique_violation
        "23503": ("FOREIGN_KEY_VIOLATION", 409),   # foreign_key_violation
        "23514": ("CONSTRAINT_VIOLATION", 422),    # check_violation
        "23001": ("RESTRICT_VIOLATION", 409),      # restrict_violation
        "23502": ("CONSTRAINT_VIOLATION", 422),    # not_null_violation
        "22001": ("VALUE_TOO_LONG", 422),          # string_data_right_truncation
    }
    code, status_code = mapping.get(exc.sqlstate or "", ("INTERNAL_ERROR", 500))
    return JSONResponse(status_code=status_code, content={"error": str(exc), "code": code})


@app.get("/health", tags=["ops"])
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/health", tags=["ops"])
async def api_health() -> dict:
    from app.db import fetchval

    try:
        await fetchval("SELECT 1")
        return {"status": "ok", "database": "up"}
    except Exception as exc:  # pragma: no cover
        logger.error("health check failed: %s", exc)
        return {"status": "degraded", "database": "down"}


for router in (
    auth_router,
    products_router,
    movements_router,
    locations_router,
    categories_router,
    suppliers_router,
    purchase_orders_router,
    reports_router,
    orgs_router,
):
    app.include_router(router)