"""
BACKGROUND EMAIL REMINDER JOB
Run this as a scheduled task (cron job or background worker)

This checks for:
1. Welcome emails sent 24h ago where welcome form not filled -> Send reminder
2. Booking confirmation emails sent 24h ago where pre-appointment form not filled -> Send reminder
3. Bookings 24h in the future -> Send booking reminder

HOW TO RUN:
1. As a cron job: Run every hour
2. As a background worker: Use APScheduler or Celery

Example cron: 0 * * * * python -m app.jobs.email_reminders
"""

from datetime import datetime, timedelta
from sqlalchemy import and_, or_
from app.core.database import SessionLocal
from app.models.models import (
    EmailLog, Contact, Workspace, FormSubmission, 
    FormTemplate, Booking, EmailTemplateType
)
from app.services.email_service import email_service


async def process_form_reminders():
    """
    Check for emails sent 24h ago where form hasn't been filled
    Send reminder if needed
    """
    db = SessionLocal()
    
    try:
        # Get emails sent 23-25 hours ago (1 hour window to catch them)
        twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
        window_start = twenty_four_hours_ago - timedelta(hours=1)
        window_end = twenty_four_hours_ago + timedelta(hours=1)
        
        # Find welcome emails and booking confirmation emails sent in this window
        eligible_emails = db.query(EmailLog).filter(
            and_(
                EmailLog.sent_at >= window_start,
                EmailLog.sent_at <= window_end,
                EmailLog.status == 'sent',
                or_(
                    EmailLog.template_type == 'welcome',
                    EmailLog.template_type == 'booking_confirmation'
                ),
                EmailLog.reminder_sent_at == None  # Haven't sent reminder yet
            )
        ).all()
        
        print(f"Found {len(eligible_emails)} emails eligible for form reminders")
        
        for email_log in eligible_emails:
            # Check if form has been filled
            if email_log.related_form_id:
                # Check if contact has submitted this form
                submission = db.query(FormSubmission).filter(
                    and_(
                        FormSubmission.contact_id == email_log.contact_id,
                        FormSubmission.form_template_id == email_log.related_form_id,
                        FormSubmission.submitted_at >= email_log.sent_at
                    )
                ).first()
                
                if not submission:
                    # Form not filled - send reminder
                    contact = db.query(Contact).filter(Contact.id == email_log.contact_id).first()
                    workspace = db.query(Workspace).filter(Workspace.id == email_log.workspace_id).first()
                    form = db.query(FormTemplate).filter(FormTemplate.id == email_log.related_form_id).first()
                    
                    if contact and workspace and form:
                        print(f"Sending form reminder to {contact.email} for form {form.name}")
                        
                        success = await email_service.send_form_reminder(
                            db=db,
                            contact=contact,
                            workspace=workspace,
                            form=form,
                            original_email_log=email_log
                        )
                        
                        if success:
                            # Mark reminder as sent
                            email_log.reminder_sent_at = datetime.utcnow()
                            db.commit()
                            print(f"✅ Reminder sent successfully")
                        else:
                            print(f"❌ Reminder failed to send")
                else:
                    print(f"Form already submitted for contact {email_log.contact_id}")
    
    finally:
        db.close()


async def process_booking_reminders():
    """
    Check for bookings 24h in the future
    Send reminder if not already sent
    """
    db = SessionLocal()
    
    try:
        # Get bookings 23-25 hours in the future (1 hour window)
        twenty_four_hours_future = datetime.utcnow() + timedelta(hours=24)
        window_start = twenty_four_hours_future - timedelta(hours=1)
        window_end = twenty_four_hours_future + timedelta(hours=1)
        
        # Find bookings in this window that haven't had reminder sent
        bookings = db.query(Booking).filter(
            and_(
                Booking.start_time >= window_start,
                Booking.start_time <= window_end,
                Booking.status.in_(['confirmed', 'pending']),
                Booking.reminder_sent_at == None
            )
        ).all()
        
        print(f"Found {len(bookings)} bookings eligible for reminders")
        
        for booking in bookings:
            contact = db.query(Contact).filter(Contact.id == booking.contact_id).first()
            workspace = db.query(Workspace).filter(Workspace.id == booking.workspace_id).first()
            
            if contact and workspace:
                print(f"Sending booking reminder to {contact.email}")
                
                success = await email_service.send_booking_reminder(
                    db=db,
                    booking=booking,
                    contact=contact,
                    workspace=workspace
                )
                
                if success:
                    # Mark reminder as sent
                    booking.reminder_sent_at = datetime.utcnow()
                    db.commit()
                    print(f"✅ Booking reminder sent successfully")
                else:
                    print(f"❌ Booking reminder failed to send")
    
    finally:
        db.close()


async def run_email_reminder_job():
    """
    Main job function
    Run this on a schedule (e.g., every hour)
    """
    print(f"\n{'='*50}")
    print(f"EMAIL REMINDER JOB STARTED: {datetime.utcnow()}")
    print(f"{'='*50}\n")
    
    try:
        # Process form reminders
        print("📧 Processing form reminders...")
        await process_form_reminders()
        
        # Process booking reminders
        print("\n📆 Processing booking reminders...")
        await process_booking_reminders()
        
        print(f"\n{'='*50}")
        print(f"EMAIL REMINDER JOB COMPLETED: {datetime.utcnow()}")
        print(f"{'='*50}\n")
        
    except Exception as e:
        print(f"❌ Email reminder job failed: {str(e)}")
        import traceback
        traceback.print_exc()


# If running as a script
if __name__ == "__main__":
    import asyncio
    asyncio.run(run_email_reminder_job())