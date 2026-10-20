from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")

    APP_NAME: str = "SkillDrone Diagnostic Training Platform"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./skilldrone.db")
    CORS_ORIGINS: List[str] = ["*"]
    DEMO_AUTH_TOKEN: str = "skilldrone-trainer-demo-key"
    MAX_TELEMETRY_PAYLOAD_BYTES: int = 65536
    SIMULATION_TICK_RATE_HZ: float = 2.0
    
    # Educational disclaimer
    OCCUPATIONAL_SAFETY_DISCLAIMER: str = (
        "EDUCATIONAL USE ONLY: Sensor thresholds and models in SkillDrone are designed for "
        "vocational diagnostic assessment and simulated training. They are not certified for life-critical "
        "industrial safety compliance."
    )

settings = Settings()
