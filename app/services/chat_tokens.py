import secrets
from typing import Optional

def generate_chat_token(conversation_id: int) -> str:
    """
    Generate secure token for conversation access
    Format: conversationId_randomToken
    """
    random_part = secrets.token_urlsafe(32)
    token = f"{conversation_id}_{random_part}"
    return token

def validate_chat_token(token: str) -> Optional[int]:
    """
    Validate token and extract conversation ID
    Returns conversation_id if valid, None if invalid
    """
    try:
        parts = token.split('_')
        if len(parts) < 2:
            return None
        
        conversation_id = int(parts[0])
        return conversation_id
    except (ValueError, IndexError):
        return None






