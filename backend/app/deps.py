import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated

import asyncpg
from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth import decode_access_token
from app.db import connection
from app.errors import forbidden, unauthorized

bearer = HTTPBearer(auto_error=False)

MAX_LIMIT = 200
DEFAULT_LIMIT = 20


@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: uuid.UUID
    org_id: uuid.UUID
    role: str


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> CurrentUser:
    if creds is None:
        raise unauthorized("missing bearer token")
    payload = decode_access_token(creds.credentials)
    return CurrentUser(id=payload.user_id, org_id=payload.org_id, role=payload.role)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


class OrgRole:
    """Role gate usable as `Depends(OrgRole.can_write)`.

    The `user` parameter must carry an explicit Depends: without it FastAPI
    treats the CurrentUser dataclass as a request body field.
    """

    WRITE_ROLES = frozenset({"owner", "admin", "member"})
    ADMIN_ROLES = frozenset({"owner", "admin"})

    @staticmethod
    def can_write(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in OrgRole.WRITE_ROLES:
            raise forbidden("write access required")
        return user

    @staticmethod
    def can_admin(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in OrgRole.ADMIN_ROLES:
            raise forbidden("admin access required")
        return user


WriterDep = Annotated[CurrentUser, Depends(OrgRole.can_write)]
AdminDep = Annotated[CurrentUser, Depends(OrgRole.can_admin)]


class Page:
    def __init__(
        self,
        limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> None:
        self.limit = limit
        self.offset = offset


PageDep = Annotated[Page, Depends()]


class Search:
    def __init__(self, q: Annotated[str | None, Query(max_length=200)] = None) -> None:
        self.q = q.strip() if q else None


SearchDep = Annotated[Search, Depends()]


async def get_connection() -> AsyncIterator[asyncpg.Connection]:
    async with connection() as conn:
        yield conn


ConnectionDep = Annotated[asyncpg.Connection, Depends(get_connection)]


class TimeRange:
    def __init__(
        self,
        date_from: Annotated[datetime | None, Query()] = None,
        date_to: Annotated[datetime | None, Query()] = None,
    ) -> None:
        self.date_from = date_from
        self.date_to = date_to


TimeRangeDep = Annotated[TimeRange, Depends()]