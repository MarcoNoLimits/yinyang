import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if it exists in the current working directory
load_dotenv()

# Also load .env file relative to this config file
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

# OpenRouter Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "sk-or-v1-mock-key-for-testing")
OPENROUTER_URL = os.getenv("OPENROUTER_URL", "https://openrouter.ai/api/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "deepseek/deepseek-v4-flash")

# Database Configuration (PostgreSQL/Supabase)
# Fallback to a default local postgres url for testing or local run
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"
)

# Redis Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

