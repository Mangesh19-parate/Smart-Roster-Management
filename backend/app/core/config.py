from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql://test:test@localhost:5432/test",
        validation_alias="DATABASE_URL",
    )
    supabase_url: str = Field(
        default="http://localhost:54321",
        validation_alias="SUPABASE_URL",
    )
    supabase_service_role_key: str = Field(
        default="test-key",
        validation_alias="SUPABASE_SERVICE_ROLE_KEY",
    )
    supabase_jwt_secret: str | None = Field(default=None, validation_alias="SUPABASE_JWT_SECRET")
    cors_origins: str = Field(default="http://localhost:5173", validation_alias="CORS_ORIGINS")
    demo_mode: bool = Field(default=True, validation_alias="DEMO_MODE")
    demo_reset_token: str | None = Field(default=None, validation_alias="DEMO_RESET_TOKEN")
    solver_time_limit_s: int = Field(default=15, validation_alias="SOLVER_TIME_LIMIT_S")
    solver_seed: int = Field(default=1, validation_alias="SOLVER_SEED")
    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    anthropic_model: str | None = Field(default=None, validation_alias="ANTHROPIC_MODEL")
    ai_explanations_enabled: bool = Field(default=False, validation_alias="AI_EXPLANATIONS_ENABLED")
    seed_month: str = Field(default="2026-12", validation_alias="SEED_MONTH")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
