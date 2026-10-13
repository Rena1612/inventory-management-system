"""Applies every .sql file in backend/migrations in filename order, tracked in schema_migrations."""

from __future__ import annotations

import asyncio
import pathlib
import sys

import asyncpg

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.config import get_settings

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parent.parent / "migrations"


async def applied_migrations(conn: asyncpg.Connection) -> set[str]:
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name        TEXT PRIMARY KEY,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    rows = await conn.fetch("SELECT name FROM schema_migrations")
    return {row["name"] for row in rows}


async def run() -> None:
    settings = get_settings()
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        print(f"no migrations found in {MIGRATIONS_DIR}")
        return

    conn = await asyncpg.connect(settings.database_url)
    try:
        done = await applied_migrations(conn)
        for path in files:
            if path.name in done:
                print(f"  skip  {path.name}")
                continue
            print(f"  apply {path.name}")
            # Each migration is a single transaction in the file itself.
            await conn.execute(path.read_text(encoding="utf-8"))
            await conn.execute("INSERT INTO schema_migrations (name) VALUES ($1)", path.name)
        print("done")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())