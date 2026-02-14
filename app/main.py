from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.jobs.email_reminder_job import run_email_reminder_job
from app.core.config import settings
from app.core.database import init_db
from app.api.endpoints import router
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["*"],  # Allow all for demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(router, prefix=settings.API_PREFIX)


scheduler = AsyncIOScheduler()


@app.on_event("shutdown")
async def shutdown_scheduler():
    scheduler.shutdown()

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized!")
    
    scheduler.add_job(
        run_email_reminder_job,
        'interval',
        hours=1,  # Run every hour
        id='email_reminders'
    )
    scheduler.start()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Unified Operations Platform API",
        "version": settings.APP_VERSION,
        "docs": "/api/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
