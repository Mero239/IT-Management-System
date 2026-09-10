from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from paths import data_path

SQLALCHEMY_DATABASE_URL = f"sqlite:///{data_path('it_management.db')}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
