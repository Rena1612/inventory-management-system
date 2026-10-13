"""Helpers for building parameterised UPDATE statements safely."""

from __future__ import annotations

import uuid
from typing import Any


def build_update(
    table: str,
    fields: dict[str, Any],
    *,
    row_id: uuid.UUID,
    org_id: uuid.UUID,
) -> tuple[str, list[Any]]:
    """Return (query, args) for a partial UPDATE scoped to one organization.

    Column names come from a Pydantic model's own fields; values are always
    bound as parameters.
    """
    if not fields:
        raise ValueError("no fields to update")

    args: list[Any] = []
    assignments: list[str] = []
    for column, value in fields.items():
        args.append(value)
        assignments.append(f"{column} = ${len(args)}")

    args.extend([row_id, org_id])
    query = (
        f"UPDATE {table} SET {', '.join(assignments)} "
        f"WHERE id = ${len(args) - 1} AND org_id = ${len(args)} "
        "RETURNING *"
    )
    return query, args


def scoped_insert(
    table: str, columns: list[str], *, org_id: uuid.UUID
) -> tuple[str, list[Any]]:
    """Return (query, args) prefixing an INSERT with org_id and its columns."""
    numbered = [f"${index + 1}" for index in range(len(columns) + 1)]
    placeholders = ", ".join(numbered)
    return (
        f"INSERT INTO {table} (org_id, {', '.join(columns)}) VALUES ({placeholders}) RETURNING *",
        [org_id],
    )