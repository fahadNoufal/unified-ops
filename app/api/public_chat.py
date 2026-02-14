"""
PUBLIC CHAT API
Allows customers to chat with business via secure token links
No authentication required - uses token validation
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from datetime import datetime
from typing import List
from pydantic import BaseModel

from ..core.database import get_db
from ..models.models import Conversation, Message, Contact, Workspace, MessageChannel
from app.agents.llm_agent import conversation_agent
from app.agents.prompts import DEFAULT_SYSTEM_PROMPT
from app.services.chat_tokens import generate_chat_token, validate_chat_token
import os

router = APIRouter()

# ========== SCHEMAS ==========

class PublicMessageSend(BaseModel):
    content: str

class PublicMessageResponse(BaseModel):
    id: int
    content: str
    is_from_customer: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class PublicChatInfo(BaseModel):
    conversation_id: int
    customer_name: str
    business_name: str
    message_count: int
    messages_remaining: int
    
    class Config:
        from_attributes = True

# ========== TOKEN GENERATION (Internal - for welcome emails) ==========

@router.post("/conversations/{conversation_id}/generate-token")
async def generate_conversation_token(
    conversation_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate chat token for a conversation (called internally when sending welcome email)
    Returns: {"token": "123_abc...", "chat_url": "http://..."}
    """
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Generate token
    token = generate_chat_token(conversation_id)
    
    # Build chat URL
    frontend_url = "http://localhost:5173"  # TODO: Use env variable
    chat_url = f"{frontend_url}/chat/{token}"
    
    return {
        "token": token,
        "chat_url": chat_url,
        "conversation_id": conversation_id
    }

# ========== PUBLIC CHAT ENDPOINTS (No auth required) ==========

