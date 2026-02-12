import resend
from typing import Dict, Optional
from app.core.config import settings
from app.models.models import EmailTemplate
import logging

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        if settings.RESEND_API_KEY:
            resend.api_key = settings.RESEND_API_KEY
    
    def replace_variables(self, template: str, variables: Dict[str, str]) -> str:
        """Replace template variables with actual values"""
        for key, value in variables.items():
            template = template.replace(f"{{{key}}}", str(value))
        return template
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_email: Optional[str] = None
    ) -> bool:
        """Send an email via Resend"""
        try:
            if not settings.RESEND_API_KEY:
                logger.warning("Resend API key not configured, logging email instead")
                logger.info(f"Would send email to {to_email}: {subject}")
                return True  # Return True for demo purposes
            
            params = {
                "from": from_email or settings.FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": body
            }
            
            resend.Emails.send(params)
            logger.info(f"Email sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False
    
    async def send_template_email(
        self,
        to_email: str,
        email_template: EmailTemplate,
        variables: Dict[str, str],
        from_email: Optional[str] = None
    ) -> bool:
        """Send an email using a template"""
        subject = self.replace_variables(email_template.subject, variables)
        body = self.replace_variables(email_template.body, variables)
        return await self.send_email(to_email, subject, body, from_email)
    
    async def send_test_email(
        self,
        to_email: str,
        workspace_name: str
    ) -> bool:
        """Send a test email to verify integration"""
        subject = f"Test Email from {workspace_name}"
        body = f"""
        <html>
        <body>
        <h2>Email Integration Successful!</h2>
        <p>This is a test email from {workspace_name}.</p>
        <p>Your email integration with Resend is working correctly.</p>
        </body>
        </html>
        """
        return await self.send_email(to_email, subject, body)
    
    async def send_welcome_email(
        self,
        to_email: str,
        customer_name: str,
        business_name: str,
        booking_link: str
    ) -> bool:
        """Send welcome email with booking link"""
        subject = f"Welcome to {business_name}"
        body = f"""
        <html>
        <body>
        <h2>Welcome {customer_name}!</h2>
        <p>Thank you for your interest in {business_name}.</p>
        <p>You can book an appointment with us using the link below:</p>
        <p><a href="{booking_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Book Now</a></p>
        </body>
        </html>
        """
        return await self.send_email(to_email, subject, body)
    
    async def send_booking_confirmation(
        self,
        to_email: str,
        customer_name: str,
        service_name: str,
        date: str,
        time: str,
        location: str
    ) -> bool:
        """Send booking confirmation email"""
        subject = f"Booking Confirmed - {service_name}"
        body = f"""
        <html>
        <body>
        <h2>Booking Confirmed!</h2>
        <p>Hello {customer_name},</p>
        <p>Your booking has been confirmed with the following details:</p>
        <ul>
            <li><strong>Service:</strong> {service_name}</li>
            <li><strong>Date:</strong> {date}</li>
            <li><strong>Time:</strong> {time}</li>
            <li><strong>Location:</strong> {location}</li>
        </ul>
        <p>We look forward to seeing you!</p>
        </body>
        </html>
        """
        return await self.send_email(to_email, subject, body)
    
    async def send_form_email(
        self,
        to_email: str,
        customer_name: str,
        form_name: str,
        form_link: str,
        deadline: str
    ) -> bool:
        """Send post-booking form email"""
        subject = f"Please complete: {form_name}"
        body = f"""
        <html>
        <body>
        <h2>Action Required: Complete {form_name}</h2>
        <p>Hello {customer_name},</p>
        <p>Please complete the following form before your appointment:</p>
        <p><a href="{form_link}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Form</a></p>
        <p><strong>Deadline:</strong> {deadline}</p>
        </body>
        </html>
        """
        return await self.send_email(to_email, subject, body)
    
    async def send_staff_credentials(
        self,
        to_email: str,
        staff_name: str,
        username: str,
        password: str,
        login_link: str
    ) -> bool:
        """Send staff login credentials"""
        subject = "Your Staff Account Credentials"
        body = f"""
        <html>
        <body>
        <h2>Welcome to the Team, {staff_name}!</h2>
        <p>Your staff account has been created. Here are your login credentials:</p>
        <ul>
            <li><strong>Username:</strong> {username}</li>
            <li><strong>Temporary Password:</strong> {password}</li>
        </ul>
        <p><a href="{login_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login Now</a></p>
        <p><em>You will be required to change your password on first login.</em></p>
        </body>
        </html>
        """
        return await self.send_email(to_email, subject, body)
    
    async def send_inventory_alert(
        self,
        to_email: str,
        item_name: str,
        current_stock: int,
        threshold: int
    ) -> bool:
        """Send inventory low stock alert"""
        subject = f"Low Stock Alert: {item_name}"
        body = f"""
        <html>
        <body>
        <h2>⚠️ Low Stock Alert</h2>
        <p>The following item is running low on stock:</p>
        <ul>
            <li><strong>Item:</strong> {item_name}</li>
            <li><strong>Current Stock:</strong> {current_stock}</li>
            <li><strong>Threshold:</strong> {threshold}</li>
        </ul>
        <p>Please restock as soon as possible.</p>
        </body>
        </html>
        """
        return await self.send_email(to_email, subject, body)
    
    async def send_low_stock_alert(
        self,
        recipient_email: str,
        item_name: str,
        current_stock: int,
        threshold: int
    ) -> bool:
        """Send inventory low stock alert to the business owner/admin"""
        subject = f"⚠️ Action Required: Low Stock Alert - {item_name}"
        body = f"""
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #d32f2f;">⚠️ Low Stock Alert</h2>
                <p>Hello,</p>
                <p>This is an automated notification to inform you that an item in your inventory has fallen below its minimum threshold.</p>
                
                <div style="background-color: #fff4f4; padding: 15px; border-radius: 5px; border-left: 5px solid #d32f2f;">
                    <p><strong>Item:</strong> {item_name}</p>
                    <p><strong>Current Stock:</strong> <span style="color: #d32f2f; font-weight: bold;">{current_stock}</span></p>
                    <p><strong>Set Threshold:</strong> {threshold}</p>
                </div>
                
                <p>Please log in to your dashboard to manage your inventory and restock this item.</p>
                <p style="font-size: 0.9em; color: #666;"><em>This is an automated message from your Operations Platform.</em></p>
            </div>
        </body>
        </html>
        """
        return await self.send_email(recipient_email, subject, body)

email_service = EmailService()
