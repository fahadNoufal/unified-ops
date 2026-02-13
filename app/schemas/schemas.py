from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# ===== AUTH SCHEMAS =====
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

# ===== USER SCHEMAS =====
class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str

class StaffCreate(BaseModel):
    email: EmailStr
    full_name: str
    permissions: List[str] = []

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    role: str
    workspace_id: Optional[int]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ===== DASHBOARD ANALYTICS =====
class SevenDayBookingData(BaseModel):
    day: str
    date: int
    count: int
    is_today: bool

class AnalyticsResponse(BaseModel):
    today_bookings: int
    today_bookings_trend: float
    active_leads_week: int
    active_leads_week_trend: float
    active_leads_month: int
    active_leads_month_trend: float
    conversion_rate: float
    conversion_rate_trend: float
    pending_forms: int
    pending_forms_trend: float
    overdue_forms: int
    completion_rate: float
    completion_rate_trend: float
    seven_day_bookings: List[SevenDayBookingData]
    
    class Config:
        from_attributes = True

# ===== WORKSPACE SCHEMAS =====
class WorkspaceCreate(BaseModel):
    name: str
    business_address: Optional[str] = None
    timezone: str = "UTC"
    contact_email: EmailStr
    contact_phone: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    business_address: Optional[str] = None
    timezone: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    email_provider: Optional[str] = None
    email_api_key: Optional[str] = None
    working_hours: Optional[Dict[str, Any]] = None
    lunch_break: Optional[Dict[str, Any]] = None
    buffer_time_minutes: Optional[int] = None
    max_bookings_per_slot: Optional[int] = None

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    slug: str
    business_address: Optional[str]
    timezone: str
    contact_email: str
    contact_phone: Optional[str]
    is_active: bool
    onboarding_completed: bool
    has_dummy_data: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
        

# ===== CONTACT SCHEMAS =====
class ContactCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = "api"

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

class ContactResponse(BaseModel):
    id: int
    workspace_id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    notes: Optional[str]
    source: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# ===== SERVICE SCHEMAS =====
class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int
    location: Optional[str] = None
    max_bookings_per_slot: Optional[int] = None
    buffer_time_minutes: Optional[int] = None

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None
    max_bookings_per_slot: Optional[int] = None
    buffer_time_minutes: Optional[int] = None

class ServiceResponse(BaseModel):
    id: int
    workspace_id: int
    name: str
    description: Optional[str]
    duration_minutes: int
    location: Optional[str]
    is_active: bool
    max_bookings_per_slot: Optional[int]
    buffer_time_minutes: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True

# ===== BOOKING SCHEMAS =====
class BookingCreate(BaseModel):
    service_id: int
    start_time: datetime
    notes: Optional[str] = None
    contact_id : Optional[int] = None  # For internal bookings with known contacts
    # For public bookings (no contact_id)
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None

class BookingUpdate(BaseModel):
    start_time: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None

class BookingResponse(BaseModel):
    id: int
    workspace_id: int
    contact_id: int
    service_id: int
    start_time: datetime
    end_time: datetime
    status: str
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class BookingDetailResponse(BookingResponse):
    contact: ContactResponse
    service: ServiceResponse

# ===== FORM SCHEMAS =====
class FormFieldSchema(BaseModel):
    id: str
    type: str  # text, email, phone, textarea, dropdown, file, etc.
    label: str
    required: bool = False
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None  # For dropdown/radio
    conditions: Optional[Dict[str, Any]] = None  # Conditional logic

class FormTemplateCreate(BaseModel):
    name: str
    form_type: str  # pre_booking, post_booking, contact
    description: Optional[str] = None
    fields: List[FormFieldSchema]

class FormTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    fields: Optional[List[FormFieldSchema]] = None
    is_active: Optional[bool] = None

class FormTemplateResponse(BaseModel):
    id: int
    workspace_id: int
    name: str
    form_type: str
    description: Optional[str]
    fields: List[Dict[str, Any]]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class FormSubmissionCreate(BaseModel):
    submission_data: Dict[str, Any]