@router.get("/public/chat/{token}/info")
async def get_chat_info(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Get chat information and validate token
    Returns: conversation details, message count, etc.
    """
    # Validate token and extract conversation ID
    conversation_id = validate_chat_token(token)
    
    if not conversation_id:
        raise HTTPException(status_code=400, detail="Invalid chat token")
    
    # Get conversation
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get contact and workspace
    contact = conversation.contact
    workspace = db.query(Workspace).filter(
        Workspace.id == contact.workspace_id
    ).first()
    
    # Count customer messages (to enforce 14 limit)
    customer_message_count = db.query(func.count(Message.id)).filter(
        Message.conversation_id == conversation_id,
        Message.is_from_customer == True
    ).scalar() or 0
    
    messages_remaining = max(0, 14 - customer_message_count)
    
    return {
        "conversation_id": conversation.id,
        "customer_name": contact.name,
        "business_name": workspace.name,
        "message_count": customer_message_count,
        "messages_remaining": messages_remaining,
        "can_send": messages_remaining > 0
    }

@router.get("/public/chat/{token}/messages")
async def get_chat_messages(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Get last 50 messages for this conversation
    Returns: list of messages (oldest first for display)
    """
    # Validate token
    conversation_id = validate_chat_token(token)
    
    if not conversation_id:
        raise HTTPException(status_code=400, detail="Invalid chat token")
    
    # Get conversation
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get last 50 messages (ordered by created_at DESC, then reverse for display)
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(desc(Message.created_at)).limit(50).all()
    
    # Reverse to show oldest first
    messages.reverse()
    
    return [{
        "id": msg.id,
        "content": msg.content,
        "is_from_customer": msg.is_from_customer,
        "is_automated": msg.is_automated,
        "created_at": msg.created_at.isoformat()
    } for msg in messages]

@router.post("/public/chat/{token}/send")
async def send_chat_message(
    token: str,
    data: PublicMessageSend,
    db: Session = Depends(get_db)
):
    """
    Send message from customer to business
    Enforces 14 message limit per customer (changed from 50)
    Triggers AI agent response
    """
    # Validate token
    conversation_id = validate_chat_token(token)
    
    if not conversation_id:
        raise HTTPException(status_code=400, detail="Invalid chat token")
    
    # Get conversation
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # ========== UPDATED: Changed limit to 14 messages ==========
    customer_message_count = db.query(func.count(Message.id)).filter(
        Message.conversation_id == conversation_id,
        Message.is_from_customer == True
    ).scalar() or 0
    
    if customer_message_count >= 14:  # Changed from 50
        raise HTTPException(
            status_code=429, 
            detail="Message limit reached. You have sent the maximum of 14 messages."
        )
    # ==========================================================
    
    # Validate content
    if not data.content or not data.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    
    if len(data.content) > 2000:
        raise HTTPException(status_code=400, detail="Message too long (max 2000 characters)")
    
    # Create customer message
    customer_message = Message(
        conversation_id=conversation_id,
        sender_id=None,
        content=data.content.strip(),
        channel=MessageChannel.SYSTEM,
        is_from_customer=True,
        is_automated=False,
        created_at=datetime.utcnow()
    )
    
    db.add(customer_message)
    
    # Update conversation
    conversation.last_message_at = datetime.utcnow()
    conversation.unread_count += 1
    
    db.commit()
    db.refresh(customer_message)
    
    # ========== NEW: TRIGGER AI AGENT ==========
    try:
        # Get workspace
        contact = conversation.contact
        workspace = db.query(Workspace).filter(
            Workspace.id == contact.workspace_id
        ).first()
        
        # Get conversation history (last 10 messages)
        history_messages = db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(Message.created_at.desc()).limit(10).all()
        
        history_messages.reverse()  # Oldest first
        
        history = [
            {
                'content': msg.content,
                'is_from_customer': msg.is_from_customer,
                'created_at': msg.created_at.isoformat()
            }
            for msg in history_messages
        ]
        
        # Get agent configuration
        system_prompt = workspace.agent_system_prompt or DEFAULT_SYSTEM_PROMPT
        rag_content_summary = workspace.rag_content[:500] if workspace.rag_content else "No additional info"
        gemini_api_key = workspace.gemini_api_key or os.getenv('GEMINI_API_KEY')
        print(gemini_api_key)
        
        # Check if we have API key
        if not gemini_api_key:
            print("⚠️ No Gemini API key configured, skipping agent response")
        else:
            # Generate agent response
            agent_response = await conversation_agent.process_message(
                workspace_id=workspace.id,
                conversation_id=conversation_id,
                customer_message=data.content,
                conversation_history=history,
                business_name=workspace.name,
                system_prompt=system_prompt,
                rag_content_summary=rag_content_summary,
                gemini_api_key=gemini_api_key,
                messages_count=customer_message_count + 1
            )
            
            # Save agent response
            if agent_response:
                agent_message = Message(
                    conversation_id=conversation_id,
                    sender_id=None,
                    content=agent_response,
                    channel=MessageChannel.SYSTEM,
                    is_from_customer=False,
                    is_automated=True,
                    created_at=datetime.utcnow()
                )
                
                db.add(agent_message)
                conversation.last_message_at = datetime.utcnow()
                db.commit()
                
                print(f"🤖 Agent responded: {agent_response[:100]}...")
                
    except Exception as e:
        print(f"❌ Agent error: {str(e)}")
        # Don't fail the request if agent fails
        pass
    # ==========================================
    
    return {
        "id": customer_message.id,
        "content": customer_message.content,
        "is_from_customer": customer_message.is_from_customer,
        "created_at": customer_message.created_at.isoformat(),
        "messages_remaining": 14 - (customer_message_count + 1)  # Updated
    }
    
@router.get("/public/chat/{token}/workspace")
async def get_workspace_branding(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Get workspace branding for chat page
    Returns: business name, colors, logo, etc.
    """
    # Validate token
    conversation_id = validate_chat_token(token)
    
    if not conversation_id:
        raise HTTPException(status_code=400, detail="Invalid chat token")
    
    # Get conversation
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get workspace
    contact = conversation.contact
    workspace = db.query(Workspace).filter(
        Workspace.id == contact.workspace_id
    ).first()
    
    return {
        "business_name": workspace.name,
        "business_address": workspace.business_address,
        "contact_email": workspace.contact_email,
        "contact_phone": workspace.contact_phone
    }