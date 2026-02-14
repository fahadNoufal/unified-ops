"""
EMAIL AUTOMATION SERVICE (Enhanced with Default Templates)
Handles all automated email sending based on triggers and events
Now includes automatic default template creation if none exist
"""

import os
from datetime import datetime, timedelta
from typing import Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import httpx

from app.models.models import (
    Contact, Booking, EmailTemplate, EmailTemplateType, 
    EmailLog, Workspace, FormTemplate
)
from app.services.chat_tokens import generate_chat_token



class EmailService:
    def __init__(self):
        self.fallback_api_key = os.getenv('RESEND_API_KEY')
        self.frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        self.resend_api_url = "https://api.resend.com/emails"
    
    def get_api_key(self, workspace: Workspace) -> str:
        """Get Resend API key - workspace key takes priority"""
        return workspace.email_api_key or self.fallback_api_key
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        workspace: Workspace,
        template_type: str = None,
        contact_id: int = None
    ) -> bool:
        """Send email via Resend API"""
        api_key = self.get_api_key(workspace)
        
        if not api_key:
            print(f"⚠️ No Resend API key configured for workspace {workspace.id}")
            return False
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.resend_api_url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        # "from": workspace.contact_email or "noreply@example.com",
                        "from": "onboarding@resend.dev",
                        "to": [to_email],
                        "subject": subject,
                        "html": html_body
                    }
                )
                
                success = response.status_code == 200
                
                if success:
                    print(f"✅ Email sent successfully to {to_email}")
                else:
                    print(f"❌ Email failed: {response.status_code} - {response.text}")
                
                return success
                
        except Exception as e:
            print(f"❌ Email send error: {str(e)}")
            return False
    
    def log_email(
        self,
        db: Session,
        workspace_id: int,
        contact_id: int,
        template_type: str,
        subject: str,
        status: str,
        related_booking_id: int = None,
        related_form_id: int = None
    ):
        """Log email sending attempt"""
        log = EmailLog(
            workspace_id=workspace_id,
            contact_id=contact_id,
            template_type=template_type,
            subject=subject,
            status=status,
            sent_at=datetime.utcnow() if status == 'sent' else None,
            related_booking_id=related_booking_id,
            related_form_id=related_form_id
        )
        db.add(log)
        db.commit()
        return log
    
    def replace_variables(
        self,
        template: str,
        variables: Dict[str, str]
    ) -> str:
        """Replace template variables like {{customer_name}}"""
        for key, value in variables.items():
            placeholder = f"{{{{{key}}}}}"  # {{key}}
            template = template.replace(placeholder, str(value))
        return template
    
    # ========== DEFAULT TEMPLATE CREATION ==========
    
    def create_default_welcome_template(self, db: Session, workspace: Workspace) -> EmailTemplate:
        """Create default welcome email template"""
        template = EmailTemplate(
            workspace_id=workspace.id,
            template_type=EmailTemplateType.WELCOME,
            subject="Welcome to {{business_name}}!",
            body="""
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to {{business_name}}!</h1>
        </div>
        <div class="content">
            <p>Hi {{customer_name}},</p>
            
            <p>Thank you for joining us! We're excited to have you as part of our community.</p>
            
            <p>To get started, please complete your welcome form so we can serve you better:</p>
            
            <p style="text-align: center;">
                <a href="{{welcome_form_url}}" class="button">Complete Welcome Form</a>
            </p>
            
            <p>Or you can book your first appointment right away:</p>
            
            <p style="text-align: center;">
                <a href="{{booking_url}}" class="button">Book Appointment</a>
            </p>
            
            <p>Have any questions? Message us anytime:</p>

            <p style="text-align: center;">
                <a href="{{chat_url}}" class="button">💬 Message Us</a>
            </p>
            
            <p>Best regards,<br>The {{business_name}} Team</p>
        </div>
        <div class="footer">
            <p>© {{business_name}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
            """,
            is_active=True
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        print(f"✅ Created default welcome email template for workspace {workspace.id}")
        return template
    
    def create_default_booking_confirmation_template(self, db: Session, workspace: Workspace) -> EmailTemplate:
        """Create default booking confirmation template"""
        template = EmailTemplate(
            workspace_id=workspace.id,
            template_type=EmailTemplateType.BOOKING_CONFIRMATION,
            subject="Booking Confirmed - {{service_name}} on {{booking_date}}",
            body="""
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
        .booking-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
        .detail-label { font-weight: bold; color: #667eea; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ Booking Confirmed!</h1>
        </div>
        <div class="content">
            <p>Hi {{customer_name}},</p>
            
            <p>Great news! Your appointment has been confirmed.</p>
            
            <div class="booking-details">
                <h3>Appointment Details:</h3>
                <div class="detail-row">
                    <span class="detail-label">Service:</span>
                    <span>{{service_name}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span>{{booking_date}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span>{{booking_time}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Location:</span>
                    <span>{{location}}</span>
                </div>
            </div>
            
            <p>To help us prepare for your visit, please complete this pre-appointment form:</p>
            
            <p style="text-align: center;">
                <a href="{{pre_appointment_form_url}}" class="button">Complete Pre-Appointment Form</a>
            </p>
            
            <p>We look forward to seeing you!</p>
            
            <p>Best regards,<br>The {{business_name}} Team</p>
        </div>
        <div class="footer">
            <p>Need to reschedule? Please contact us as soon as possible.</p>
            <p>© {{business_name}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
            """,
            is_active=True
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        print(f"✅ Created default booking confirmation template for workspace {workspace.id}")
        return template
    
    def create_default_form_reminder_template(self, db: Session, workspace: Workspace) -> EmailTemplate:
        """Create default form reminder template"""
        template = EmailTemplate(
            workspace_id=workspace.id,
            template_type=EmailTemplateType.FORM_REMINDER,
            subject="Reminder: Please complete your {{form_name}}",
            body="""
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
        .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Friendly Reminder</h1>
        </div>
        <div class="content">
            <p>Hi {{customer_name}},</p>
            
            <p>This is a friendly reminder that we're still waiting for you to complete your <strong>{{form_name}}</strong>.</p>
            
            <p>Completing this form helps us provide you with the best possible service.</p>
            
            <p style="text-align: center;">
                <a href="{{form_url}}" class="button">Complete Form Now</a>
            </p>
            
            <p>It only takes a few minutes, and we'd really appreciate it!</p>
            
            <p>Thank you,<br>The {{business_name}} Team</p>
        </div>
        <div class="footer">
            <p>© {{business_name}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
            """,
            is_active=True
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        print(f"✅ Created default form reminder template for workspace {workspace.id}")
        return template
    
    def create_default_booking_reminder_template(self, db: Session, workspace: Workspace) -> EmailTemplate:
        """Create default booking reminder template"""
        template = EmailTemplate(
            workspace_id=workspace.id,
            template_type=EmailTemplateType.BOOKING_REMINDER,
            subject="Reminder: Appointment tomorrow at {{booking_time}}",
            body="""
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
        .reminder-box { background: #dcfce7; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
        .detail-label { font-weight: bold; color: #10b981; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Appointment Reminder</h1>
        </div>
        <div class="content">
            <p>Hi {{customer_name}},</p>
            
            <p>This is a friendly reminder about your upcoming appointment with us!</p>
            
            <div class="reminder-box">
                <h3>Your Appointment Details:</h3>
                <div class="detail-row">
                    <span class="detail-label">Service:</span>
                    <span>{{service_name}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span>{{booking_date}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span>{{booking_time}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Location:</span>
                    <span>{{location}}</span>
                </div>
            </div>
            
            <p><strong>Please arrive 10 minutes early</strong> to allow time for check-in.</p>
            
            <p>If you need to cancel or reschedule, please let us know as soon as possible.</p>
            
            <p>We're looking forward to seeing you!</p>
            
            <p>Best regards,<br>The {{business_name}} Team</p>
        </div>
        <div class="footer">
            <p>Need to cancel or reschedule? Please contact us immediately.</p>
            <p>© {{business_name}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
            """,
            is_active=True
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        print(f"✅ Created default booking reminder template for workspace {workspace.id}")
        return template
    
    def get_or_create_template(
        self,
        db: Session,
        workspace: Workspace,
        template_type: EmailTemplateType
    ) -> Optional[EmailTemplate]:
        """Get existing template or create default one"""
        # Try to find existing template
        template = db.query(EmailTemplate).filter(
            and_(
                EmailTemplate.workspace_id == workspace.id,
                EmailTemplate.template_type == template_type,
                EmailTemplate.is_active == True
            )
        ).first()
        
        # If not found, create default
        if not template:
            print(f"📧 No {template_type.value} template found for workspace {workspace.id}, creating default...")
            
            if template_type == EmailTemplateType.WELCOME:
                template = self.create_default_welcome_template(db, workspace)
            elif template_type == EmailTemplateType.BOOKING_CONFIRMATION:
                template = self.create_default_booking_confirmation_template(db, workspace)
            elif template_type == EmailTemplateType.FORM_REMINDER:
                template = self.create_default_form_reminder_template(db, workspace)
            elif template_type == EmailTemplateType.BOOKING_REMINDER:
                template = self.create_default_booking_reminder_template(db, workspace)
        
        return template
    
    # ========== AUTOMATED EMAIL FLOWS (Updated) ==========
    
    async def send_welcome_email(
        self,
        db: Session,
        contact: Contact,
        workspace: Workspace
    ):
        """
        FLOW STEP 1: Send welcome email to new lead
        Includes: welcome form link + booking link
        """
        # Get or create welcome email template
        
        template = self.get_or_create_template(db, workspace, EmailTemplateType.WELCOME)
        
        if not template:
            print(f"❌ Failed to get/create welcome email template")
            return False
        
        print('Getting or creating welcome email template...')
        # Find "welcome mail" form
        welcome_form = db.query(FormTemplate).filter(
            and_(
                FormTemplate.workspace_id == workspace.id,
                FormTemplate.name.ilike('%welcome%')
            )
        ).first()
        
        
        # Build URLs
        booking_url = f"{self.frontend_url}/book/{workspace.id}"
        welcome_form_url = f"{self.frontend_url}/public/forms/{workspace.id}/{welcome_form.id}" if welcome_form else booking_url
        
        print(contact.conversation)
        chat_token = generate_chat_token(contact.conversation.id)
        chat_url = f"{self.frontend_url}/chat/{chat_token}"
        print(chat_url)
        # Replace variables
        variables = {
            'customer_name': contact.name,
            'business_name': workspace.name,
            'welcome_form_url': welcome_form_url,
            'booking_url': booking_url,
            'chat_url': chat_url 
        }
        
        subject = self.replace_variables(template.subject, variables)
        body = self.replace_variables(template.body, variables)
        
        # Send email
        success = await self.send_email(
            to_email=contact.email,
            subject=subject,
            html_body=body,
            workspace=workspace,
            template_type='welcome',
            contact_id=contact.id
        )
        
        
        # Log email
        self.log_email(
            db=db,
            workspace_id=workspace.id,
            contact_id=contact.id,
            template_type='welcome',
            subject=subject,
            status='sent' if success else 'failed',
            related_form_id=welcome_form.id if welcome_form else None
        )
        
        return success
    
    async def send_booking_confirmation(
        self,
        db: Session,
        booking: Booking,
        contact: Contact,
        workspace: Workspace
    ):
        """
        FLOW STEP 3: Send booking confirmation
        Includes: booking details + pre-appointment form link
        """
        # Get or create booking confirmation template
        template = self.get_or_create_template(db, workspace, EmailTemplateType.BOOKING_CONFIRMATION)
        
        if not template:
            print(f"❌ Failed to get/create booking confirmation template")
            return False
        
        # Find "pre-appointment" form
        pre_form = db.query(FormTemplate).filter(
            and_(
                FormTemplate.workspace_id == workspace.id,
                or_(
                    FormTemplate.name.ilike('%pre%appointment%'),
                    FormTemplate.name.ilike('%pre-appointment%')
                )
            )
        ).first()
        
        # Get service details
        from app.models.models import Service
        service = db.query(Service).filter(Service.id == booking.service_id).first()
        
        # Build pre-appointment form URL
        pre_form_url = f"{self.frontend_url}/public/forms/{workspace.id}/{pre_form.id}" if pre_form else ""
        
        # Replace variables
        variables = {
            'customer_name': contact.name,
            'business_name': workspace.name,
            'booking_date': booking.start_time.strftime('%B %d, %Y'),
            'booking_time': booking.start_time.strftime('%I:%M %p'),
            'service_name': service.name if service else 'Your appointment',
            'location': workspace.business_address or 'To be confirmed',
            'pre_appointment_form_url': pre_form_url
        }
        
        subject = self.replace_variables(template.subject, variables)
        body = self.replace_variables(template.body, variables)
        
        # Send email
        success = await self.send_email(
            to_email=contact.email,
            subject=subject,
            html_body=body,
            workspace=workspace,
            template_type='booking_confirmation',
            contact_id=contact.id
        )
        
        # Log email
        self.log_email(
            db=db,
            workspace_id=workspace.id,
            contact_id=contact.id,
            template_type='booking_confirmation',
            subject=subject,
            status='sent' if success else 'failed',
            related_booking_id=booking.id,
            related_form_id=pre_form.id if pre_form else None
        )
        
        return success
    
    async def send_form_reminder(
        self,
        db: Session,
        contact: Contact,
        workspace: Workspace,
        form: FormTemplate,
        original_email_log: EmailLog
    ):
        """
        FLOW STEP 2 & 4: Send form reminder if not filled within 24h
        """
        # Get or create form reminder template
        template = self.get_or_create_template(db, workspace, EmailTemplateType.FORM_REMINDER)
        
        if not template:
            print(f"❌ Failed to get/create form reminder template")
            return False
        
        # Build form URL
        form_url = f"{self.frontend_url}/public/forms/{workspace.id}/{form.id}"
        
        # Replace variables
        variables = {
            'customer_name': contact.name,
            'business_name': workspace.name,
            'form_name': form.name,
            'form_url': form_url,
            'deadline': '24 hours'
        }
        
        subject = self.replace_variables(template.subject, variables)
        body = self.replace_variables(template.body, variables)
        
        # Send email
        success = await self.send_email(
            to_email=contact.email,
            subject=subject,
            html_body=body,
            workspace=workspace,
            template_type='form_reminder',
            contact_id=contact.id
        )
        
        # Log email
        self.log_email(
            db=db,
            workspace_id=workspace.id,
            contact_id=contact.id,
            template_type='form_reminder',
            subject=subject,
            status='sent' if success else 'failed',
            related_form_id=form.id
        )
        
        return success
    
    async def send_booking_reminder(
        self,
        db: Session,
        booking: Booking,
        contact: Contact,
        workspace: Workspace
    ):
        """
        FLOW STEP 5: Send booking reminder 24h before appointment
        """
        # Get or create booking reminder template
        template = self.get_or_create_template(db, workspace, EmailTemplateType.BOOKING_REMINDER)
        
        if not template:
            print(f"❌ Failed to get/create booking reminder template")
            return False
        
        # Get service details
        from app.models.models import Service
        service = db.query(Service).filter(Service.id == booking.service_id).first()
        
        # Replace variables
        variables = {
            'customer_name': contact.name,
            'business_name': workspace.name,
            'booking_date': booking.start_time.strftime('%B %d, %Y'),
            'booking_time': booking.start_time.strftime('%I:%M %p'),
            'service_name': service.name if service else 'Your appointment',
            'location': workspace.business_address or 'To be confirmed'
        }
        
        subject = self.replace_variables(template.subject, variables)
        body = self.replace_variables(template.body, variables)
        
        # Send email
        success = await self.send_email(
            to_email=contact.email,
            subject=subject,
            html_body=body,
            workspace=workspace,
            template_type='booking_reminder',
            contact_id=contact.id
        )
        
        # Log email
        self.log_email(
            db=db,
            workspace_id=workspace.id,
            contact_id=contact.id,
            template_type='booking_reminder',
            subject=subject,
            status='sent' if success else 'failed',
            related_booking_id=booking.id
        )
        
        return success


# Singleton instance
email_service = EmailService()