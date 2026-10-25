"""
NYRIX ERP Core System - Database Engine & Session Management
Copyright (c) 2026 Salaheddine CHIKHI / AVYR Digital. All Rights Reserved.
Proprietary and confidential.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
    elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    
    # Clean query params for psycopg2 driver compatibility
    if "channel_binding=" in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("channel_binding=require&", "").replace("&channel_binding=require", "").replace("channel_binding=require", "")
        if DATABASE_URL.endswith("?"):
            DATABASE_URL = DATABASE_URL[:-1]
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20
    )
else:
    # SQLite fallback for local dev
    DATABASE_URL = "sqlite:///./nyrix_dev.db"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
