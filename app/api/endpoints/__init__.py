"""
Comprehensive API Endpoints for Unified Operations Platform
All routes in one file for simplicity
"""
from app.api import analytics_operations
from app.api import public_chat 
from app.api import agent_config  # At top

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from app.services.email_service import email_service
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import secrets
import string
import os

from app.core.database import get_db
from app.core.auth import (
    get_current_user, get_current_owner, get_password_hash,
    verify_password, create_access_token
)
from app.models.models import (
    User, UserRole, Workspace, Contact, Service, Booking, BookingStatus,
    FormTemplate, FormType, FormSubmission, FormSubmissionStatus,
    InventoryItem, InventoryType, InventoryTransaction, EmailTemplate,
    EmailTemplateType, Message, MessageChannel, Conversation,
    LeadTracking, AutomationRule, ServiceFormLink, ServiceInventoryLink,
    AuditLog
)
from app.schemas.schemas import *
from app.services.automation_service import automation_service
from app.services.dummy_data import DummyDataGenerator
from app.core.config import settings

router = APIRouter()

router.include_router(analytics_operations.router, tags=["analytics"])
router.include_router(public_chat.router, tags=["public-chat"])
router.include_router(agent_config.router, tags=["agent-config"])  # With other routers

# ========== AUTH ENDPOINTS ==========

@router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register new user and create workspace"""
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    slug = user_data.email.split("@")[0] + "-" + secrets.token_hex(4)
    
    workspace = Workspace(
        name=f"{user_data.full_name}'s Business",
        slug=slug,
        contact_email=user_data.email,
        timezone="UTC"
    )
    db.add(workspace)
    db.flush()
    
    username = user_data.email.split("@")[0]
    user = User(
        email=user_data.email,
        username=username,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=UserRole.OWNER,
        workspace_id=workspace.id,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    access_token = create_access_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "workspace_id": user.workspace_id
        }
    }

@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Login user with username or email"""
    # Try to find user by username OR email
    user = db.query(User).filter(
        or_(
            User.username == credentials.username,
            User.email == credentials.username  # Allow email as username
        )
    ).first()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    
    access_token = create_access_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "workspace_id": user.workspace_id,
            "must_change_password": user.must_change_password
        }
    }

@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user

# ========== WORKSPACE ENDPOINTS ==========

@router.post("/onboarding")
async def complete_onboarding(
    data: OnboardingData,
    db: Session = Depends(get_db)
):
    # Create workspace
    workspace = Workspace(
        name=data.businessName,
        industry=data.industry,
        rag_content=data.rag_content if data.enableAI else None,
        gemini_api_key=data.geminiApiKey if data.enableAI else None,
        # ... other fields
    )
    
    # If AI enabled and has RAG content, create vector store
    if data.enableAI and data.rag_content:
        from app.agents.rag_service import rag_service
        api_key = data.geminiApiKey or os.getenv('GEMINI_API_KEY')
        if api_key:
            rag_service.create_vector_store(
                workspace_id=workspace.id,
                business_content=data.rag_content,
                api_key=api_key
            )
    
    return {"success": True, "workspace_id": workspace.id}