class FormSubmissionResponse(BaseModel):
    id: int
    form_template_id: int
    contact_id: int
    booking_id: Optional[int]
    submission_token: str
    submission_data: Optional[Dict[str, Any]]
    status: str
    sent_at: Optional[datetime]
    submitted_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True
        
        
class FormFieldBase(BaseModel):
    """Base schema for form field"""
    label: str
    field_type: str  # "text", "email", "textarea", "select", "checkbox", etc.
    required: Optional[bool] = False
    options: Optional[List[str]] = None  # For select/radio fields
    placeholder: Optional[str] = None
    help_text: Optional[str] = None


class FormTemplateUpdate(BaseModel):
    """Schema for updating form template"""
    name: Optional[str] = None
    form_type: Optional[str] = None  # "intake", "questionnaire", "consent", "custom"
    description: Optional[str] = None
    fields: Optional[List[FormFieldBase]] = None
    is_active: Optional[bool] = None
    
    class Config:
        from_attributes = True

# ===== INVENTORY SCHEMAS =====
class InventoryItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    current_stock: int = 0
    threshold: int = 10
    inventory_type: str = "manual"  # auto_deduct or manual
    supplier_email: Optional[EmailStr] = None
    unit: Optional[str] = "pcs"

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    current_stock: Optional[int] = None
    threshold: Optional[int] = None
    inventory_type: Optional[str] = None
    supplier_email: Optional[EmailStr] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None

class InventoryItemResponse(BaseModel):
    id: int
    workspace_id: int
    name: str
    description: Optional[str]
    current_stock: int
    threshold: int
    inventory_type: str
    supplier_email: Optional[str]
    unit: Optional[str]
    is_active: bool
    alert_sent_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

class InventoryTransactionCreate(BaseModel):
    inventory_item_id: int
    quantity_change: int
    transaction_type: str  # booking, manual_add, manual_deduct, adjustment
    notes: Optional[str] = None

# ===== EMAIL TEMPLATE SCHEMAS =====
class EmailTemplateCreate(BaseModel):
    template_type: str  # welcome, booking_confirmation, etc.
    subject: str
    body: str
    variables: Optional[List[str]] = []

class EmailTemplateUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    is_active: Optional[bool] = None

class EmailTemplateResponse(BaseModel):
    id: int
    workspace_id: int
    template_type: str
    subject: str
    body: str
    variables: Optional[List[str]]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# ===== MESSAGE SCHEMAS =====
class MessageCreate(BaseModel):
    content: str
    channel: str = "email"  # email, sms, system

class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: Optional[int]
    content: str
    channel: str
    is_from_customer: bool
    is_automated: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: int
    contact_id: int
    last_message_at: datetime
    unread_count: int
    is_active: bool
    contact: ContactResponse
    messages: List[MessageResponse] = []
    
    class Config:
        from_attributes = True

# ===== DASHBOARD SCHEMAS =====
class DashboardStats(BaseModel):
    today_bookings: int
    upcoming_bookings: int
    completed_bookings: int
    no_show_bookings: int
    new_inquiries: int
    ongoing_conversations: int
    unanswered_messages: int
    pending_forms: int
    overdue_forms: int
    completed_forms: int
    low_stock_items: int
    total_contacts: int

class BookingSummary(BaseModel):
    id: int
    contact_name: str
    service_name: str
    start_time: datetime
    status: str

class InventorySummary(BaseModel):
    id: int
    name: str
    current_stock: int
    threshold: int
    unit: str
    is_below_threshold: bool

class DashboardResponse(BaseModel):
    stats: DashboardStats
    today_bookings: List[BookingSummary]
    upcoming_bookings: List[BookingSummary]
    low_stock_items: List[InventorySummary]

# ===== AVAILABILITY SCHEMAS =====
class AvailabilitySlot(BaseModel):
    start_time: datetime
    end_time: datetime
    available_spots: int
    total_spots: int

class AvailabilityResponse(BaseModel):
    date: str
    slots: List[AvailabilitySlot]

# ===== PUBLIC FORMS =====
class PublicLeadCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    message: Optional[str] = None

# ===== INTEGRATION TEST =====
class EmailTestRequest(BaseModel):
    test_email: EmailStr