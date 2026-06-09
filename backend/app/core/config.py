import os
from typing import List, Union
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Gestor de Negócio SaaS"
    
    # JWT Security
    # In production, this MUST be changed to a secure secret key
    SECRET_KEY: str = "super-secret-key-that-must-be-changed-in-production-1234567890"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./gestor.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    USE_REDIS: bool = False  # Set to True if Redis is active
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://gestor-negocio.vercel.app"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="allow"
    )


settings = Settings()