@router.get("/workspaces/me", response_model=WorkspaceResponse)
async def get_workspace(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current workspace"""
    workspace = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace

@router.put("/workspaces/me", response_model=WorkspaceResponse)
async def update_workspace(
    data: WorkspaceUpdate,
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Update workspace"""
    workspace = db.query(Workspace).filter(
        Workspace.id == current_user.workspace_id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Update all provided fields
    for key, value in data.dict(exclude_unset=True).items():
        setattr(workspace, key, value)
    
    # If rag_content provided and gemini_api_key exists, create vector store
    if data.rag_content and (data.gemini_api_key or workspace.gemini_api_key):
        try:
            from app.agents.rag_service import rag_service
            import os
            
            api_key = data.gemini_api_key or workspace.gemini_api_key or os.getenv('GEMINI_API_KEY')
            if api_key:
                rag_service.create_vector_store(
                    workspace_id=workspace.id,
                    business_content=data.rag_content,
                    api_key=api_key
                )
                print(f"✓ Created vector store for workspace {workspace.id}")
        except Exception as e:
            print(f"⚠️ Failed to create vector store: {str(e)}")
    
    db.commit()
    db.refresh(workspace)
    print(workspace.email_api_key)
    return workspace


@router.put("/workspace", response_model=WorkspaceResponse)
async def update_workspace(
    data: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = db.query(Workspace).filter(
        Workspace.id == current_user.workspace_id
    ).first()
    
    # This should handle email_api_key automatically
    for key, value in data.dict(exclude_unset=True).items():
        setattr(workspace, key, value)
    
    db.commit()
    db.refresh(workspace)
    return workspace


@router.post("/workspaces/activate")
async def activate_workspace(
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Activate workspace"""
    workspace = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    
    has_service = db.query(Service).filter(Service.workspace_id == workspace.id).first()
    if not has_service:
        raise HTTPException(status_code=400, detail="At least one service required")
    
    has_forms = db.query(FormTemplate).filter(FormTemplate.workspace_id == workspace.id).first()
    if not has_forms:
        generator = DummyDataGenerator(workspace.id)
        generator.generate_form_templates(db)
    
    workspace.is_active = True
    workspace.onboarding_completed = True
    db.commit()
    
    
    return {"message": "Workspace activated and default forms created"}

@router.post("/workspaces/generate-dummy-data")
async def generate_dummy_data(
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Generate demo data"""
    workspace = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    
    if workspace.has_dummy_data:
        raise HTTPException(status_code=400, detail="Dummy data already generated")
    
    generator = DummyDataGenerator(workspace.id)
    result = generator.generate_all(db)
    
    workspace.has_dummy_data = True
    db.commit()
    
    return {"message": "Dummy data generated", "stats": result}

@router.post("/workspaces/test-email")
async def test_email(
    data: EmailTestRequest,
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Send test email"""
    workspace = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    success = await email_service.send_test_email(data.test_email, workspace.name)
    
    if success:
        return {"message": "Test email sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send test email")

# ========== DASHBOARD ENDPOINTS ==========

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard data"""
    wid = current_user.workspace_id
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    today_bookings = db.query(Booking).filter(
        Booking.workspace_id == wid,
        Booking.start_time >= today_start,
        Booking.start_time < today_end
    ).count()
    
    upcoming_bookings = db.query(Booking).filter(
        Booking.workspace_id == wid,
        Booking.start_time >= today_end,
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
    ).count()
    
    completed = db.query(Booking).filter(
        Booking.workspace_id == wid,
        Booking.status == BookingStatus.COMPLETED
    ).count()
    
    no_show = db.query(Booking).filter(
        Booking.workspace_id == wid,
        Booking.status == BookingStatus.NO_SHOW
    ).count()
    
    new_inquiries = db.query(Conversation).join(Contact).filter(
        Contact.workspace_id == wid,
        Conversation.unread_count > 0
    ).count()
    
    ongoing = db.query(Conversation).join(Contact).filter(
        Contact.workspace_id == wid,
        Conversation.is_active == True
    ).count()
    
    pending_forms = db.query(FormSubmission).join(Contact).filter(
        Contact.workspace_id == wid,
        FormSubmission.status == FormSubmissionStatus.PENDING
    ).count()
    
    overdue_forms = db.query(FormSubmission).join(Contact).filter(
        Contact.workspace_id == wid,
        FormSubmission.status == FormSubmissionStatus.PENDING,
        FormSubmission.sent_at < datetime.utcnow() - timedelta(hours=48)
    ).count()
    
    completed_forms = db.query(FormSubmission).join(Contact).filter(
        Contact.workspace_id == wid,
        FormSubmission.status == FormSubmissionStatus.COMPLETED
    ).count()
    
    low_stock = db.query(InventoryItem).filter(
        InventoryItem.workspace_id == wid,
        InventoryItem.current_stock <= InventoryItem.threshold
    ).count()
    
    total_contacts = db.query(Contact).filter(Contact.workspace_id == wid).count()
    
    today_list = db.query(Booking).join(Contact).join(Service).filter(
        Booking.workspace_id == wid,
        Booking.start_time >= today_start,
        Booking.start_time < today_end
    ).order_by(Booking.start_time).limit(10).all()
    
    today_data = [{
        "id": b.id,
        "contact_name": b.contact.name,
        "service_name": b.service.name,
        "start_time": b.start_time,
        "status": b.status.value
    } for b in today_list]
    
    upcoming_list = db.query(Booking).join(Contact).join(Service).filter(
        Booking.workspace_id == wid,
        Booking.start_time >= today_end,
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
    ).order_by(Booking.start_time).limit(10).all()
    
    upcoming_data = [{
        "id": b.id,
        "contact_name": b.contact.name,
        "service_name": b.service.name,
        "start_time": b.start_time,
        "status": b.status.value
    } for b in upcoming_list]
    
    low_stock_list = db.query(InventoryItem).filter(
        InventoryItem.workspace_id == wid,
        InventoryItem.current_stock <= InventoryItem.threshold
    ).all()
    
    low_stock_data = [{
        "id": item.id,
        "name": item.name,
        "current_stock": item.current_stock,
        "threshold": item.threshold,
        "unit": item.unit or "pcs",
        "is_below_threshold": True
    } for item in low_stock_list]
    
    return {
        "stats": {
            "today_bookings": today_bookings,
            "upcoming_bookings": upcoming_bookings,
            "completed_bookings": completed,
            "no_show_bookings": no_show,
            "new_inquiries": new_inquiries,
            "ongoing_conversations": ongoing,
            "unanswered_messages": new_inquiries,
            "pending_forms": pending_forms,
            "overdue_forms": overdue_forms,
            "completed_forms": completed_forms,
            "low_stock_items": low_stock,
            "total_contacts": total_contacts
        },
        "today_bookings": today_data,
        "upcoming_bookings": upcoming_data,
        "low_stock_items": low_stock_data
    }

# ========== CONTACT ENDPOINTS ==========

@router.get("/contacts", response_model=List[ContactResponse])
async def list_contacts(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List contacts"""
    contacts = db.query(Contact).filter(
        Contact.workspace_id == current_user.workspace_id
    ).order_by(Contact.created_at.desc()).offset(skip).limit(limit).all()
    return contacts

@router.post("/contacts", response_model=ContactResponse)
async def create_contact(
    contact_data: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new contact/lead manually
    
    This is used when business users manually add a lead from the Leads page.
    The lead will appear in the "Pending" status until they book an appointment.
    
    - **name**: Contact's full name (required)
    - **email**: Contact's email address (required, must be unique per workspace)
    - **phone**: Contact's phone number (optional)
    - **source**: Where the lead came from (defaults to "manual")
    - **notes**: Any additional notes about the contact (optional)
    """
    
    # Check if contact with this email already exists in this workspace
    existing_contact = db.query(Contact).filter(
        Contact.workspace_id == current_user.workspace_id,
        Contact.email == contact_data.email
    ).first()
    
    workspace = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    
    if existing_contact:
        raise HTTPException(
            status_code=400,
            detail=f"A contact with email '{contact_data.email}' already exists in your workspace"
        )
    
    # Create the new contact
    new_contact = Contact(
        workspace_id=current_user.workspace_id,
        name=contact_data.name,
        email=contact_data.email,
        phone=contact_data.phone,
        source=contact_data.source or "manual",
        notes=contact_data.notes
    )
    
    db.add(new_contact)
    db.flush()  # Flush to get the ID
    
    existing_conversation = db.query(Conversation).filter(
        Conversation.contact_id == new_contact.id
    ).first()
    
    if not existing_conversation:
        print(f"📧 Creating conversation for contact {new_contact.id}")
        conversation = Conversation(
            contact_id=new_contact.id,
            last_message_at=datetime.utcnow(),
            unread_count=0,
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(conversation)
    db.commit()
    db.refresh(new_contact)
    # ==============================================
    
    try:
        
        await email_service.send_welcome_email(
            db=db,
            contact=new_contact,
            workspace=workspace
        )
        print("Welcome email sent successfully")
    except Exception as e:
        print(f"Failed to send welcome email: {e}")
    
    # # Create a conversation for this contact
    # conversation = Conversation(
    #     contact_id=new_contact.id
    # )
    # db.add(conversation)
    
    # Create lead tracking entry (optional - if you have this model)
    try:
        tracking = LeadTracking(
            contact_id=new_contact.id,
            status="pending"
        )
        db.add(tracking)
    except Exception as e:
        # If LeadTracking model doesn't exist, skip this
        print(f"Lead tracking not created: {e}")
    
    # Commit all changes
    db.commit()
    db.refresh(new_contact)
    
    return new_contact

@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get contact"""
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.workspace_id == current_user.workspace_id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

# ========== SERVICE ENDPOINTS ==========

@router.get("/services", response_model=List[ServiceResponse])
async def list_services(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List services"""
    services = db.query(Service).filter(
        Service.workspace_id == current_user.workspace_id
    ).all()
    return services

@router.post("/services", response_model=ServiceResponse)
async def create_service(
    data: ServiceCreate,
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Create service"""
    service = Service(workspace_id=current_user.workspace_id, **data.dict())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service

@router.get("/services/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get service"""
    service = db.query(Service).filter(
        Service.id == service_id,
        Service.workspace_id == current_user.workspace_id
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@router.put("/services/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: int,
    data: ServiceUpdate,
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Update service"""
    service = db.query(Service).filter(
        Service.id == service_id,
        Service.workspace_id == current_user.workspace_id
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    for key, value in data.dict(exclude_unset=True).items():
        setattr(service, key, value)
    
    db.commit()
    db.refresh(service)
    return service

# ========== BOOKING ENDPOINTS ==========

@router.get("/bookings", response_model=List[BookingDetailResponse])
async def list_bookings(
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List bookings"""
    query = db.query(Booking).filter(Booking.workspace_id == current_user.workspace_id)
    
    if status:
        query = query.filter(Booking.status == status)
    if start_date:
        query = query.filter(Booking.start_time >= start_date)
    if end_date:
        query = query.filter(Booking.start_time <= end_date)
    
    bookings = query.order_by(Booking.start_time).offset(skip).limit(limit).all()
    return bookings

@router.post("/bookings", response_model=BookingResponse)
async def create_booking(
    data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create booking"""
    service = db.query(Service).filter(
        Service.id == data.service_id,
        Service.workspace_id == current_user.workspace_id
    ).first()
    workspace = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    contact_id = None
    
    if not contact_id and data.contact_email:
        # Look up contact by email (primary key within workspace)
        contact = db.query(Contact).filter(
            Contact.workspace_id == current_user.workspace_id,
            Contact.email == data.contact_email
        ).first()
        
        if contact:
            # Contact exists - UPDATE with latest info (latest wins)
            if data.contact_name:
                contact.name = data.contact_name
            if data.contact_phone:
                contact.phone = data.contact_phone
            contact.updated_at = datetime.utcnow()
            contact_id = contact.id
        else:
            # Create new contact
            contact = Contact(
                workspace_id=current_user.workspace_id,
                name=data.contact_name or "Customer",
                email=data.contact_email,
                phone=data.contact_phone,
                source="booking"
            )
            db.add(contact)
            db.flush()
            contact_id = contact.id
            
    end_time = data.start_time + timedelta(minutes=service.duration_minutes)
    
    # 2. This pushes the contact to Postgres and populates new_contact.id
    db.flush() 

    # 3. Use that generated ID for the booking
    booking = Booking(
        workspace_id=current_user.workspace_id,
        contact_id=contact_id,
        service_id=data.service_id,
        start_time=data.start_time,
        end_time=end_time,
        notes=data.notes,
        status=BookingStatus.CONFIRMED
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    
    try:
        await email_service.send_booking_confirmation(
            db=db,
            booking=booking,
            contact=contact,
            workspace=workspace                
        )
        
        print('email send----->>>>')
    except Exception as e:
        print(f"Failed to send booking confirmation: {e}")
    
    await automation_service.trigger_booking_created(db, booking)
    
    return booking

@router.get("/bookings/{booking_id}", response_model=BookingDetailResponse)
async def get_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get booking"""
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.workspace_id == current_user.workspace_id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

@router.put("/bookings/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: int,
    data: BookingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update booking"""
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.workspace_id == current_user.workspace_id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    for key, value in data.dict(exclude_unset=True).items():
        setattr(booking, key, value)
    
    db.commit()
    db.refresh(booking)
    return booking

# Continuing...

# ========== FORM ENDPOINTS ==========

@router.get("/forms", response_model=List[FormTemplateResponse])
async def list_forms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List form templates"""
    forms = db.query(FormTemplate).filter(
        FormTemplate.workspace_id == current_user.workspace_id
    ).all()
    return forms

@router.post("/forms", response_model=FormTemplateResponse)
async def create_form(
    data: FormTemplateCreate,
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Create form template"""
    form = FormTemplate(
        workspace_id=current_user.workspace_id,
        name=data.name,
        form_type=FormType(data.form_type),
        description=data.description,
        fields=[field.dict() for field in data.fields],
        is_active=True
    )
    db.add(form)
    db.commit()
    db.refresh(form)
    return form

@router.get("/forms/{form_id}", response_model=FormTemplateResponse)
async def get_form(
    form_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get form template"""
    form = db.query(FormTemplate).filter(
        FormTemplate.id == form_id,
        FormTemplate.workspace_id == current_user.workspace_id
    ).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form

@router.put("/forms/{form_id}", response_model=FormTemplateResponse)
async def update_form(
    form_id: int,
    data: FormTemplateUpdate,
    current_user: User = Depends(get_current_owner),  # Only owners can edit forms
    db: Session = Depends(get_db)
):
    """Update form template"""
    # Find the form and ensure it belongs to the user's workspace
    form = db.query(FormTemplate).filter(
        FormTemplate.id == form_id,
        FormTemplate.workspace_id == current_user.workspace_id
    ).first()
    
    if not form:
        raise HTTPException(status_code=404, detail="Form template not found")
    
    # Update fields from the request
    update_data = data.dict(exclude_unset=True)
    
    # Special handling for fields array - convert Pydantic models to dicts for JSON storage
    if "fields" in update_data:
        update_data["fields"] = [
            field if isinstance(field, dict) else field.dict() 
            for field in update_data["fields"]
        ]
    
    # Apply all updates
    for key, value in update_data.items():
        setattr(form, key, value)
    
    db.commit()
    db.refresh(form)
    return form

@router.get("/form-submissions", response_model=List[FormSubmissionResponse])
async def list_form_submissions(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List form submissions"""
    query = db.query(FormSubmission).join(Contact).filter(
        Contact.workspace_id == current_user.workspace_id
    )
    
    if status:
        query = query.filter(FormSubmission.status == status)
    
    submissions = query.order_by(FormSubmission.created_at.desc()).all()
    return submissions

# ========== INVENTORY ENDPOINTS ==========

@router.get("/inventory", response_model=List[InventoryItemResponse])
async def list_inventory(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List inventory items"""
    items = db.query(InventoryItem).filter(
        InventoryItem.workspace_id == current_user.workspace_id
    ).order_by(InventoryItem.name).all()
    return items

@router.post("/inventory", response_model=InventoryItemResponse)
async def create_inventory_item(
    data: InventoryItemCreate,
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Create inventory item"""
    item = InventoryItem(
        workspace_id=current_user.workspace_id,
        name=data.name,
        description=data.description,
        current_stock=data.current_stock,
        threshold=data.threshold,
        inventory_type=InventoryType(data.inventory_type),
        supplier_email=data.supplier_email,
        unit=data.unit,
        is_active=True
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.get("/inventory/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get inventory item"""
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.workspace_id == current_user.workspace_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.put("/inventory/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: int,
    data: InventoryItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update inventory item"""
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.workspace_id == current_user.workspace_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in data.dict(exclude_unset=True).items():
        setattr(item, key, value)
    
    db.commit()
    db.refresh(item)
    return item

@router.post("/inventory/transactions")
async def create_inventory_transaction(
    data: InventoryTransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create inventory transaction"""
    item = db.query(InventoryItem).filter(
        InventoryItem.id == data.inventory_item_id,
        InventoryItem.workspace_id == current_user.workspace_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    transaction = InventoryTransaction(
        inventory_item_id=item.id,
        quantity_change=data.quantity_change,
        transaction_type=data.transaction_type,
        notes=data.notes
    )
    db.add(transaction)
    
    item.current_stock += data.quantity_change
    
    db.commit()
    
    return {"message": "Transaction recorded", "new_stock": item.current_stock}

# ========== INBOX/MESSAGE ENDPOINTS ==========

@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List conversations"""
    conversations = db.query(Conversation).join(Contact).filter(
        Contact.workspace_id == current_user.workspace_id
    ).order_by(Conversation.last_message_at.desc()).all()
    return conversations

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get conversation with messages"""
    conversation = db.query(Conversation).join(Contact).filter(
        Conversation.id == conversation_id,
        Contact.workspace_id == current_user.workspace_id
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation.unread_count = 0
    db.commit()
    
    return conversation

@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: int,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send message in conversation"""
    conversation = db.query(Conversation).join(Contact).filter(
        Conversation.id == conversation_id,
        Contact.workspace_id == current_user.workspace_id
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        content=data.content,
        channel=MessageChannel(data.channel),
        is_from_customer=False,
        is_automated=False
    )
    db.add(message)
    
    conversation.last_message_at = datetime.utcnow()
    
    db.commit()
    db.refresh(message)
    
    # Send actual email/SMS if needed
    contact = conversation.contact
    if data.channel == "email" and contact.email:
        await email_service.send_email(
            to_email=contact.email,
            subject=f"Message from {current_user.workspace.name}",
            html_body=data.content,
            workspace=current_user.workspace
        )
    
    return message

# ========== STAFF MANAGEMENT ENDPOINTS ==========

@router.get("/staff", response_model=List[UserResponse])
async def list_staff(
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """List staff members"""
    staff = db.query(User).filter(
        User.workspace_id == current_user.workspace_id,
        User.role == UserRole.STAFF
    ).all()
    return staff

@router.post("/staff", response_model=UserResponse)
async def create_staff(
    data: StaffCreate,
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Create staff member"""
    workspace = current_user.workspace
    
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    username = f"{data.full_name.replace(' ', '_').lower()}_{workspace.id}"
    password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
    
    staff = User(
        email=data.email,
        username=username,
        hashed_password=get_password_hash(password),
        full_name=data.full_name,
        role=UserRole.STAFF,
        workspace_id=workspace.id,
        is_active=True,
        must_change_password=True
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    
    # Send credentials email
    login_link = f"{settings.FRONTEND_URL}/login"
    await email_service.send_staff_credentials(
        to_email=staff.email,
        staff_name=staff.full_name,
        username=username,
        password=password,
        login_link=login_link
    )
    
    return staff

@router.delete("/staff/{staff_id}")
async def delete_staff(
    staff_id: int,
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Delete staff member"""
    staff = db.query(User).filter(
        User.id == staff_id,
        User.workspace_id == current_user.workspace_id,
        User.role == UserRole.STAFF
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    db.delete(staff)
    db.commit()
    
    return {"message": "Staff deleted"}

# ========== EMAIL TEMPLATE ENDPOINTS ==========

@router.get("/email-templates", response_model=List[EmailTemplateResponse])
async def list_email_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List email templates"""
    templates = db.query(EmailTemplate).filter(
        EmailTemplate.workspace_id == current_user.workspace_id
    ).all()
    return templates

@router.post("/email-templates", response_model=EmailTemplateResponse)
async def create_email_template(
    data: EmailTemplateCreate,
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Create email template"""
    template = EmailTemplate(
        workspace_id=current_user.workspace_id,
        template_type=EmailTemplateType(data.template_type),
        subject=data.subject,
        body=data.body,
        variables=data.variables or [],
        is_active=True
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.put("/email-templates/{template_id}", response_model=EmailTemplateResponse)
async def update_email_template(
    template_id: int,
    data: EmailTemplateUpdate,
    current_user: User = Depends(get_current_owner),
    db: Session = Depends(get_db)
):
    """Update email template"""
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.workspace_id == current_user.workspace_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    for key, value in data.dict(exclude_unset=True).items():
        setattr(template, key, value)
    
    db.commit()
    db.refresh(template)
    return template

# ========== PUBLIC ENDPOINTS (No Auth Required) ==========


# ========== PUBLIC FORM DISPLAY & SUBMISSION ==========


@router.get("/public/forms/lookup/{workspace_slug}")
async def lookup_form_by_name(
    workspace_slug: str,
    name: str = Query(..., desc="Contact Information Form"),
    db: Session = Depends(get_db)
):
    """Find a form's ID based on its name and workspace slug"""
    print('__________________>',name)
    # 1. Find Workspace
    workspace = db.query(Workspace).filter(Workspace.id == workspace_slug).first()
    if not workspace:
        # Fallback: try lookup by ID if slug fails (in case slug is actually an ID)
        if workspace_slug.isdigit():
             workspace = db.query(Workspace).filter(Workspace.id == int(workspace_slug)).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # 2. Find Form with matching name (Case Insensitive)
    form = db.query(FormTemplate).filter(
        FormTemplate.workspace_id == workspace.id,
        FormTemplate.is_active == True,
        FormTemplate.name.ilike(f"%{name}%") # Matches "Contact Information Form", "contact information form", etc.
    ).first()

    if not form:
        raise HTTPException(status_code=404, detail=f"Form '{name}' not found")

    return {"form_id": form.id, "form_name": form.name}



@router.get("/public/forms/{workspace_slug}/{form_id}")
async def get_public_form(
    workspace_slug: str,
    form_id: int,
    db: Session = Depends(get_db)
):
    """
    Get public form for display (no authentication required)
    This is what loads when someone opens the shared form link
    """
    # Find workspace by slug
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_slug,
        Workspace.is_active == True
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Get the form template
    form_template = db.query(FormTemplate).filter(
        FormTemplate.id == form_id,
        FormTemplate.workspace_id == workspace.id,
        FormTemplate.is_active == True
    ).first()
    
    if not form_template:
        raise HTTPException(status_code=404, detail="Form not found or inactive")
    
    # Return form and workspace data
    return {
        "form": {
            "id": form_template.id,
            "name": form_template.name,
            "description": form_template.description,
            "form_type": form_template.form_type.value,
            "fields": form_template.fields
        },
        "workspace": {
            "name": workspace.name,
            "slug": workspace.id,
            "logo_url": getattr(workspace, 'logo_url', None),
            "business_address": workspace.business_address,
            "contact_email": workspace.contact_email
        }
    }


@router.post("/public/forms/{workspace_slug}/{form_id}/submit")
async def submit_public_form(
    workspace_slug: str,
    form_id: int,
    submission_data: dict,
    db: Session = Depends(get_db)
):
    """Submit a public form (no authentication required)"""
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_slug,
        Workspace.is_active == True
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    form_template = db.query(FormTemplate).filter(
        FormTemplate.id == form_id,
        FormTemplate.workspace_id == workspace.id,
        FormTemplate.is_active == True
    ).first()
    
    if not form_template:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Extract contact info from submission
    # contact_email = submission_data.get('mail')
    contact_email = next((v for k, v in submission_data.items() if 'email' in k.lower()), None)
    contact_name = next((v for k, v in submission_data.items() if 'name' in k.lower()), 'Anonymous')
    contact_phone = next((v for k, v in submission_data.items() if 'phone' in k.lower()), None)
    
    # contact_name = submission_data.get('name', 'Anonymous')
    # contact_phone = submission_data.get('phone')
    
    
    # Find or create contact
    contact = None
    if contact_email:
        contact = db.query(Contact).filter(
            Contact.workspace_id == workspace.id,
            Contact.email == contact_email
        ).first()
        
        if not contact:
            contact = Contact(
                workspace_id=workspace.id,
                name=contact_name,
                email=contact_email,
                phone=contact_phone,
                source="public_form"
            )
            db.add(contact)
            db.flush()
            
            # Create conversation for new contact
            conversation = Conversation(contact_id=contact.id)
            db.add(conversation)
            
            # Create lead tracking
            tracking = LeadTracking(contact_id=contact.id, status="form_submitted")
            db.add(tracking)
            
            try:
                await email_service.send_welcome_email(
                    db=db,
                    contact=contact,
                    workspace=workspace
                )
            except Exception as e:
                print(f"Failed to send welcome email: {e}")
                
    else:
        # No email - create anonymous contact
        contact = Contact(
            workspace_id=workspace.id,
            name=contact_name,
            phone=contact_phone,
            source="public_form_anonymous"
        )
        db.add(contact)
        db.flush()
    
    # Create form submission
    submission = FormSubmission(
        form_template_id=form_template.id,
        contact_id=contact.id,
        submission_token=secrets.token_urlsafe(16),
        submission_data=submission_data,
        status=FormSubmissionStatus.COMPLETED,  # Changed from SUBMITTED
        submitted_at=datetime.utcnow()
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    
    try:
        
        await email_service.send_welcome_email(
            db=db,
            contact=contact,
            workspace=workspace
        )
        print("Welcome email sent successfully")
    except Exception as e:
        print(f"Failed to send welcome email: {e}")
    
    # Optional: Send notification email to workspace owner
    # await email_service.send_form_submission_notification(...)
    
    return {
        "success": True,
        "message": "Form submitted successfully",
        "submission_id": submission.id
    }
# ========== FORM SUBMISSIONS MANAGEMENT (Keep your existing endpoints) ==========

@router.get("/forms/{form_id}/submissions")
async def get_form_submissions(
    form_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all submissions for a form"""
    form_template = db.query(FormTemplate).filter(
        FormTemplate.id == form_id,
        FormTemplate.workspace_id == current_user.workspace_id
    ).first()
    
    if not form_template:
        raise HTTPException(status_code=404, detail="Form not found")
    
    submissions = db.query(FormSubmission).filter(
        FormSubmission.form_template_id == form_id
    ).order_by(FormSubmission.submitted_at.desc()).all()
    
    result = []
    for sub in submissions:
        contact = db.query(Contact).filter(Contact.id == sub.contact_id).first()
        
        result.append({
            "id": sub.id,
            "contact": {
                "id": contact.id if contact else None,
                "name": contact.name if contact else "Unknown",
                "email": contact.email if contact else None,
                "phone": contact.phone if contact else None
            },
            "submission_data": sub.submission_data,
            "status": sub.status.value,
            "submitted_at": sub.submitted_at,
            "created_at": sub.created_at
        })
    
    return result


@router.get("/forms/{form_id}/analytics")
async def get_form_analytics(
    form_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get analytics for a specific form"""
    form_template = db.query(FormTemplate).filter(
        FormTemplate.id == form_id,
        FormTemplate.workspace_id == current_user.workspace_id
    ).first()
    
    if not form_template:
        raise HTTPException(status_code=404, detail="Form not found")
    
    total = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.form_template_id == form_id
    ).scalar() or 0
    
    completed = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.form_template_id == form_id,
        FormSubmission.status == FormSubmissionStatus.COMPLETED
    ).scalar() or 0
    
    pending = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.form_template_id == form_id,
        FormSubmission.status == FormSubmissionStatus.PENDING
    ).scalar() or 0
    
    opened = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.form_template_id == form_id,
        FormSubmission.opened_at.isnot(None)
    ).scalar() or 0
    
    # Calculate average time to submit
    sent_and_submitted = db.query(FormSubmission).filter(
        FormSubmission.form_template_id == form_id,
        FormSubmission.sent_at.isnot(None),
        FormSubmission.submitted_at.isnot(None)
    ).all()
    
    avg_time_to_submit = 0
    if sent_and_submitted:
        total_time = sum([
            (sub.submitted_at - sub.sent_at).total_seconds() / 3600
            for sub in sent_and_submitted
        ])
        avg_time_to_submit = round(total_time / len(sent_and_submitted), 1)
    
    return {
        "total_submissions": total,
        "submitted_count": completed,
        "pending_count": pending,
        "opened_count": opened,
        "completion_rate": round((completed / total * 100), 1) if total > 0 else 0,
        "open_rate": round((opened / total * 100), 1) if total > 0 else 100,
        "avg_time_to_submit_hours": avg_time_to_submit
    }


@router.post("/public/leads/{workspace_slug}", response_model=ContactResponse)
async def capture_lead(
    workspace_slug: str,
    data: PublicLeadCreate,
    db: Session = Depends(get_db)
):
    """Public lead capture endpoint"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_slug).first()
    if not workspace or not workspace.is_active:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    contact = Contact(
        workspace_id=workspace.id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        notes=data.message,
        source="api"
    )
    db.add(contact)
    db.flush()
    
    conversation = Conversation(contact_id=contact.id)
    db.add(conversation)
    
    tracking = LeadTracking(contact_id=contact.id)
    db.add(tracking)
    
    db.commit()
    db.refresh(contact)
    
    await automation_service.trigger_lead_captured(db, contact)
    
    return contact

@router.get("/public/workspaces/{workspace_slug}")
async def get_public_workspace(
    workspace_slug: str,
    db: Session = Depends(get_db)
):
    """Get public workspace info"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_slug).first()
    if not workspace or not workspace.is_active:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return {
        "name": workspace.name,
        "slug": workspace.id,
        "address": workspace.business_address,
        "contact_email": workspace.contact_email,
        "contact_phone": workspace.contact_phone
    }

@router.get("/public/services/{workspace_slug}", response_model=List[ServiceResponse])
async def get_public_services(
    workspace_slug: str,
    db: Session = Depends(get_db)
):
    """Get public services"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_slug).first()
    if not workspace or not workspace.is_active:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    services = db.query(Service).filter(
        Service.workspace_id == workspace.id,
        Service.is_active == True
    ).all()
    return services

@router.get("/public/availability/{workspace_slug}/{service_id}")
async def get_availability(
    workspace_slug: str,
    service_id: int,
    date: str = Query(...),
    db: Session = Depends(get_db)
):
    """Get available time slots for a service"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_slug).first()
    if not workspace or not workspace.is_active:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    service = db.query(Service).filter(
        Service.id == service_id,
        Service.workspace_id == workspace.id
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Parse date
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Generate slots (simplified - assumes 9 AM to 5 PM)
    slots = []
    start_hour = 9
    end_hour = 17
    slot_duration = service.duration_minutes
    max_bookings = service.max_bookings_per_slot or workspace.max_bookings_per_slot
    
    current_time = target_date.replace(hour=start_hour, minute=0)
    end_time = target_date.replace(hour=end_hour, minute=0)
    
    while current_time < end_time:
        slot_end = current_time + timedelta(minutes=slot_duration)
        
        # Check existing bookings
        existing = db.query(Booking).filter(
            Booking.workspace_id == workspace.id,
            Booking.service_id == service.id,
            Booking.start_time == current_time,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
        ).count()
        
        available_spots = max_bookings - existing
        
        if available_spots > 0:
            slots.append({
                "start_time": current_time.isoformat(),
                "end_time": slot_end.isoformat(),
                "available_spots": available_spots,
                "total_spots": max_bookings
            })
        
        current_time = slot_end
    
    return {"date": date, "slots": slots}

@router.post("/public/bookings/{workspace_slug}")
async def create_public_booking(
    workspace_slug: str,
    data: BookingCreate,
    db: Session = Depends(get_db)
):
    """Public booking creation"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_slug).first()
    if not workspace or not workspace.is_active:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    service = db.query(Service).filter(
        Service.id == data.service_id,
        Service.workspace_id == workspace.id
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Create or find contact
    if data.contact_id:
        contact = db.query(Contact).filter(Contact.id == data.contact_id).first()
    else:
        contact = Contact(
            workspace_id=workspace.id,
            name=data.contact_name,
            email=data.contact_email,
            phone=data.contact_phone,
            source="booking_form"
        )
        db.add(contact)
        db.flush()
        
        conversation = Conversation(contact_id=contact.id)
        db.add(conversation)
        
        tracking = LeadTracking(contact_id=contact.id)
        db.add(tracking)
        
        try:
            await email_service.send_booking_confirmation(
                db=db,
                booking=booking,
                contact=contact,
                workspace=workspace
            )
        except Exception as e:
            print(f"Failed to send booking confirmation: {e}")
    
    end_time = data.start_time + timedelta(minutes=service.duration_minutes)
    
    booking = Booking(
        workspace_id=workspace.id,
        contact_id=contact.id,
        service_id=service.id,
        start_time=data.start_time,
        end_time=end_time,
        notes=data.notes,
        status=BookingStatus.CONFIRMED
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    
    await automation_service.trigger_booking_created(db, booking)
    
    return {"message": "Booking created", "booking_id": booking.id}




# Logging FORM OPENED
@router.get("/public/forms/{token}")
async def get_form_by_token(
    token: str,
    db: Session = Depends(get_db)
):
    """Get form by submission token"""
    submission = db.query(FormSubmission).filter(
        FormSubmission.submission_token == token
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if submission.status != FormSubmissionStatus.PENDING:
        submission.opened_at = datetime.utcnow()
        submission.status = FormSubmissionStatus.OPENED
        db.commit()
    
    return {
        "form": submission.form_template,
        "contact": submission.contact,
        "submission": submission
    }

@router.post("/public/forms/{token}/submit")
async def submit_form(
    token: str,
    data: FormSubmissionCreate,
    db: Session = Depends(get_db)
):
    """Submit form"""
    submission = db.query(FormSubmission).filter(
        FormSubmission.submission_token == token
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if submission.status == FormSubmissionStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Form already submitted")
    
    submission.submission_data = data.submission_data
    submission.status = FormSubmissionStatus.COMPLETED
    submission.submitted_at = datetime.utcnow()
    
    # Update lead tracking
    if submission.contact.lead_tracking:
        submission.contact.lead_tracking.post_form_completed_at = datetime.utcnow()
        submission.contact.lead_tracking.status = "form_completed"
    
    db.commit()
    
    return {"message": "Form submitted successfully"}


# ============= PUBLIC ENDPOINTS FOR BOOKING =============
@router.get("/public/bookings/{workspace_slug}")
async def get_public_booking_page(
    workspace_slug: str,
    db: Session = Depends(get_db)
):
    """
    Get workspace and services for public booking page
    No authentication required
    """
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_slug,
        Workspace.is_active == True
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Get all active services
    services = db.query(Service).filter(
        Service.workspace_id == workspace.id,
        Service.is_active == True
    ).all()
    
    return {
        "workspace": {
            "name": workspace.name,
            "slug": workspace.slug,
            "logo_url": getattr(workspace, 'logo_url', None),
            "business_address": workspace.business_address,
            "contact_email": workspace.contact_email,
            "contact_phone": workspace.contact_phone,
            "timezone": workspace.timezone
        },
        "services": [
            {
                "id": service.id,
                "name": service.name,
                "description": service.description,
                "duration_minutes": service.duration_minutes,
                # "price": service.price,
                "location": service.location
            }
            for service in services
        ]
    }
    
@router.get("/public/bookings/{workspace_slug}/availability/{service_id}")
async def get_public_availability(
    workspace_slug: str,
    service_id: int,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db)
):
    """
    Get available time slots for a service on a specific date
    No authentication required
    """
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_slug,
        Workspace.is_active == True
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    service = db.query(Service).filter(
        Service.id == service_id,
        Service.workspace_id == workspace.id,
        Service.is_active == True
    ).first()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Parse the date
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Generate time slots (9 AM to 5 PM by default)
    # You can customize these hours per workspace/service
    start_hour = 9
    end_hour = 17
    slot_duration = service.duration_minutes
    max_bookings_per_slot = workspace.max_bookings_per_slot or 1
    
    slots = []
    current_time = target_date.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    end_time = target_date.replace(hour=end_hour, minute=0, second=0, microsecond=0)
    
    while current_time < end_time:
        slot_end = current_time + timedelta(minutes=slot_duration)
        
        # Check existing bookings at this time
        existing_bookings = db.query(Booking).filter(
            Booking.workspace_id == workspace.id,
            Booking.service_id == service.id,
            Booking.start_time == current_time,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
        ).count()
        
        available_spots = max_bookings_per_slot - existing_bookings
        
        if available_spots > 0:
            slots.append({
                "start_time": current_time.isoformat(),
                "end_time": slot_end.isoformat(),
                "display_time": current_time.strftime("%I:%M %p"),
                "available_spots": available_spots,
                "is_available": True
            })
        
        current_time = slot_end
    
    return {
        "date": date,
        "service_name": service.name,
        "slots": slots
    }
    
    
@router.post("/public/bookings/{workspace_slug}/book")
async def create_public_booking(
    workspace_slug: str,
    booking_data: dict,
    db: Session = Depends(get_db)
):
    """
    Create a booking from the public booking page
    No authentication required
    
    Expected booking_data:
    {
        "service_id": 1,
        "start_time": "2024-03-15T10:00:00",
        "contact_name": "John Doe",
        "contact_email": "john@example.com",
        "contact_phone": "+1234567890",
        "notes": "Optional notes"
    }
    """
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_slug,
        Workspace.is_active == True
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Validate service
    service = db.query(Service).filter(
        Service.id == booking_data.get('service_id'),
        Service.workspace_id == workspace.id,
        Service.is_active == True
    ).first()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Parse start time
    try:
        start_time = datetime.fromisoformat(booking_data.get('start_time').replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid start_time format")
    
    # Calculate end time
    end_time = start_time + timedelta(minutes=service.duration_minutes)
    
    # Check if slot is still available
    max_bookings = workspace.max_bookings_per_slot or 1
    existing_bookings = db.query(Booking).filter(
        Booking.workspace_id == workspace.id,
        Booking.service_id == service.id,
        Booking.start_time == start_time,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
    ).count()
    
    if existing_bookings >= max_bookings:
        raise HTTPException(status_code=409, detail="This time slot is no longer available")
    
    # Extract contact info
    contact_name = booking_data.get('contact_name')
    contact_email = booking_data.get('contact_email')
    contact_phone = booking_data.get('contact_phone')
    
    if not contact_name or not contact_email:
        raise HTTPException(status_code=400, detail="Name and email are required")
    
    # Find or create contact
    contact = db.query(Contact).filter(
        Contact.workspace_id == workspace.id,
        Contact.email == contact_email
    ).first()
    
    if contact:
        # Update existing contact
        contact.name = contact_name
        if contact_phone:
            contact.phone = contact_phone
    else:
        # Create new contact
        contact = Contact(
            workspace_id=workspace.id,
            name=contact_name,
            email=contact_email,
            phone=contact_phone,
            source="public_booking"
        )
        db.add(contact)
        db.flush()
        
        # Create conversation for new contact
        conversation = Conversation(contact_id=contact.id)
        db.add(conversation)
        
        # Create lead tracking
        tracking = LeadTracking(
            contact_id=contact.id,
            status="booking_created"
        )
        db.add(tracking)
    
    # Create booking
    booking = Booking(
        workspace_id=workspace.id,
        contact_id=contact.id,
        service_id=service.id,
        start_time=start_time,
        end_time=end_time,
        notes=booking_data.get('notes', ''),
        status=BookingStatus.CONFIRMED
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    
    try:
        await email_service.send_booking_confirmation(
            db=db,
            booking=booking,
            contact=contact,
            workspace=workspace                
        )
        
    except Exception as e:
        print(f"Failed to send booking confirmation: {e}")
    
    # Optional: Trigger automations
    try:
        await automation_service.trigger_booking_created(db, booking)
    except Exception as e:
        print(f"Automation error: {e}")
    
    return {
        "success": True,
        "message": "Booking created successfully",
        "booking_id": booking.id,
        "booking_details": {
            "service_name": service.name,
            "date": start_time.strftime("%B %d, %Y"),
            "time": start_time.strftime("%I:%M %p"),
            "duration": service.duration_minutes
        }
    }
    
    






# ========== ANALYTICS ENDPOINT ==========

@router.get("/analytics", response_model=dict)
async def get_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed analytics for dashboard calculations"""
    workspace_id = current_user.workspace_id
    now = datetime.utcnow()
    
    # Today's date range
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    
    # Yesterday
    yesterday_start = today_start - timedelta(days=1)
    
    # This week
    week_start = today_start - timedelta(days=today_start.weekday())
    
    # Last week
    last_week_start = week_start - timedelta(days=7)
    last_week_end = week_start
    
    # This month
    month_start = datetime(now.year, now.month, 1)
    
    # Last month
    if now.month == 1:
        last_month_start = datetime(now.year - 1, 12, 1)
        last_month_end = datetime(now.year, 1, 1)
    else:
        last_month_start = datetime(now.year, now.month - 1, 1)
        last_month_end = datetime(now.year, now.month, 1)
    
    # Calculate metrics
    
    # Today's bookings
    today_bookings = db.query(func.count(Booking.id)).filter(
        Booking.workspace_id == workspace_id,
        Booking.start_time >= today_start,
        Booking.start_time < today_end
    ).scalar() or 0
    
    # Yesterday's bookings
    yesterday_bookings = db.query(func.count(Booking.id)).filter(
        Booking.workspace_id == workspace_id,
        Booking.start_time >= yesterday_start,
        Booking.start_time < today_start
    ).scalar() or 0
    
    # Active leads this week (contacts created this week)
    active_leads_week = db.query(func.count(Contact.id)).filter(
        Contact.workspace_id == workspace_id,
        Contact.created_at >= week_start
    ).scalar() or 0
    
    # Active leads last week
    active_leads_last_week = db.query(func.count(Contact.id)).filter(
        Contact.workspace_id == workspace_id,
        Contact.created_at >= last_week_start,
        Contact.created_at < last_week_end
    ).scalar() or 0
    
    # Active leads this month
    active_leads_month = db.query(func.count(Contact.id)).filter(
        Contact.workspace_id == workspace_id,
        Contact.created_at >= month_start
    ).scalar() or 0
    
    # Active leads last month
    active_leads_last_month = db.query(func.count(Contact.id)).filter(
        Contact.workspace_id == workspace_id,
        Contact.created_at >= last_month_start,
        Contact.created_at < last_month_end
    ).scalar() or 0
    
    # Leads to booking conversion (this month)
    leads_with_bookings = db.query(func.count(func.distinct(Booking.contact_id))).filter(
        Booking.workspace_id == workspace_id,
        Booking.created_at >= month_start
    ).scalar() or 0
    
    conversion_rate = (leads_with_bookings / active_leads_month * 100) if active_leads_month > 0 else 0
    
    # Last month conversion
    leads_with_bookings_last = db.query(func.count(func.distinct(Booking.contact_id))).filter(
        Booking.workspace_id == workspace_id,
        Booking.created_at >= last_month_start,
        Booking.created_at < last_month_end
    ).scalar() or 0
    
    last_month_total_leads = active_leads_last_month or 1
    conversion_rate_last_month = (leads_with_bookings_last / last_month_total_leads * 100)
    
    # Pending forms
    pending_forms = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.status == FormSubmissionStatus.PENDING
    ).scalar() or 0
    
    # Overdue forms (sent more than 48 hours ago)
    overdue_cutoff = now - timedelta(hours=48)
    overdue_forms = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.status == FormSubmissionStatus.PENDING,
        FormSubmission.sent_at < overdue_cutoff
    ).scalar() or 0
    
    # Last week pending forms (for comparison)
    pending_forms_last_week = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.status == FormSubmissionStatus.PENDING,
        FormSubmission.created_at >= last_week_start,
        FormSubmission.created_at < last_week_end
    ).scalar() or 0
    
    # 7-day booking data
    seven_day_data = []
    for i in range(-3, 4):  # 3 days before, today, 3 days after
        day_start = today_start + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        count = db.query(func.count(Booking.id)).filter(
            Booking.workspace_id == workspace_id,
            Booking.start_time >= day_start,
            Booking.start_time < day_end
        ).scalar() or 0
        
        seven_day_data.append({
            'date': day_start.strftime('%Y-%m-%d'),
            'day': day_start.strftime('%a'),
            'count': count,
            'is_today': i == 0
        })
    
    # Completion rate
    completed_bookings = db.query(func.count(Booking.id)).filter(
        Booking.workspace_id == workspace_id,
        Booking.status == BookingStatus.COMPLETED,
        Booking.created_at >= month_start
    ).scalar() or 0
    
    total_bookings_month = db.query(func.count(Booking.id)).filter(
        Booking.workspace_id == workspace_id,
        Booking.created_at >= month_start
    ).scalar() or 1
    
    completion_rate = (completed_bookings / total_bookings_month * 100)
    
    # Last month completion
    completed_last_month = db.query(func.count(Booking.id)).filter(
        Booking.workspace_id == workspace_id,
        Booking.status == BookingStatus.COMPLETED,
        Booking.created_at >= last_month_start,
        Booking.created_at < last_month_end
    ).scalar() or 0
    
    total_last_month = db.query(func.count(Booking.id)).filter(
        Booking.workspace_id == workspace_id,
        Booking.created_at >= last_month_start,
        Booking.created_at < last_month_end
    ).scalar() or 1
    
    completion_rate_last_month = (completed_last_month / total_last_month * 100)
    
    # No-show rate
    no_show_bookings = db.query(func.count(Booking.id)).filter(
        Booking.workspace_id == workspace_id,
        Booking.status == BookingStatus.NO_SHOW,
        Booking.created_at >= month_start
    ).scalar() or 0
    
    no_show_rate = (no_show_bookings / total_bookings_month * 100)
    
    # Calculate trends
    def calculate_trend(current, previous):
        if previous == 0:
            return 100 if current > 0 else 0
        return round(((current - previous) / previous) * 100, 1)
    
    return {
        "today_bookings": today_bookings,
        "today_bookings_trend": calculate_trend(today_bookings, yesterday_bookings),
        
        "active_leads_week": active_leads_week,
        "active_leads_week_trend": calculate_trend(active_leads_week, active_leads_last_week),
        
        "active_leads_month": active_leads_month,
        "active_leads_month_trend": calculate_trend(active_leads_month, active_leads_last_month),
        
        "conversion_rate": round(conversion_rate, 1),
        "conversion_rate_trend": round(conversion_rate - conversion_rate_last_month, 1),
        
        "pending_forms": pending_forms,
        "overdue_forms": overdue_forms,
        "pending_forms_trend": calculate_trend(pending_forms, pending_forms_last_week),
        
        "completion_rate": round(completion_rate, 1),
        "completion_rate_trend": round(completion_rate - completion_rate_last_month, 1),
        
        "no_show_rate": round(no_show_rate, 1),
        
        "seven_day_bookings": seven_day_data,
        
        "total_bookings_month": total_bookings_month,
        "total_contacts": db.query(func.count(Contact.id)).filter(Contact.workspace_id == workspace_id).scalar() or 0,
    }


# ========== LIVE LEADS ENDPOINT ==========

@router.get("/live-leads", response_model=List[dict])
async def get_live_leads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recent leads (last 24 hours) for live feed"""
    workspace_id = current_user.workspace_id
    yesterday = datetime.utcnow() - timedelta(hours=24)
    
    leads = db.query(Contact).filter(
        Contact.workspace_id == workspace_id,
        Contact.created_at >= yesterday
    ).order_by(Contact.created_at.desc()).limit(10).all()
    
    result = []
    for lead in leads:
        # Get if they have a booking
        has_booking = db.query(Booking).filter(Booking.contact_id == lead.id).first() is not None
        
        # Get if they have an active conversation
        conversation = db.query(Conversation).filter(Conversation.contact_id == lead.id).first()
        unread = conversation.unread_count if conversation else 0
        
        result.append({
            "id": lead.id,
            "name": lead.name,
            "email": lead.email,
            "phone": lead.phone,
            "source": lead.source,
            "created_at": lead.created_at,
            "has_booking": has_booking,
            "unread_messages": unread,
            "minutes_ago": int((datetime.utcnow() - lead.created_at).total_seconds() / 60)
        })
    
    return result


# ========== BUSINESS HOURS VALIDATION ==========

@router.get("/availability/validate", response_model=dict)
async def validate_booking_time(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    time: str = Query(..., description="Time in HH:MM format"),
    duration: int = Query(..., description="Duration in minutes"),
    service_id: int = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate if a booking time is within business hours"""
    workspace = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    
    # Parse date and time
    booking_date = datetime.strptime(date, '%Y-%m-%d')
    booking_time = datetime.strptime(f"{date} {time}", '%Y-%m-%d %H:%M')
    day_name = booking_date.strftime('%A').lower()
    
    # Get working hours for this day
    working_hours = workspace.working_hours or {}
    
    if day_name not in working_hours:
        return {
            "is_valid": False,
            "reason": f"Business is closed on {day_name.capitalize()}",
            "alternative_message": "Please select a different day"
        }
    
    day_hours = working_hours[day_name]
    if not day_hours.get('enabled', False):
        return {
            "is_valid": False,
            "reason": f"Business is closed on {day_name.capitalize()}",
            "alternative_message": "Please select a different day"
        }
    
    # Check if time is within working hours
    start_time = datetime.strptime(f"{date} {day_hours['start']}", '%Y-%m-%d %H:%M')
    end_time = datetime.strptime(f"{date} {day_hours['end']}", '%Y-%m-%d %H:%M')
    
    booking_end = booking_time + timedelta(minutes=duration)
    
    if booking_time < start_time:
        return {
            "is_valid": False,
            "reason": f"Business opens at {day_hours['start']}",
            "alternative_message": f"Earliest available: {day_hours['start']}"
        }
    
    if booking_end > end_time:
        return {
            "is_valid": False,
            "reason": f"Business closes at {day_hours['end']}",
            "alternative_message": f"Latest slot: {(end_time - timedelta(minutes=duration)).strftime('%H:%M')}"
        }
    
    # Check lunch break
    lunch_break = workspace.lunch_break or {}
    if lunch_break.get('enabled'):
        lunch_start = datetime.strptime(f"{date} {lunch_break['start']}", '%Y-%m-%d %H:%M')
        lunch_end = datetime.strptime(f"{date} {lunch_break['end']}", '%Y-%m-%d %H:%M')
        
        # Check if booking overlaps with lunch
        if booking_time < lunch_end and booking_end > lunch_start:
            return {
                "is_valid": False,
                "reason": f"Lunch break: {lunch_break['start']} - {lunch_break['end']}",
                "alternative_message": f"Available after {lunch_break['end']}"
            }
    
    # Check for existing bookings (conflicts)
    conflicts = db.query(Booking).filter(
        Booking.workspace_id == workspace.id,
        Booking.start_time < booking_end,
        Booking.end_time > booking_time,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
    ).count()
    
    if conflicts > 0:
        return {
            "is_valid": False,
            "reason": "Time slot already booked",
            "alternative_message": "Please select a different time"
        }
    
    return {
        "is_valid": True,
        "reason": "Time slot available",
        "alternative_message": None
    }


# ========== FORM SUBMISSIONS PUBLIC & MANAGEMENT ==========

@router.post("/public/forms/submit/{workspace_slug}/{form_id}", response_model=dict)
async def submit_public_form(
    workspace_slug: str,
    form_id: int,
    submission_data: dict,
    db: Session = Depends(get_db)
):
    """Submit a public form (no authentication required)"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_slug).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    form_template = db.query(FormTemplate).filter(
        FormTemplate.id == form_id,
        FormTemplate.workspace_id == workspace.id,
        FormTemplate.is_active == True
    ).first()
    
    if not form_template:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Extract contact info from submission
    contact_email = submission_data.get('email')
    contact_name = submission_data.get('name', 'Anonymous')
    contact_phone = submission_data.get('phone')
    
    # Find or create contact
    contact = None
    if contact_email:
        contact = db.query(Contact).filter(
            Contact.workspace_id == workspace.id,
            Contact.email == contact_email
        ).first()
        
        if contact:
            # Contact exists - UPDATE with latest info (latest wins)
            if contact_name and contact_name != 'Anonymous':
                contact.name = contact_name
            if contact_phone:
                contact.phone = contact_phone
            contact.updated_at = datetime.utcnow()
        else:
            # Create new contact
            contact = Contact(
                workspace_id=workspace.id,
                name=contact_name,
                email=contact_email,
                phone=contact_phone,
                source="form_submission"
            )
            db.add(contact)
        db.flush()
    
    # Create form submission
    submission = FormSubmission(
        form_template_id=form_template.id,
        contact_id=contact.id if contact else None,
        submission_data=submission_data,
        status=FormSubmissionStatus.SUBMITTED,
        submitted_at=datetime.utcnow()
    )
    db.add(submission)
    db.commit()
    
    return {
        "success": True,
        "message": "Form submitted successfully",
        "submission_id": submission.id
    }


@router.get("/forms/{form_id}/submissions", response_model=List[dict])
async def get_form_submissions(
    form_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all submissions for a form with analytics"""
    form_template = db.query(FormTemplate).filter(
        FormTemplate.id == form_id,
        FormTemplate.workspace_id == current_user.workspace_id
    ).first()
    
    if not form_template:
        raise HTTPException(status_code=404, detail="Form not found")
    
    submissions = db.query(FormSubmission).filter(
        FormSubmission.form_template_id == form_id
    ).order_by(FormSubmission.submitted_at.desc()).all()
    
    result = []
    for sub in submissions:
        contact = db.query(Contact).filter(Contact.id == sub.contact_id).first()
        
        result.append({
            "id": sub.id,
            "contact_name": contact.name if contact else "Anonymous",
            "contact_email": contact.email if contact else None,
            "submission_data": sub.submission_data,
            "status": sub.status.value,
            "submitted_at": sub.submitted_at,
            "opened_at": sub.opened_at,
            "sent_at": sub.sent_at
        })
    
    return result


@router.get("/forms/{form_id}/analytics", response_model=dict)
async def get_form_analytics(
    form_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get analytics for a specific form"""
    form_template = db.query(FormTemplate).filter(
        FormTemplate.id == form_id,
        FormTemplate.workspace_id == current_user.workspace_id
    ).first()
    
    if not form_template:
        raise HTTPException(status_code=404, detail="Form not found")
    
    total = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.form_template_id == form_id
    ).scalar() or 0
    
    submitted = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.form_template_id == form_id,
        FormSubmission.status == FormSubmissionStatus.SUBMITTED
    ).scalar() or 0
    
    pending = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.form_template_id == form_id,
        FormSubmission.status == FormSubmissionStatus.PENDING
    ).scalar() or 0
    
    opened = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.form_template_id == form_id,
        FormSubmission.opened_at.isnot(None)
    ).scalar() or 0
    
    # Calculate average time to submit (for forms that were sent)
    sent_and_submitted = db.query(FormSubmission).filter(
        FormSubmission.form_template_id == form_id,
        FormSubmission.sent_at.isnot(None),
        FormSubmission.submitted_at.isnot(None)
    ).all()
    
    avg_time_to_submit = 0
    if sent_and_submitted:
        total_time = sum([
            (sub.submitted_at - sub.sent_at).total_seconds() / 3600  # hours
            for sub in sent_and_submitted
        ])
        avg_time_to_submit = round(total_time / len(sent_and_submitted), 1)
    
    return {
        "total_submissions": total,
        "submitted_count": submitted,
        "pending_count": pending,
        "opened_count": opened,
        "completion_rate": round((submitted / total * 100), 1) if total > 0 else 0,
        "open_rate": round((opened / total * 100), 1) if total > 0 else 0,
        "avg_time_to_submit_hours": avg_time_to_submit
    }


# ========== COMPREHENSIVE ANALYTICS EXPORT ==========

@router.get("/analytics/export", response_model=dict)
async def export_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export all business analytics data for pandas/data analysis"""
    workspace_id = current_user.workspace_id
    now = datetime.utcnow()
    
    # Date ranges
    today_start = datetime(now.year, now.month, now.day)
    month_start = datetime(now.year, now.month, 1)
    
    # Get all bookings
    all_bookings = db.query(Booking).filter(Booking.workspace_id == workspace_id).all()
    
    bookings_data = [{
        "id": b.id,
        "contact_id": b.contact_id,
        "service_id": b.service_id,
        "start_time": b.start_time.isoformat(),
        "end_time": b.end_time.isoformat(),
        "status": b.status.value,
        "created_at": b.created_at.isoformat(),
        "duration_minutes": (b.end_time - b.start_time).total_seconds() / 60
    } for b in all_bookings]
    
    # Get all contacts
    all_contacts = db.query(Contact).filter(Contact.workspace_id == workspace_id).all()
    
    contacts_data = [{
        "id": c.id,
        "name": c.name,
        "email": c.email,
        "phone": c.phone,
        "source": c.source,
        "created_at": c.created_at.isoformat()
    } for c in all_contacts]
    
    # Get all form submissions
    all_submissions = db.query(FormSubmission).join(FormTemplate).filter(
        FormTemplate.workspace_id == workspace_id
    ).all()
    
    submissions_data = [{
        "id": s.id,
        "form_template_id": s.form_template_id,
        "contact_id": s.contact_id,
        "status": s.status.value,
        "sent_at": s.sent_at.isoformat() if s.sent_at else None,
        "opened_at": s.opened_at.isoformat() if s.opened_at else None,
        "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None
    } for s in all_submissions]
    
    # Get inventory transactions
    all_inventory = db.query(InventoryItem).filter(
        InventoryItem.workspace_id == workspace_id
    ).all()
    
    inventory_data = [{
        "id": i.id,
        "name": i.name,
        "current_stock": i.current_stock,
        "threshold": i.threshold,
        "inventory_type": i.inventory_type.value,
        "unit": i.unit
    } for i in all_inventory]
    
    # Get conversations and messages
    all_conversations = db.query(Conversation).join(Contact).filter(
        Contact.workspace_id == workspace_id
    ).all()
    
    conversations_data = [{
        "id": c.id,
        "contact_id": c.contact_id,
        "created_at": c.created_at.isoformat(),
        "unread_count": c.unread_count,
        "is_active": c.is_active
    } for c in all_conversations]
    
    # Summary metrics
    summary = {
        "total_bookings": len(all_bookings),
        "total_contacts": len(all_contacts),
        "total_form_submissions": len(all_submissions),
        "total_conversations": len(all_conversations),
        
        "bookings_by_status": {
            "pending": len([b for b in all_bookings if b.status == BookingStatus.PENDING]),
            "confirmed": len([b for b in all_bookings if b.status == BookingStatus.CONFIRMED]),
            "completed": len([b for b in all_bookings if b.status == BookingStatus.COMPLETED]),
            "no_show": len([b for b in all_bookings if b.status == BookingStatus.NO_SHOW]),
            "cancelled": len([b for b in all_bookings if b.status == BookingStatus.CANCELLED])
        },
        
        "contacts_by_source": {},
        
        "conversion_metrics": {
            "total_leads": len(all_contacts),
            "leads_with_bookings": len(set([b.contact_id for b in all_bookings])),
            "conversion_rate": round(len(set([b.contact_id for b in all_bookings])) / len(all_contacts) * 100, 2) if all_contacts else 0
        },
        
        "form_metrics": {
            "total_submitted": len([s for s in all_submissions if s.status == FormSubmissionStatus.SUBMITTED]),
            "total_pending": len([s for s in all_submissions if s.status == FormSubmissionStatus.PENDING]),
            "submission_rate": round(len([s for s in all_submissions if s.status == FormSubmissionStatus.SUBMITTED]) / len(all_submissions) * 100, 2) if all_submissions else 0
        }
    }
    
    # Count contacts by source
    for contact in all_contacts:
        source = contact.source or "unknown"
        summary["contacts_by_source"][source] = summary["contacts_by_source"].get(source, 0) + 1
    
    return {
        "exported_at": now.isoformat(),
        "workspace_id": workspace_id,
        "summary": summary,
        "data": {
            "bookings": bookings_data,
            "contacts": contacts_data,
            "form_submissions": submissions_data,
            "inventory": inventory_data,
            "conversations": conversations_data
        }
    }
    
# Helper function
def calculate_percentage_change(current: int, previous: int) -> float:
    """Calculate percentage change between two values"""
    if previous == 0:
        return 100.0*current if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


# ========== DASHBOARD ANALYTICS ==========

@router.get("/dashboard/analytics", response_model=AnalyticsResponse)
async def get_dashboard_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard analytics with trends and 7-day data"""
    wid = current_user.workspace_id
    
    # Date calculations
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    # Previous periods for comparison
    prev_week_start = week_start - timedelta(days=7)
    prev_month_start = month_start - timedelta(days=30)
    
    # === TODAY'S BOOKINGS ===
    today_bookings = db.query(Booking).filter(
        Booking.workspace_id == wid,
        Booking.start_time >= today_start,
        Booking.start_time < today_end
    ).count()
    
    yesterday_start = today_start - timedelta(days=1)
    yesterday_bookings = db.query(Booking).filter(
        Booking.workspace_id == wid,
        Booking.start_time >= yesterday_start,
        Booking.start_time < today_start
    ).count()
    
    today_bookings_trend = calculate_percentage_change(today_bookings, yesterday_bookings)
    
    # === ACTIVE LEADS (WEEK) ===
    active_leads_week = db.query(Contact).filter(
        Contact.workspace_id == wid,
        Contact.created_at >= week_start
    ).count()
    
    prev_week_leads = db.query(Contact).filter(
        Contact.workspace_id == wid,
        Contact.created_at >= prev_week_start,
        Contact.created_at < week_start
    ).count()
    
    active_leads_week_trend = calculate_percentage_change(active_leads_week, prev_week_leads)
    
    # === ACTIVE LEADS (MONTH) ===
    active_leads_month = db.query(Contact).filter(
        Contact.workspace_id == wid,
        Contact.created_at >= month_start
    ).count()
    
    print(f"Active leads this month: {active_leads_month}")
    
    prev_month_leads = db.query(Contact).filter(
        Contact.workspace_id == wid,
        Contact.created_at >= prev_month_start,
        Contact.created_at < month_start
    ).count()
    
    active_leads_month_trend = calculate_percentage_change(active_leads_month, prev_month_leads)
    
    # === CONVERSION RATE ===
    total_leads = db.query(Contact).filter(
        Contact.workspace_id == wid,
        Contact.created_at >= month_start
    ).count()
    
    converted_leads = db.query(Contact).join(Booking).filter(
        Contact.workspace_id == wid,
        Contact.created_at >= month_start,
        Booking.status == BookingStatus.COMPLETED
    ).distinct().count()
    
    conversion_rate = round((converted_leads / total_leads * 100), 1) if total_leads > 0 else 0
    
    # Previous month conversion
    prev_total_leads = db.query(Contact).filter(
        Contact.workspace_id == wid,
        Contact.created_at >= prev_month_start,
        Contact.created_at < month_start
    ).count()
    
    prev_converted_leads = db.query(Contact).join(Booking).filter(
        Contact.workspace_id == wid,
        Contact.created_at >= prev_month_start,
        Contact.created_at < month_start,
        Booking.status == BookingStatus.COMPLETED
    ).distinct().count()
    
    prev_conversion_rate = round((prev_converted_leads / prev_total_leads * 100), 1) if prev_total_leads > 0 else 0
    conversion_rate_trend = round(conversion_rate - prev_conversion_rate, 1)
    
    # === PENDING FORMS ===
    pending_forms = db.query(FormSubmission).join(Contact).filter(
        Contact.workspace_id == wid,
        FormSubmission.status == FormSubmissionStatus.PENDING
    ).count()
    
    # Previous week pending forms
    prev_week_end = week_start
    prev_week_pending = db.query(FormSubmission).join(Contact).filter(
        Contact.workspace_id == wid,
        FormSubmission.status == FormSubmissionStatus.PENDING,
        FormSubmission.created_at < prev_week_end
    ).count()
    
    pending_forms_trend = calculate_percentage_change(pending_forms, prev_week_pending)
    
    # === OVERDUE FORMS ===
    overdue_forms = db.query(FormSubmission).join(Contact).filter(
        Contact.workspace_id == wid,
        FormSubmission.status == FormSubmissionStatus.PENDING,
        FormSubmission.sent_at < now - timedelta(hours=48)
    ).count()
    
    # === COMPLETION RATE ===
    total_bookings = db.query(Booking).filter(
        Booking.workspace_id == wid,
        Booking.created_at >= month_start
    ).count()
    
    completed_bookings = db.query(Booking).filter(
        Booking.workspace_id == wid,
        Booking.status == BookingStatus.COMPLETED,
        Booking.created_at >= month_start
    ).count()
    
    completion_rate = round((completed_bookings / total_bookings * 100), 1) if total_bookings > 0 else 0
    
    # Previous month completion rate
    prev_total_bookings = db.query(Booking).filter(
        Booking.workspace_id == wid,
        Booking.created_at >= prev_month_start,
        Booking.created_at < month_start
    ).count()
    
    prev_completed_bookings = db.query(Booking).filter(
        Booking.workspace_id == wid,
        Booking.status == BookingStatus.COMPLETED,
        Booking.created_at >= prev_month_start,
        Booking.created_at < month_start
    ).count()
    
    prev_completion_rate = round((prev_completed_bookings / prev_total_bookings * 100), 1) if prev_total_bookings > 0 else 0
    completion_rate_trend = round(completion_rate - prev_completion_rate, 1)
    
    # === 7-DAY BOOKING CHART ===
    seven_day_bookings = []
    for i in range(-3, 4):  # 3 days before, today, 3 days after
        day_start = today_start + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        count = db.query(Booking).filter(
            Booking.workspace_id == wid,
            Booking.start_time >= day_start,
            Booking.start_time < day_end
        ).count()
        
        day_data = {
            "day": "Today" if i == 0 else day_start.strftime("%a"),
            "date": day_start.day,
            "count": count,
            "is_today": i == 0
        }
        seven_day_bookings.append(day_data)
    
    return {
        "today_bookings": today_bookings,
        "today_bookings_trend": today_bookings_trend,
        "active_leads_week": active_leads_week,
        "active_leads_week_trend": active_leads_week_trend,
        "active_leads_month": active_leads_month,
        "active_leads_month_trend": active_leads_month_trend,
        "conversion_rate": conversion_rate,
        "conversion_rate_trend": conversion_rate_trend,
        "pending_forms": pending_forms,
        "pending_forms_trend": pending_forms_trend,
        "overdue_forms": overdue_forms,
        "completion_rate": completion_rate,
        "completion_rate_trend": completion_rate_trend,
        "seven_day_bookings": seven_day_bookings
    }


# ========== TODAY'S BOOKING DETAILED VIEW ==========


@router.get("/bookings/today/detailed", response_model=List[dict])
async def get_todays_bookings_detailed(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get today's bookings with complete customer information including form submissions"""
    workspace_id = current_user.workspace_id
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    
    # Get all bookings for today
    bookings = db.query(Booking).filter(
        Booking.workspace_id == workspace_id,
        Booking.start_time >= today_start,
        Booking.start_time < today_end
    ).order_by(Booking.start_time).all()
    
    result = []
    for booking in bookings:
        contact = db.query(Contact).filter(Contact.id == booking.contact_id).first()
        service = db.query(Service).filter(Service.id == booking.service_id).first()
        
        # Get all form submissions by this contact
        form_submissions = db.query(FormSubmission).filter(
            FormSubmission.contact_id == contact.id
        ).order_by(FormSubmission.submitted_at.desc()).all()
        
        # Process form submissions with better structure
        submissions_data = []
        combined_bio_data = {}  # NEW: Organize data by form type
        
        for submission in form_submissions:
            form_template = db.query(FormTemplate).filter(
                FormTemplate.id == submission.form_template_id
            ).first()
            
            if not form_template:
                continue
            
            # Extract submission data
            submission_data = submission.submission_data or {}
            
            # Separate media files from regular fields
            media_files = []
            regular_fields = {}
            
            for key, value in submission_data.items():
                # Check if it's a file/media field
                if key.lower().endswith(('_file', '_upload', '_image', '_document', '_photo')):
                    media_files.append({
                        'field_name': key.replace('_', ' ').title(),
                        'original_field': key,
                        'value': value
                    })
                else:
                    regular_fields[key] = value
            
            # Add to combined bio data organized by form
            if regular_fields:
                if form_template.name not in combined_bio_data:
                    combined_bio_data[form_template.name] = {
                        'form_type': form_template.form_type.value,
                        'submitted_at': submission.submitted_at,
                        'fields': []
                    }
                
                # Convert fields to array for better display
                for field_key, field_value in regular_fields.items():
                    combined_bio_data[form_template.name]['fields'].append({
                        'label': field_key.replace('_', ' ').title(),
                        'key': field_key,
                        'value': field_value
                    })
            
            # Add to submissions list
            submissions_data.append({
                'id': submission.id,
                'form_name': form_template.name,
                'form_type': form_template.form_type.value,
                'submitted_at': submission.submitted_at,
                'status': submission.status.value,
                'data': regular_fields,
                'media_files': media_files
            })
        
        # Get booking history for this contact
        booking_history = db.query(Booking).filter(
            Booking.contact_id == contact.id,
            Booking.id != booking.id
        ).order_by(Booking.start_time.desc()).limit(5).all()
        
        history_data = []
        for b in booking_history:
            hist_service = db.query(Service).filter(Service.id == b.service_id).first()
            history_data.append({
                'id': b.id,
                'service_name': hist_service.name if hist_service else 'Unknown Service',
                'start_time': b.start_time,
                'status': b.status.value,
                'notes': b.notes
            })
        
        # Calculate customer stats
        total_bookings = db.query(func.count(Booking.id)).filter(
            Booking.contact_id == contact.id
        ).scalar() or 0
        
        completed_bookings = db.query(func.count(Booking.id)).filter(
            Booking.contact_id == contact.id,
            Booking.status == BookingStatus.COMPLETED
        ).scalar() or 0
        
        no_show_count = db.query(func.count(Booking.id)).filter(
            Booking.contact_id == contact.id,
            Booking.status == BookingStatus.NO_SHOW
        ).scalar() or 0
        
        result.append({
            # Booking details
            'booking_id': booking.id,
            'start_time': booking.start_time,
            'end_time': booking.end_time,
            'status': booking.status.value,
            'notes': booking.notes,
            'service': {
                'id': service.id if service else None,
                'name': service.name if service else 'Unknown Service',
                'duration': service.duration_minutes if service else 0,
                'location': getattr(service, 'location', None) if service else None,
                'price': getattr(service, 'price', None) if service else None,
            },
            
            # Contact details
            'contact': {
                'id': contact.id,
                'name': contact.name,
                'email': contact.email,
                'phone': contact.phone,
                'source': contact.source,
                'notes': contact.notes,
                'created_at': contact.created_at,
            },
            
            # NEW: Combined bio data organized by form
            'combined_bio_data': combined_bio_data,
            
            # Form submissions (detailed)
            'form_submissions': submissions_data,
            
            # Booking history
            'booking_history': history_data,
            
            # Customer statistics
            'customer_stats': {
                'total_bookings': total_bookings,
                'completed_bookings': completed_bookings,
                'no_show_count': no_show_count,
                'completion_rate': round((completed_bookings / total_bookings * 100), 1) if total_bookings > 0 else 0,
                'customer_since': contact.created_at,
                'days_as_customer': (datetime.utcnow() - contact.created_at).days,
            }
        })
    
    return result


