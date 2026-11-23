import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# Read the .env file next to this Python file.
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise RuntimeError("DATABASE_URL is missing from backend/.env")

# Use the psycopg driver while preserving Neon URL parameters.
connection_url = make_url(database_url)

if connection_url.drivername not in (
    "postgres",
    "postgresql",
    "postgresql+psycopg",
):
    raise RuntimeError("DATABASE_URL must be a PostgreSQL connection URL.")

connection_url = connection_url.set(
    drivername="postgresql+psycopg"
)

engine = create_engine(
    connection_url,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=2,
    connect_args={"connect_timeout": 10},
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    with SessionLocal() as session:
        yield session