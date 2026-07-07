import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load .env from project root (works whether uvicorn is run from root or /backend)
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Create a .env file at the project root — see .env.example."
    )

# PostgreSQL: no connect_args needed (check_same_thread is SQLite-only)
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,       # Detect stale connections & reconnect automatically
    pool_size=10,             # Keep 10 connections ready (was 5)
    max_overflow=20,          # Allow up to 20 extra connections under burst load
    pool_recycle=1800,        # Recycle connections every 30 min to avoid Supabase timeouts
    pool_timeout=30,          # Give up after 30s if no connection available
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
