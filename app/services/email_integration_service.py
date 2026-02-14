"""
EMAIL INTEGRATION SERVICE
Handles IMAP (receiving) and SMTP (sending) email integration

This allows businesses to connect their Gmail/Outlook accounts
and manage all email conversations through the app inbox.
"""

import imaplib
import smtplib
import re
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.models import MessageChannel

from app.models.models import (
    EmailConnection, Contact, Conversation, 
    Message, Workspace
)


class EmailIntegrationService:
    """
    Service for managing email integration via IMAP/SMTP
    """
    
    def test_connection(
        self,
        email_address: str,
        password: str,
        imap_host: str,
        imap_port: int,
        smtp_host: str,
        smtp_port: int
    ) -> Dict:
        """Test IMAP and SMTP connection"""
        result = {
            'success': False,
            'imap_ok': False,
            'smtp_ok': False,
            'message': '',
            'error': None
        }
        
        # Test IMAP
        try:
            mail = imaplib.IMAP4_SSL(imap_host, imap_port)
            mail.login(email_address, password)
            mail.logout()
            result['imap_ok'] = True
        except Exception as e:
            result['error'] = f"IMAP Error: {str(e)}"
            return result
        
        # Test SMTP
        try:
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
            server.login(email_address, password)
            server.quit()
            result['smtp_ok'] = True
        except Exception as e:
            result['error'] = f"SMTP Error: {str(e)}"
            return result
        
        result['success'] = True
        result['message'] = 'Connection successful! Both IMAP and SMTP are working.'
        return result
    
    def _clean_email_content(self, content: str) -> str:
        """
        Extract only the latest message content, removing quoted replies and signatures.
        Handles multi-line Gmail headers.
        """
        if not content:
            return ""

        lines = content.split('\n')
        new_lines = []
        
        # Regex patterns that indicate the START of a reply block
        stop_patterns = [
            # Standard single-line: "On [Date] [Name] wrote:"
            r'^On\s.+wrote:?$',
            
            # Gmail Split Line 1: "On Sat, Feb 14, 2026 at 8:18 PM Name <email>"
            # We look for "On", a date-like structure (commas), and an email or "at" time
            r'^On\s.+\,\s.+\,\s.+', 
            
            # Simple "On [Date] <email>" without "wrote" (sometimes it gets cut off)
            r'^On\s.+<.+@.+>',
            
            # Standard "From:" header
            r'^From:\s.+',
            
            # Dividers
            r'^-{3,}\s?Original Message\s?-{3,}$',
            r'^_{3,}$',
            
            # Mobile signatures
            r'^Sent from my iPhone$',
            r'^Sent from my Android$'
        ]
        
        for line in lines:
            line = line.strip()
            
            # 1. Skip standard quote lines (>)
            if line.startswith('>'):
                continue
            
            # 2. Check for "wrote:" on its own line (common in split headers)
            if line.lower() == 'wrote:':
                break

            # 3. Check against all stop patterns
            is_header = False
            for pattern in stop_patterns:
                # re.IGNORECASE handles "on" vs "On"
                if re.match(pattern, line, re.IGNORECASE):
                    is_header = True
                    break
            
            if is_header:
                break
                
            # If it's not a header, keep it
            new_lines.append(line)
        
        # Rejoin and clean up leading/trailing whitespace
        return '\n'.join(new_lines).strip()
    
    def fetch_new_emails(
        self,
        db: Session,
        connection: EmailConnection,
        since_date: Optional[datetime] = None
    ) -> int:
        """
        Fetch new emails from IMAP server
        Returns number of emails processed
        """
        if not since_date:
            # Fetch emails from last 7 days by default
            since_date = datetime.utcnow() - timedelta(days=7)
        
        try:
            # Connect to IMAP
            mail = imaplib.IMAP4_SSL(connection.imap_host, connection.imap_port)
            mail.login(connection.email, connection.password)
            mail.select('INBOX')
            
            # Search for emails since date
            date_str = since_date.strftime("%d-%b-%Y")
            _, message_numbers = mail.search(None, f'(SINCE {date_str})')
            
            # Check if we got any results
            if not message_numbers or not message_numbers[0]:
                mail.logout()
                return 0

            email_ids = message_numbers[0].split()
            processed_count = 0
            
            for email_id in email_ids:
                try:
                    # Fetch email
                    _, msg_data = mail.fetch(email_id, '(RFC822)')
                    if not msg_data or msg_data[0] is None:
                        continue

                    email_body = msg_data[0][1]
                    email_message = email.message_from_bytes(email_body)
                    
                    # Parse email
                    from_email = self._parse_email_address(email_message.get('From', ''))
                    subject = self._decode_header(email_message.get('Subject', ''))
                    
                    # Skip if from our own email (replies we sent)
                    if from_email.lower() == connection.email.lower():
                        continue
                    
                    # 1. Find or create contact FIRST (needed to find conversation)
                    contact = self._find_or_create_contact(
                        db=db,
                        workspace_id=connection.workspace_id,
                        email_address=from_email,
                        name=self._extract_name_from_email(email_message.get('From', ''))
                    )
                    
                    # 2. Find or create conversation
                    conversation = db.query(Conversation).filter(
                        Conversation.contact_id == contact.id
                    ).first()
                    
                    if not conversation:
                        conversation = Conversation(contact_id=contact.id)
                        db.add(conversation)
                        db.commit() # Commit to get the ID
                        db.refresh(conversation)
                    
                    # 3. Check if this message already exists IN THIS CONVERSATION
                    # (This replaces the workspace_id check that was failing)
                    decoded_email_id = email_id.decode()
                    existing_message = db.query(Message).filter(
                        and_(
                            Message.conversation_id == conversation.id,
                            Message.email_message_id == decoded_email_id
                        )
                    ).first()
                    
                    if existing_message:
                        continue  # Already processed

                    # Get content
                    # content = self._get_email_content(email_message)
                    raw_content = self._get_email_content(email_message)
                    
                    # CLEAN the content to remove quoted replies
                    cleaned_content = self._clean_email_content(raw_content)
                    final_content = cleaned_content if cleaned_content else raw_content

                    # 4. Create message
                    # REMOVED: workspace_id, contact_id (Not in your Message model)
                    message = Message(
                        conversation_id=conversation.id,
                        content=final_content,
                        channel=MessageChannel.EMAIL, # Use the Enum if available, else 'email'
                        is_from_customer=True,
                        email_message_id=decoded_email_id,
                        email_subject=subject
                    )
                    db.add(message)
                    processed_count += 1
                    
                except Exception as inner_e:
                    print(f"Error processing single email {email_id}: {str(inner_e)}")
                    continue
            
            db.commit()
            mail.logout()
            
            # Update last sync time
            connection.last_sync_at = datetime.utcnow()
            connection.sync_status = 'success'
            db.commit()
            
            return processed_count
            
        except Exception as e:
            print(f"Error fetching emails: {str(e)}")
            # Rollback in case of DB error to keep session clean
            db.rollback() 
            connection.sync_status = f'error: {str(e)}'
            db.commit()
            raise

    def send_email_reply(
        self,
        db: Session,
        connection: EmailConnection,
        to_email: str,
        subject: str,
        content: str,
        in_reply_to: Optional[str] = None
    ) -> bool:
        """
        Send email reply via SMTP
        """
        print('sending email reply...------------------->>')
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = connection.email
            msg['To'] = to_email
            msg['Subject'] = subject
            
            if in_reply_to:
                msg['In-Reply-To'] = in_reply_to
                msg['References'] = in_reply_to
            
            # Add body
            html_content = content.replace('\n', '<br>')
            text_part = MIMEText(content, 'plain')
            html_part = MIMEText(f'<html><body>{html_content}</body></html>', 'html')
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Send via SMTP
            server = smtplib.SMTP(connection.smtp_host, connection.smtp_port)
            server.starttls()
            server.login(connection.email, connection.password)
            server.send_message(msg)
            server.quit()
            
            return True
            
        except Exception as e:
            print(f"Error sending email: {str(e)}")
            return False
    
    def _parse_email_address(self, from_field: str) -> str:
        """Extract email address from 'From' field"""
        if '<' in from_field and '>' in from_field:
            return from_field.split('<')[1].split('>')[0].strip()
        return from_field.strip()
    
    def _extract_name_from_email(self, from_field: str) -> str:
        """Extract name from 'From' field"""
        if '<' in from_field:
            name = from_field.split('<')[0].strip().strip('"')
            return name if name else from_field.split('@')[0]
        return from_field.split('@')[0]
    
    def _decode_header(self, header: str) -> str:
        """Decode email header"""
        if not header:
            return ''
        decoded = decode_header(header)
        result = []
        for part, encoding in decoded:
            if isinstance(part, bytes):
                result.append(part.decode(encoding or 'utf-8', errors='ignore'))
            else:
                result.append(part)
        return ' '.join(result)
    
    def _get_email_content(self, email_message) -> str:
        """Extract text content from email"""
        content = ''
        
        if email_message.is_multipart():
            for part in email_message.walk():
                content_type = part.get_content_type()
                if content_type == 'text/plain':
                    try:
                        content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        break
                    except:
                        pass
        else:
            try:
                content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
            except:
                content = str(email_message.get_payload())
        
        return content.strip()
    
    def _find_or_create_contact(
        self,
        db: Session,
        workspace_id: int,
        email_address: str,
        name: str
    ) -> Contact:
        """Find existing contact by email or create new one"""
        contact = db.query(Contact).filter(
            and_(
                Contact.workspace_id == workspace_id,
                Contact.email == email_address
            )
        ).first()
        
        if not contact:
            contact = Contact(
                workspace_id=workspace_id,
                email=email_address,
                name=name,
                source='email'
            )
            db.add(contact)
            db.flush()
        
        return contact


# Singleton instance
email_integration_service = EmailIntegrationService()