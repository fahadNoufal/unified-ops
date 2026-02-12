from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, ForeignKey, Enum, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

# Enums
class UserRole(str, enum.Enum):
    OWNER = "owner"
    STAFF = "staff"

class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"

class FormType(str, enum.Enum):
    PRE_BOOKING = "pre_booking"
    POST_BOOKING = "post_booking"
    CONTACT = "contact"

class FormSubmissionStatus(str, enum.Enum):
    PENDING = "pending"
    OPENED = "opened"
    COMPLETED = "completed"

class InventoryType(str, enum.Enum):
    AUTO_DEDUCT = "auto_deduct"
    MANUAL = "manual"

class MessageChannel(str, enum.Enum):
    EMAIL = "email"
    SMS = "sms"
    SYSTEM = "system"

class EmailTemplateType(str, enum.Enum):
    WELCOME = "welcome"
    BOOKING_CONFIRMATION = "booking_confirmation"
    POST_BOOKING_FORM = "post_booking_form"
    BOOKING_REMINDER = "booking_reminder"
    FORM_REMINDER = "form_reminder"
    INVENTORY_ALERT = "inventory_alert"
    STAFF_CREDENTIALS = "staff_credentials"

class AutomationTrigger(str, enum.Enum):
    LEAD_CAPTURED = "lead_captured"
    BOOKING_CREATED = "booking_created"
    BOOKING_REMINDER = "booking_reminder"
    FORM_NOT_COMPLETED = "form_not_completed"
    INVENTORY_LOW = "inventory_low"

# Association table for staff permissions
staff_permissions = Table(
    'staff_permissions', Base.metadata,
    Column('staff_id', Integer, ForeignKey('users.id', ondelete='CASCADE')),
    Column('permission', String(50))
)

# User model
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    workspace_id = Column(Integer, ForeignKey('workspaces.id', ondelete='CASCADE'))
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="users")
    messages_sent = relationship("Message", back_populates="sender")

# Workspace model
class Workspace(Base):
    __tablename__ = "workspaces"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    business_address = Column(Text)
    timezone = Column(String(50), default="UTC")
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(50))
    email_provider = Column(String(50))
    email_api_key = Column(String(500))
    sms_provider = Column(String(50))
    sms_api_key = Column(String(500))
    is_active = Column(Boolean, default=False)
    onboarding_completed = Column(Boolean, default=False)
    has_dummy_data = Column(Boolean, default=False)
    working_hours = Column(JSON)
    lunch_break = Column(JSON)
    buffer_time_minutes = Column(Integer, default=0)
    max_bookings_per_slot = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    users = relationship("User", back_populates="workspace", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="workspace", cascade="all, delete-orphan")
    services = relationship("Service", back_populates="workspace", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="workspace", cascade="all, delete-orphan")
    form_templates = relationship("FormTemplate", back_populates="workspace", cascade="all, delete-orphan")
    inventory_items = relationship("InventoryItem", back_populates="workspace", cascade="all, delete-orphan")
    email_templates = relationship("EmailTemplate", back_populates="workspace", cascade="all, delete-orphan")
    automation_rules = relationship("AutomationRule", back_populates="workspace", cascade="all, delete-orphan")

# Contact model
class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    notes = Column(Text)
    source = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="contacts")
    conversation = relationship("Conversation", back_populates="contact", uselist=False, cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="contact", cascade="all, delete-orphan")
    form_submissions = relationship("FormSubmission", back_populates="contact", cascade="all, delete-orphan")
    lead_tracking = relationship("LeadTracking", back_populates="contact", uselist=False, cascade="all, delete-orphan")

# Conversation model
class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey('contacts.id', ondelete='CASCADE'), unique=True, nullable=False)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    unread_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    contact = relationship("Contact", back_populates="conversation")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")

# Message model
class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    sender_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))
    content = Column(Text, nullable=False)
    channel = Column(Enum(MessageChannel), default=MessageChannel.SYSTEM)
    is_from_customer = Column(Boolean, default=False)
    is_automated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="messages_sent")

# Service model
class Service(Base):
    __tablename__ = "services"
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    duration_minutes = Column(Integer, nullable=False)
    location = Column(String(255))
    is_active = Column(Boolean, default=True)
    max_bookings_per_slot = Column(Integer)
    buffer_time_minutes = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="services")
    bookings = relationship("Booking", back_populates="service", cascade="all, delete-orphan")
    inventory_links = relationship("ServiceInventoryLink", back_populates="service", cascade="all, delete-orphan")
    post_booking_forms = relationship("ServiceFormLink", back_populates="service", cascade="all, delete-orphan")

