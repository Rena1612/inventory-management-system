from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["dev", "staging", "production"]

# Substrings that mean someone shipped the example file instead of generating a
# real secret. Compared case-insensitively.
PLACEHOLDER_MARKERS = ("change-me", "changeme", "change_me", "placeholder", "your-secret", "xxx")

MIN_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Fail closed: an unset ENVIRONMENT is treated as production, so forgetting
    # to set it cannot silently disable the secret guards below. Local work
    # opts in explicitly with ENVIRONMENT=dev.
    environment: Environment = "production"

    database_url: str
    jwt_secret: str = Field(min_length=MIN_SECRET_LENGTH)
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60 * 24 * 7

    # localhost and 127.0.0.1 are distinct origins to the browser.
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    pool_min_size: int = 2
    pool_max_size: int = 10
    sql_echo: bool = False

    @model_validator(mode="after")
    def refuse_placeholder_secret_outside_dev(self) -> Settings:
        """A copied .env.example must not be able to boot a real instance.

        Dev is opted into explicitly, so reaching this guard always means
        ENVIRONMENT was deliberately left unset or set to staging/production.
        """
        if self.environment == "dev":
            return self

        lowered = self.jwt_secret.lower()
        if any(marker in lowered for marker in PLACEHOLDER_MARKERS):
            raise ValueError(
                "JWT_SECRET still looks like the example placeholder. "
                "Generate a real one, e.g. "
                "python -c 'import secrets; print(secrets.token_urlsafe(48))'. "
                "For local work set ENVIRONMENT=dev in backend/.env."
            )
        return self

    @property
    def is_dev(self) -> bool:
        return self.environment == "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]