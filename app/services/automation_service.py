from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import (
    AutomationRule, AutomationTrigger, Contact, Booking, 
    FormSubmission, LeadTracking, EmailTemplate, EmailTemplateType
)
from app.services.email_service import email_service
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class AutomationService:
    """Handle automated actions based on triggers"""
    
    async def trigger_lead_captured(self, db: Session, contact: Contact):
        """Execute automation when a lead is captured"""
        try:
            # Get automation rules
            rules = db.query(AutomationRule).filter(
                AutomationRule.workspace_id == contact.workspace_id,
                AutomationRule.trigger == AutomationTrigger.LEAD_CAPTURED,
                AutomationRule.is_active == True
            ).all()
            
            for rule in rules:
                if rule.action == "send_email":
                    # Send welcome email with booking link
                    workspace = contact.workspace
                    booking_link = f"{settings.FRONTEND_URL}/book/{workspace.slug}"
                    
                    if contact.email:
                        await email_service.send_welcome_email(
                            to_email=contact.email,
                            customer_name=contact.name,
                            business_name=workspace.name,
                            booking_link=booking_link
                        )
                        
                        # Update lead tracking
                        tracking = contact.lead_tracking
                        if tracking:
                            tracking.booking_link_sent_at = datetime.utcnow()
                            tracking.status = "booking_link_sent"
                            db.commit()
            
            logger.info(f"Lead captured automation executed for contact {contact.id}")
        except Exception as e:
            logger.error(f"Error in lead_captured automation: {str(e)}")
            db.rollback()
    
    async def trigger_booking_created(self, db: Session, booking: Booking):
        """Execute automation when a booking is created"""
        try:
            rules = db.query(AutomationRule).filter(
                AutomationRule.workspace_id == booking.workspace_id,
                AutomationRule.trigger == AutomationTrigger.BOOKING_CREATED,
                AutomationRule.is_active == True
            ).all()
            
            for rule in rules:
                if rule.action == "send_email":
                    # Send booking confirmation
                    contact = booking.contact
                    service = booking.service
                    
                    if contact.email:
                        await email_service.send_booking_confirmation(
                            to_email=contact.email,
                            customer_name=contact.name,
                            service_name=service.name,
                            date=booking.start_time.strftime("%B %d, %Y"),
                            time=booking.start_time.strftime("%I:%M %p"),
                            location=service.location or "TBD"
                        )
                        
                        booking.confirmation_sent_at = datetime.utcnow()
                        
                        # Update lead tracking
                        tracking = contact.lead_tracking
                        if tracking:
                            tracking.booking_created_at = datetime.utcnow()
                            tracking.status = "booking_created"
                        
                        db.commit()
            
            logger.info(f"Booking created automation executed for booking {booking.id}")
        except Exception as e:
            logger.error(f"Error in booking_created automation: {str(e)}")
            db.rollback()
    
    async def send_booking_reminders(self, db: Session):
        """Send reminders for upcoming bookings (run by scheduler)"""
        try:
            # Get bookings in the next 24 hours that haven't been reminded
            tomorrow = datetime.utcnow() + timedelta(hours=24)
            
            bookings = db.query(Booking).filter(
                Booking.start_time <= tomorrow,
                Booking.start_time > datetime.utcnow(),
                Booking.reminder_sent_at == None,
                Booking.status.in_(["pending", "confirmed"])
            ).all()
            
            for booking in bookings:
                contact = booking.contact
                if contact.email:
                    # Send reminder email
                    subject = f"Reminder: Upcoming appointment"
                    body = f"""
                    <html>
                    <body>
                    <h2>Appointment Reminder</h2>
                    <p>Hello {contact.name},</p>
                    <p>This is a reminder that you have an appointment scheduled:</p>
                    <ul>
                        <li><strong>Service:</strong> {booking.service.name}</li>
                        <li><strong>Date:</strong> {booking.start_time.strftime("%B %d, %Y")}</li>
                        <li><strong>Time:</strong> {booking.start_time.strftime("%I:%M %p")}</li>
                    </ul>
                    <p>We look forward to seeing you!</p>
                    </body>
                    </html>
                    """
                    
                    await email_service.send_email(contact.email, subject, body)
                    booking.reminder_sent_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"Sent {len(bookings)} booking reminders")
        except Exception as e:
            logger.error(f"Error sending booking reminders: {str(e)}")
            db.rollback()
    
    async def send_form_reminders(self, db: Session):
        """Send reminders for incomplete forms (run by scheduler)"""
        try:
            # Get forms not completed after 48 hours
            deadline = datetime.utcnow() - timedelta(hours=48)
            
            submissions = db.query(FormSubmission).filter(
                FormSubmission.status != "completed",
                FormSubmission.sent_at <= deadline,
                FormSubmission.reminder_sent_at == None
            ).all()
            
            for submission in submissions:
                contact = submission.contact
                if contact.email:
                    form_link = f"{settings.FRONTEND_URL}/forms/submit/{submission.submission_token}"
                    
                    await email_service.send_form_email(
                        to_email=contact.email,
                        customer_name=contact.name,
                        form_name=submission.form_template.name,
                        form_link=form_link,
                        deadline="ASAP"
                    )
                    
                    submission.reminder_sent_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"Sent {len(submissions)} form reminders")
        except Exception as e:
            logger.error(f"Error sending form reminders: {str(e)}")
            db.rollback()
    
    async def check_inventory_alerts(self, db: Session):
        """Check inventory levels and send alerts (run by scheduler)"""
        try:
            from app.models.models import InventoryItem
            
            # Get all low stock items
            items = db.query(InventoryItem).filter(
                InventoryItem.current_stock <= InventoryItem.threshold,
                InventoryItem.is_active == True
            ).all()
            
            for item in items:
                # Check if alert was recently sent (within last 24 hours)
                if item.alert_sent_at:
                    if (datetime.utcnow() - item.alert_sent_at).total_seconds() < 86400:
                        continue
                
                workspace = item.workspace
                
                # Send to business owner
                await email_service.send_inventory_alert(
                    to_email=workspace.contact_email,
                    item_name=item.name,
                    current_stock=item.current_stock,
                    threshold=item.threshold
                )
                
                # Send to supplier if provided
                if item.supplier_email:
                    await email_service.send_inventory_alert(
                        to_email=item.supplier_email,
                        item_name=item.name,
                        current_stock=item.current_stock,
                        threshold=item.threshold
                    )
                
                item.alert_sent_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"Checked {len(items)} low stock items")
        except Exception as e:
            logger.error(f"Error checking inventory: {str(e)}")
            db.rollback()

automation_service = AutomationService()
