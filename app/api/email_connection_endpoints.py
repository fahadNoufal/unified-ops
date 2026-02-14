"""
EMAIL CONNECTION ENDPOINTS
New file: app/api/email_connection_endpoints.py

Add to __init__.py:
from app.api.email_connection_endpoints import router as email_connection_router
app.include_router(email_connection_router, prefix="/api", tags=["email-connection"])
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.models.models import EmailConnection, User, Workspace
from app.core.auth import get_current_user
from app.services.email_integration_service import email_integration_service


router = APIRouter()


# ========== SCHEMAS ==========

class EmailConnectionCreate(BaseModel):
    provider: str  # 'gmail' or 'outlook'
    email: EmailStr
    password: str
    imap_host: str
    imap_port: int
    smtp_host: str
    smtp_port: int
    is_active: bool = True


class EmailConnectionResponse(BaseModel):
    id: int
    workspace_id: int
    provider: str
    email: str
    imap_host: str
    imap_port: int
    smtp_host: str
    smtp_port: int
    is_active: bool
    last_sync_at: Optional[datetime]
    sync_status: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class EmailConnectionTest(BaseModel):
    provider: str
    email: EmailStr
    password: str
    imap_host: str
    imap_port: int
    smtp_host: str
    smtp_port: int


# ========== ENDPOINTS ==========

@router.get("/email-connection", response_model=EmailConnectionResponse)
async def get_email_connection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current email connection settings"""
    connection = db.query(EmailConnection).filter(
        EmailConnection.workspace_id == current_user.workspace_id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="No email connection configured")
    
    return connection


@router.post("/email-connection/test")
async def test_email_connection(
    data: EmailConnectionTest,
    current_user: User = Depends(get_current_user)
):
    """Test email connection without saving"""
    result = email_integration_service.test_connection(
        email_address=data.email,
        password=data.password,
        imap_host=data.imap_host,
        imap_port=data.imap_port,
        smtp_host=data.smtp_host,
        smtp_port=data.smtp_port
    )
    
    return result


@router.post("/email-connection", response_model=EmailConnectionResponse)
async def save_email_connection(
    data: EmailConnectionCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save or update email connection"""
    
    # Test connection first
    test_result = email_integration_service.test_connection(
        email_address=data.email,
        password=data.password,
        imap_host=data.imap_host,
        imap_port=data.imap_port,
        smtp_host=data.smtp_host,
        smtp_port=data.smtp_port
    )
    
    if not test_result['success']:
        raise HTTPException(
            status_code=400,
            detail=test_result.get('error', 'Connection test failed')
        )
    
    # Check if connection exists
    connection = db.query(EmailConnection).filter(
        EmailConnection.workspace_id == current_user.workspace_id
    ).first()
    
    if connection:
        # Update existing
        connection.provider = data.provider
        connection.email = data.email
        connection.password = data.password  # Should be encrypted in production
        connection.imap_host = data.imap_host
        connection.imap_port = data.imap_port
        connection.smtp_host = data.smtp_host
        connection.smtp_port = data.smtp_port
        connection.is_active = data.is_active
    else:
        # Create new
        connection = EmailConnection(
            workspace_id=current_user.workspace_id,
            provider=data.provider,
            email=data.email,
            password=data.password,  # Should be encrypted in production
            imap_host=data.imap_host,
            imap_port=data.imap_port,
            smtp_host=data.smtp_host,
            smtp_port=data.smtp_port,
            is_active=data.is_active
        )
        db.add(connection)
    
    db.commit()
    db.refresh(connection)
    
    # Trigger initial sync in background
    if connection.is_active:
        background_tasks.add_task(
            sync_emails_background,
            workspace_id=current_user.workspace_id
        )
    
    return connection


@router.delete("/email-connection")
async def disconnect_email(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect email account"""
    connection = db.query(EmailConnection).filter(
        EmailConnection.workspace_id == current_user.workspace_id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="No connection to disconnect")
    
    db.delete(connection)
    db.commit()
    
    return {"success": True, "message": "Email disconnected"}


@router.post("/email-connection/sync")
async def sync_emails_now(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger immediate email sync"""
    connection = db.query(EmailConnection).filter(
        EmailConnection.workspace_id == current_user.workspace_id,
        EmailConnection.is_active == True
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="No active email connection")
    
    # Add sync task to background
    background_tasks.add_task(
        sync_emails_background,
        workspace_id=current_user.workspace_id
    )
    
    return {"success": True, "message": "Email sync started"}


# ========== BACKGROUND TASKS ==========

def sync_emails_background(workspace_id: int):
    """Background task to sync emails"""
    from app.core.database import SessionLocal
    db = SessionLocal()
    
    try:
        connection = db.query(EmailConnection).filter(
            EmailConnection.workspace_id == workspace_id,
            EmailConnection.is_active == True
        ).first()
        
        if not connection:
            return
        
        # Fetch new emails
        count = email_integration_service.fetch_new_emails(db, connection)
        print(f"✅ Synced {count} new emails for workspace {workspace_id}")
        
    except Exception as e:
        print(f"❌ Email sync failed: {str(e)}")
    finally:
        db.close()