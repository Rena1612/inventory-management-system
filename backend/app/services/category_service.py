from __future__ import annotations

import uuid

import asyncpg  # type: ignore[import-untyped]

from app.errors import conflict, not_found


async def assert_valid_parent(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    parent_id: uuid.UUID,
    category_id: uuid.UUID | None = None,
) -> None:
    """Reject a parent that is missing, in another org, the category itself, or a descendant of it.

    category_id is None on create: a new category has no descendants, so only the
    parent's existence is checked.
    """
    if not await conn.fetchval(
        "SELECT 1 FROM categories WHERE id = $1 AND org_id = $2 AND archived_at IS NULL",
        parent_id,
        org_id,
    ):
        raise not_found("category")

    if category_id is None:
        return
    if parent_id == category_id:
        raise conflict("a category cannot be its own parent")

    # Walk down from the category being edited; if the proposed parent is anywhere
    # in that subtree, the move would close a cycle.
    is_descendant = await conn.fetchval(
        """
        WITH RECURSIVE subtree AS (
            SELECT id FROM categories WHERE parent_id = $1 AND org_id = $2
            UNION
            SELECT c.id FROM categories c JOIN subtree s ON c.parent_id = s.id
            WHERE c.org_id = $2
        )
        SELECT EXISTS (SELECT 1 FROM subtree WHERE id = $3)
        """,
        category_id,
        org_id,
        parent_id,
    )
    if is_descendant:
        raise conflict("a category cannot be moved under one of its own descendants")
