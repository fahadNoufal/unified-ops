"""
Comprehensive API Endpoints for Unified Operations Platform
All routes in one file for simplicity
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import secrets
import string

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
from app.services.email_service import email_service
from app.services.automation_service import automation_service
from app.services.dummy_data import DummyDataGenerator
from app.core.config import settings

router = APIRouter()

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
    
    username = user_data.email
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
    
    access_token = create_access_token(data={"sub": str(user.id)})
    
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
    
    print(user)
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    
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
    workspace = db.query(Workspace).filter(Workspace.id == current_user.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
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
    
    workspace.is_active = True
    workspace.onboarding_completed = True
    db.commit()
    
    return {"message": "Workspace activated"}

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
    data: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create contact"""
    contact = Contact(workspace_id=current_user.workspace_id, **data.dict())
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
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    end_time = data.start_time + timedelta(minutes=service.duration_minutes)
    
    booking = Booking(
        workspace_id=current_user.workspace_id,
        contact_id=data.contact_id,
        service_id=data.service_id,
        start_time=data.start_time,
        end_time=end_time,
        notes=data.notes,
        status=BookingStatus.CONFIRMED
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    
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

# Edit forms
@router.put("/forms/{form_id}", response_model=FormTemplateResponse)
async def update_form(
    form_id: int,
    data: FormTemplateUpdate,
    current_user: User = Depends(get_current_owner), # Only owners should edit form structure
    db: Session = Depends(get_db)
):
    """Update a form template"""
    # 1. Find the form and ensure it belongs to the user's workspace
    form = db.query(FormTemplate).filter(
        FormTemplate.id == form_id,
        FormTemplate.workspace_id == current_user.workspace_id
    ).first()

    if not form:
        raise HTTPException(status_code=404, detail="Form template not found")

    # 2. Update fields if provided
    update_data = data.dict(exclude_unset=True)
    
    if "fields" in update_data:
        # Convert Pydantic field models back to plain dicts for JSON storage
        update_data["fields"] = [field if isinstance(field, dict) else field.dict() 
                                 for field in update_data["fields"]]

    for key, value in update_data.items():
        setattr(form, key, value)

    db.commit()
    db.refresh(form)
    return form

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
    
    db.refresh(item)
    
    # 3. Low Stock Alert Logic
    # We only send an alert if the stock just dropped below or hit the threshold
    if item.current_stock <= item.threshold:
        try:
            # You can send this to the current_user (owner) 
            # or use item.supplier_email if you want to notify the supplier
            await email_service.send_low_stock_alert(
                recipient_email=item.supplier_email,
                item_name=item.name,
                current_stock=item.current_stock,
                threshold=item.threshold
            )
            print(f"📧 Low stock alert sent for {item.name}")
        except Exception as e:
            # We use a try-except so a failed email doesn't crash the transaction
            print(f"❌ Failed to send low stock email: {str(e)}")
    
    return {
        "message": "Transaction recorded", 
        "new_stock": item.current_stock,
        "low_stock_warning": item.current_stock <= item.threshold
    }

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
            body=data.content
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
    
    username = f"{data.full_name.replace(' ', '_').lower()}_{workspace.slug}"
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

@router.post("/public/leads/{workspace_slug}", response_model=ContactResponse)
async def capture_lead(
    workspace_slug: str,
    data: PublicLeadCreate,
    db: Session = Depends(get_db)
):
    """Public lead capture endpoint"""
    workspace = db.query(Workspace).filter(Workspace.slug == workspace_slug).first()
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
    workspace = db.query(Workspace).filter(Workspace.slug == workspace_slug).first()
    if not workspace or not workspace.is_active:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return {
        "name": workspace.name,
        "slug": workspace.slug,
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
    workspace = db.query(Workspace).filter(Workspace.slug == workspace_slug).first()
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
    workspace = db.query(Workspace).filter(Workspace.slug == workspace_slug).first()
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
    workspace = db.query(Workspace).filter(Workspace.slug == workspace_slug).first()
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