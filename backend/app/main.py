import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.seed_data import init_db_data

from app.routers import (
    health,
    dashboard,
    trainees,
    missions,
    sessions,
    telemetry,
    hazards,
    assessments,
    replay,
    hardware,
    config_router,
    vision
)

from sqlalchemy import inspect, text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skilldrone")

def run_migrations(engine):
    try:
        inspector = inspect(engine)
        if "hazard_events" in inspector.get_table_names():
            columns = [col["name"] for col in inspector.get_columns("hazard_events")]
            with engine.connect() as conn:
                if "associated_object_id" not in columns:
                    conn.execute(text("ALTER TABLE hazard_events ADD COLUMN associated_object_id VARCHAR(64)"))
                    conn.commit()
                if "visual_evidence_frame_id" not in columns:
                    conn.execute(text("ALTER TABLE hazard_events ADD COLUMN visual_evidence_frame_id VARCHAR(36)"))
                    conn.commit()
    except Exception as e:
        logger.warning(f"Database migration notice: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables created and seed data loaded
    logger.info("Initializing SkillDrone database schema...")
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    db = SessionLocal()
    try:
        init_db_data(db)
        logger.info("SkillDrone database initialized with seed missions and trainees.")
    finally:
        db.close()
    yield
    # Shutdown
    logger.info("SkillDrone backend shutting down.")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Intelligent Drone-Based Diagnostic Training and Competency Assessment Platform API. "
        "Provides simulated and real telemetry ingestion, deterministic physics scenarios, "
        "hazard event detection, adaptive reinspection, and vocational competency scoring."
    ),
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health.router)
app.include_router(dashboard.router)
app.include_router(trainees.router)
app.include_router(missions.router)
app.include_router(sessions.router)
app.include_router(telemetry.router)
app.include_router(hazards.router)
app.include_router(assessments.router)
app.include_router(replay.router)
app.include_router(hardware.router)
app.include_router(config_router.router)
app.include_router(vision.router)

@app.get("/")
def root_index():
    return {
        "platform": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "health_check": "/api/health",
        "disclaimer": settings.OCCUPATIONAL_SAFETY_DISCLAIMER
    }
