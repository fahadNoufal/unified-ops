"""
EMAIL SYNC SCHEDULER
Automatically sync emails from connected accounts every 5 minutes

HOW TO RUN:
1. As a cron job: */5 * * * * python -m app.jobs.email_sync
2. As APScheduler (add to main.py)
3. As Celery task
"""

from datetime import datetime, timedelta
from app.core.database import SessionLocal
from app.models.models import EmailConnection
from app.services.email_integration_service import email_integration_service


async def sync_all_email_accounts():
    """
    Sync emails for all active email connections
    Run this every 5 minutes
    """
    db = SessionLocal()
    
    try:
        # Get all active email connections
        connections = db.query(EmailConnection).filter(
            EmailConnection.is_active == True
        ).all()
        
        print(f"\n{'='*50}")
        print(f"EMAIL SYNC JOB STARTED: {datetime.utcnow()}")
        print(f"Found {len(connections)} active email connections")
        print(f"{'='*50}\n")
        
        for connection in connections:
            try:
                print(f"📧 Syncing emails for {connection.email} (workspace {connection.workspace_id})")
                
                # Fetch emails from last sync or last 24 hours
                since_date = connection.last_sync_at or (datetime.utcnow() - timedelta(hours=24))
                
                count = email_integration_service.fetch_new_emails(
                    db=db,
                    connection=connection,
                    since_date=since_date
                )
                
                print(f"✅ Synced {count} new emails for {connection.email}\n")
                
            except Exception as e:
                print(f"❌ Failed to sync {connection.email}: {str(e)}\n")
                continue
        
        print(f"{'='*50}")
        print(f"EMAIL SYNC JOB COMPLETED: {datetime.utcnow()}")
        print(f"{'='*50}\n")
        
    except Exception as e:
        print(f"❌ Email sync job failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


# If running as a script
if __name__ == "__main__":
    import asyncio
    asyncio.run(sync_all_email_accounts())


# ========== ADD TO main.py FOR AUTOMATIC SCHEDULING ==========

"""
# Option 1: Using APScheduler (Recommended)

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.jobs.email_sync import sync_all_email_accounts

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def start_email_sync():
    # Sync emails every 5 minutes
    scheduler.add_job(
        sync_all_email_accounts,
        'interval',
        minutes=5,
        id='email_sync'
    )
    scheduler.start()
    print("✅ Email sync scheduler started")

@app.on_event("shutdown")
async def shutdown_scheduler():
    scheduler.shutdown()


# Option 2: Using Cron (Add to crontab)

# Run every 5 minutes
*/5 * * * * cd /path/to/app && python -m app.jobs.email_sync >> /var/log/email_sync.log 2>&1
"""