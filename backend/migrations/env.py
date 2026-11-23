import os
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import make_url

from models import Report


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Find backend/.env regardless of the current working directory.
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

migration_url = os.getenv("MIGRATION_DATABASE_URL")

if not migration_url:
    raise RuntimeError(
        "MIGRATION_DATABASE_URL is missing from backend/.env"
    )

connection_url = make_url(migration_url)

if connection_url.drivername not in (
    "postgres",
    "postgresql",
    "postgresql+psycopg",
):
    raise RuntimeError(
        "MIGRATION_DATABASE_URL must be a PostgreSQL URL."
    )

connection_url = connection_url.set(
    drivername="postgresql+psycopg"
)

# Importing Report registers its table in this metadata.
target_metadata = Report.metadata


def run_migrations_offline():
    """Generate SQL without connecting to the database."""
    context.configure(
        url=connection_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations using a direct database connection."""
    connectable = create_engine(
        connection_url,
        poolclass=pool.NullPool,
        connect_args={"connect_timeout": 10},
    )

    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()