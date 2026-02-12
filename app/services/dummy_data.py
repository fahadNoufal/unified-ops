from datetime import datetime, timedelta
import random
from sqlalchemy.orm import Session
from app.models.models import (
    Contact, Service, Booking, BookingStatus, FormTemplate, FormType,
    InventoryItem, InventoryType, EmailTemplate, EmailTemplateType,
    Conversation, Message, MessageChannel, LeadTracking, FormSubmission,
    FormSubmissionStatus, InventoryTransaction
)

class DummyDataGenerator:
    """Generate realistic dummy data for demo purposes"""
    
    def __init__(self, workspace_id: int):
        self.workspace_id = workspace_id
    
    def generate_contacts(self, db: Session, count: int = 15):
        """Generate dummy contacts"""
        first_names = ["John", "Jane", "Michael", "Sarah", "David", "Emma", "Robert", "Lisa", "James", "Emily"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
        
        contacts = []
        for i in range(count):
            first = random.choice(first_names)
            last = random.choice(last_names)
            
            contact = Contact(
                workspace_id=self.workspace_id,
                name=f"{first} {last}",
                email=f"{first.lower()}.{last.lower()}{i}@example.com",
                phone=f"+1{random.randint(200, 999)}{random.randint(100, 999)}{random.randint(1000, 9999)}",
                source=random.choice(["api", "contact_form", "booking_form"]),
                created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30))
            )
            db.add(contact)
            db.flush()
            
            # Create conversation
            conversation = Conversation(
                contact_id=contact.id,
                created_at=contact.created_at
            )
            db.add(conversation)
            
            # Create lead tracking
            tracking = LeadTracking(
                contact_id=contact.id,
                lead_captured_at=contact.created_at
            )
            db.add(tracking)
            
            contacts.append(contact)
        
        db.commit()
        return contacts
    
    def generate_services(self, db: Session):
        """Generate dummy services"""
        services_data = [
            {
                "name": "Consultation",
                "description": "30-minute consultation session",
                "duration_minutes": 30,
                "location": "123 Main St, Suite 100"
            },
            {
                "name": "Full Service",
                "description": "Comprehensive 60-minute service",
                "duration_minutes": 60,
                "location": "123 Main St, Suite 100"
            },
            {
                "name": "Quick Check",
                "description": "15-minute quick check appointment",
                "duration_minutes": 15,
                "location": "123 Main St, Suite 100"
            }
        ]
        
        services = []
        for data in services_data:
            service = Service(
                workspace_id=self.workspace_id,
                **data,
                is_active=True,
                max_bookings_per_slot=2
            )
            db.add(service)
            db.flush()
            services.append(service)
        
        db.commit()
        return services
    
    def generate_bookings(self, db: Session, contacts, services, count: int = 20):
        """Generate dummy bookings"""
        statuses = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.PENDING, BookingStatus.NO_SHOW]
        weights = [0.5, 0.3, 0.15, 0.05]
        
        bookings = []
        for i in range(count):
            contact = random.choice(contacts)
            service = random.choice(services)
            
            # Generate booking time (past, today, or future)
            days_offset = random.randint(-7, 14)
            start_hour = random.randint(9, 16)
            start_time = datetime.utcnow().replace(hour=start_hour, minute=0, second=0, microsecond=0) + timedelta(days=days_offset)
            end_time = start_time + timedelta(minutes=service.duration_minutes)
            
            # Determine status based on time
            if start_time < datetime.utcnow() - timedelta(hours=1):
                status = random.choices([BookingStatus.COMPLETED, BookingStatus.NO_SHOW], weights=[0.9, 0.1])[0]
            elif start_time < datetime.utcnow():
                status = BookingStatus.CONFIRMED
            else:
                status = random.choices([BookingStatus.CONFIRMED, BookingStatus.PENDING], weights=[0.8, 0.2])[0]
            
            booking = Booking(
                workspace_id=self.workspace_id,
                contact_id=contact.id,
                service_id=service.id,
                start_time=start_time,
                end_time=end_time,
                status=status,
                confirmation_sent_at=start_time - timedelta(hours=1) if status != BookingStatus.PENDING else None,
                created_at=start_time - timedelta(days=1)
            )
            db.add(booking)
            bookings.append(booking)
        
        db.commit()
        return bookings
    
    def generate_form_templates(self, db: Session):
        """Generate dummy form templates"""
        templates_data = [
            {
                "name": "Contact Information Form",
                "form_type": FormType.CONTACT,
                "description": "Basic contact information",
                "fields": [
                    {"id": "field_1", "type": "text", "label": "Full Name", "required": True},
                    {"id": "field_2", "type": "email", "label": "Email", "required": True},
                    {"id": "field_3", "type": "phone", "label": "Phone", "required": False},
                    {"id": "field_4", "type": "textarea", "label": "Message", "required": False}
                ]
            },
            {
                "name": "Pre-Appointment Form",
                "form_type": FormType.POST_BOOKING,
                "description": "Information needed before appointment",
                "fields": [
                    {"id": "field_1", "type": "text", "label": "Emergency Contact Name", "required": True},
                    {"id": "field_2", "type": "phone", "label": "Emergency Contact Phone", "required": True},
                    {"id": "field_3", "type": "textarea", "label": "Medical History", "required": False},
                    {"id": "field_4", "type": "file", "label": "Insurance Card", "required": False}
                ]
            }
        ]
        
        templates = []
        for data in templates_data:
            template = FormTemplate(
                workspace_id=self.workspace_id,
                **data,
                is_active=True
            )
            db.add(template)
            templates.append(template)
        
        db.commit()
        return templates
    
    def generate_inventory_items(self, db: Session):
        """Generate dummy inventory items"""
        items_data = [
            {"name": "Towels", "current_stock": 45, "threshold": 20, "unit": "pcs", "type": InventoryType.AUTO_DEDUCT},
            {"name": "Cleaning Supplies", "current_stock": 8, "threshold": 10, "unit": "bottles", "type": InventoryType.MANUAL},
            {"name": "Paper Products", "current_stock": 15, "threshold": 15, "unit": "packs", "type": InventoryType.MANUAL},
            {"name": "Hand Sanitizer", "current_stock": 5, "threshold": 12, "unit": "bottles", "type": InventoryType.MANUAL},
        ]
        
        items = []
        for data in items_data:
            item = InventoryItem(
                workspace_id=self.workspace_id,
                name=data["name"],
                current_stock=data["current_stock"],
                threshold=data["threshold"],
                unit=data["unit"],
                inventory_type=data["type"],
                supplier_email="supplier@example.com",
                is_active=True
            )
            db.add(item)
            items.append(item)
        
        db.commit()
        return items
    
    def generate_messages(self, db: Session, contacts, count: int = 30):
        """Generate dummy messages in conversations"""
        messages = []
        for contact in random.sample(contacts, min(count, len(contacts))):
            if not contact.conversation:
                continue
            
            # System welcome message
            msg1 = Message(
                conversation_id=contact.conversation.id,
                content=f"Welcome {contact.name}! Thank you for contacting us.",
                channel=MessageChannel.SYSTEM,
                is_from_customer=False,
                is_automated=True,
                created_at=contact.created_at
            )
            db.add(msg1)
            
            # Customer message
            msg2 = Message(
                conversation_id=contact.conversation.id,
                content="Hi, I'd like to schedule an appointment.",
                channel=MessageChannel.EMAIL,
                is_from_customer=True,
                is_automated=False,
                created_at=contact.created_at + timedelta(minutes=5)
            )
            db.add(msg2)
            
            messages.extend([msg1, msg2])
        
        db.commit()
        return messages
    
    def generate_all(self, db: Session):
        """Generate all dummy data"""
        print(f"Generating dummy data for workspace {self.workspace_id}...")
        
        # Generate in order of dependencies
        contacts = self.generate_contacts(db, count=15)
        print(f"✓ Created {len(contacts)} contacts")
        
        services = self.generate_services(db)
        print(f"✓ Created {len(services)} services")
        
        bookings = self.generate_bookings(db, contacts, services, count=20)
        print(f"✓ Created {len(bookings)} bookings")
        
        templates = self.generate_form_templates(db)
        print(f"✓ Created {len(templates)} form templates")
        
        items = self.generate_inventory_items(db)
        print(f"✓ Created {len(items)} inventory items")
        
        messages = self.generate_messages(db, contacts, count=10)
        print(f"✓ Created {len(messages)} messages")
        
        print("✓ Dummy data generation complete!")
        
        return {
            "contacts": len(contacts),
            "services": len(services),
            "bookings": len(bookings),
            "form_templates": len(templates),
            "inventory_items": len(items),
            "messages": len(messages)
        }
