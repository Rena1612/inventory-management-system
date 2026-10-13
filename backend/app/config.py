from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60 * 24 * 7

    # localhost and 127.0.0.1 are distinct origins to the browser.
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    pool_min_size: int = 2
    pool_max_size: int = 10
    sql_echo: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]