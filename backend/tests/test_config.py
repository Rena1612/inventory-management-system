"""Config guards: a copied .env.example must not boot a real instance."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import PLACEHOLDER_MARKERS, Settings

REAL_SECRET = "k3Jq8vTn2bWzXpL4mNc7dRf9sHy1uAe5Gi0oQ"  # 34 chars
EXAMPLE_SECRET = "change-me-to-a-random-64-character-string"


def make(**overrides: str) -> Settings:
    base = {
        "database_url": "postgresql://inventory:inventory@localhost:5433/inventory_test",
        "jwt_secret": REAL_SECRET,
    }
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def test_dev_accepts_the_placeholder() -> None:
    """cp .env.example .env must just work for a developer."""
    settings = make(jwt_secret=EXAMPLE_SECRET, environment="dev")
    assert settings.is_dev


@pytest.mark.parametrize("environment", ["staging", "production"])
def test_non_dev_rejects_the_placeholder(environment: str) -> None:
    with pytest.raises(ValidationError, match="placeholder"):
        make(jwt_secret=EXAMPLE_SECRET, environment=environment)


@pytest.mark.parametrize("marker", PLACEHOLDER_MARKERS)
def test_non_dev_rejects_any_placeholder_marker(marker: str) -> None:
    padded = (marker + "-padding-until-long-enough-32").lower()
    assert len(padded) >= 32
    with pytest.raises(ValidationError, match="placeholder"):
        make(jwt_secret=padded, environment="production")


def test_non_dev_rejects_short_secret() -> None:
    with pytest.raises(ValidationError):
        make(jwt_secret="tooshort", environment="production")


def test_non_dev_accepts_a_real_secret() -> None:
    assert make(jwt_secret=REAL_SECRET, environment="production").jwt_secret == REAL_SECRET


def test_placeholder_check_is_case_insensitive() -> None:
    with pytest.raises(ValidationError, match="placeholder"):
        make(jwt_secret="CHANGE-ME-to-something-long-enough-here", environment="staging")


def test_seed_refuses_outside_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    """scripts/seed.py must not create the demo owner in a real environment."""
    import scripts.seed as seed_module

    monkeypatch.setattr(seed_module, "get_settings", lambda: make(environment="production"))

    async def never_connect(*args: object, **kwargs: object) -> None:
        raise AssertionError("must not open a database connection")

    monkeypatch.setattr(seed_module.asyncpg, "connect", never_connect)

    with pytest.raises(SystemExit, match="refusing to seed"):
        asyncio_run(seed_module.run())


def test_seed_allowed_in_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    """In dev the guard must not fire — proven by reaching the connect call.

    The connection is stubbed so no demo rows are actually written.
    """
    import scripts.seed as seed_module

    monkeypatch.setattr(seed_module, "get_settings", lambda: make(environment="dev"))

    reached_connect = False

    async def fake_connect(*args: object, **kwargs: object) -> None:
        nonlocal reached_connect
        reached_connect = True
        raise RuntimeError("stop-here")

    monkeypatch.setattr(seed_module.asyncpg, "connect", fake_connect)

    with pytest.raises(RuntimeError, match="stop-here"):
        asyncio_run(seed_module.run())

    assert reached_connect, "guard blocked the seed in dev"


def asyncio_run(coro):  # type: ignore[no-untyped-def]
    import asyncio

    return asyncio.run(coro)