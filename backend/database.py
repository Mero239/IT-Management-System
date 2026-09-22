from datetime import timezone
from sqlalchemy import create_engine, DateTime, TypeDecorator
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from paths import data_path

SQLALCHEMY_DATABASE_URL = f"sqlite:///{data_path('it_management.db')}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class UTCDateTime(TypeDecorator):
    """SQLite has no real timezone-aware storage — a plain DateTime(timezone=True)
    column round-trips as a naive datetime, which FastAPI/Pydantic then
    serializes with no UTC suffix (e.g. "2026-09-22T08:19:00"). Browsers
    parse a timezone-less ISO string as LOCAL time, so every timestamp in
    the app displayed several hours off from the real time depending on the
    viewer's timezone. Every value this app writes to a DateTime column is
    already UTC (the server clock itself is UTC) — this just makes that
    explicit on the way out, so the JSON carries a "+00:00" and the browser
    converts it correctly."""
    impl = DateTime
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
