from __future__ import annotations

from typing import Any


class ApiError(Exception):
    """Domain error rendered as {"error": str, "code": str}."""

    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code

    def body(self) -> dict[str, Any]:
        return {"error": self.message, "code": self.code}


def not_found(entity: str) -> ApiError:
    return ApiError(f"{entity} not found", "NOT_FOUND", 404)


def conflict(message: str) -> ApiError:
    return ApiError(message, "CONFLICT", 409)


def forbidden(message: str = "insufficient permissions") -> ApiError:
    return ApiError(message, "FORBIDDEN", 403)


def unauthorized(message: str = "invalid or expired token") -> ApiError:
    return ApiError(message, "UNAUTHORIZED", 401)