# Booking model
class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    contact_id = Column(Integer, ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    service_id = Column(Integer, ForeignKey('services.id', ondelete='CASCADE'), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING)
    notes = Column(Text)
    cancellation_reason = Column(Text)
    confirmation_sent_at = Column(DateTime)
    reminder_sent_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="bookings")
    contact = relationship("Contact", back_populates="bookings")
    service = relationship("Service", back_populates="bookings")
    form_submissions = relationship("FormSubmission", back_populates="booking", cascade="all, delete-orphan")

# FormTemplate model
class FormTemplate(Base):
    __tablename__ = "form_templates"
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    form_type = Column(Enum(FormType), nullable=False)
    description = Column(Text)
    fields = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="form_templates")
    submissions = relationship("FormSubmission", back_populates="form_template", cascade="all, delete-orphan")
    service_links = relationship("ServiceFormLink", back_populates="form_template", cascade="all, delete-orphan")

# ServiceFormLink model
class ServiceFormLink(Base):
    __tablename__ = "service_form_links"
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey('services.id', ondelete='CASCADE'), nullable=False)
    form_template_id = Column(Integer, ForeignKey('form_templates.id', ondelete='CASCADE'), nullable=False)
    send_after_booking = Column(Boolean, default=True)
    deadline_hours = Column(Integer, default=48)
    
    service = relationship("Service", back_populates="post_booking_forms")
    form_template = relationship("FormTemplate", back_populates="service_links")

# FormSubmission model
class FormSubmission(Base):
    __tablename__ = "form_submissions"
    id = Column(Integer, primary_key=True, index=True)
    form_template_id = Column(Integer, ForeignKey('form_templates.id', ondelete='CASCADE'), nullable=False)
    contact_id = Column(Integer, ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    booking_id = Column(Integer, ForeignKey('bookings.id', ondelete='CASCADE'))
    submission_token = Column(String(255), unique=True, index=True, nullable=False)
    submission_data = Column(JSON)
    status = Column(Enum(FormSubmissionStatus), default=FormSubmissionStatus.PENDING)
    sent_at = Column(DateTime)
    opened_at = Column(DateTime)
    submitted_at = Column(DateTime)
    reminder_sent_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    form_template = relationship("FormTemplate", back_populates="submissions")
    contact = relationship("Contact", back_populates="form_submissions")
    booking = relationship("Booking", back_populates="form_submissions")

# InventoryItem model
class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    current_stock = Column(Integer, default=0)
    threshold = Column(Integer, default=10)
    inventory_type = Column(Enum(InventoryType), default=InventoryType.MANUAL)
    supplier_email = Column(String(255))
    unit = Column(String(50))
    alert_sent_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="inventory_items")
    service_links = relationship("ServiceInventoryLink", back_populates="inventory_item", cascade="all, delete-orphan")
    transactions = relationship("InventoryTransaction", back_populates="inventory_item", cascade="all, delete-orphan")

# ServiceInventoryLink model
class ServiceInventoryLink(Base):
    __tablename__ = "service_inventory_links"
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey('services.id', ondelete='CASCADE'), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey('inventory_items.id', ondelete='CASCADE'), nullable=False)
    quantity_per_booking = Column(Integer, default=1)
    
    service = relationship("Service", back_populates="inventory_links")
    inventory_item = relationship("InventoryItem", back_populates="service_links")

# InventoryTransaction model
class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    id = Column(Integer, primary_key=True, index=True)
    inventory_item_id = Column(Integer, ForeignKey('inventory_items.id', ondelete='CASCADE'), nullable=False)
    quantity_change = Column(Integer, nullable=False)
    transaction_type = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    inventory_item = relationship("InventoryItem", back_populates="transactions")

# EmailTemplate model
class EmailTemplate(Base):
    __tablename__ = "email_templates"
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    template_type = Column(Enum(EmailTemplateType), nullable=False)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    variables = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="email_templates")

# AutomationRule model
class AutomationRule(Base):
    __tablename__ = "automation_rules"
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    trigger = Column(Enum(AutomationTrigger), nullable=False)
    action = Column(String(100), nullable=False)
    delay_hours = Column(Integer, default=0)
    email_template_id = Column(Integer, ForeignKey('email_templates.id', ondelete='SET NULL'))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="automation_rules")

# LeadTracking model
class LeadTracking(Base):
    __tablename__ = "lead_tracking"
    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey('contacts.id', ondelete='CASCADE'), unique=True, nullable=False)
    lead_captured_at = Column(DateTime, default=datetime.utcnow)
    booking_link_sent_at = Column(DateTime)
    booking_link_reminder_sent_at = Column(DateTime)
    booking_created_at = Column(DateTime)
    post_form_sent_at = Column(DateTime)
    post_form_reminder_sent_at = Column(DateTime)
    post_form_completed_at = Column(DateTime)
    status = Column(String(50), default="lead_captured")
    
    contact = relationship("Contact", back_populates="lead_tracking")

# AuditLog model
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))
    action = Column(String(255), nullable=False)
    entity_type = Column(String(100))
    entity_id = Column(Integer)
    details = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
