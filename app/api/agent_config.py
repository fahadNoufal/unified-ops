"""
Agent Configuration API
Manage RAG content, system prompts, and Gemini API keys
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..core.database import get_db
from ..core.auth import get_current_user
from ..models.models import Workspace, User
from ..agents.rag_service import rag_service
from ..agents.prompts import DEFAULT_SYSTEM_PROMPT

router = APIRouter()

# ========== SCHEMAS ==========

class AgentConfigUpdate(BaseModel):
    rag_content: Optional[str] = None
    system_prompt: Optional[str] = None
    gemini_api_key: Optional[str] = None

class AgentConfigResponse(BaseModel):
    rag_content: Optional[str]
    system_prompt: Optional[str]
    has_gemini_api_key: bool
    vector_store_info: Optional[dict]
    
    class Config:
        from_attributes = True

# ========== ENDPOINTS ==========

@router.get("/agent/config", response_model=AgentConfigResponse)
async def get_agent_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current agent configuration"""
    workspace = db.query(Workspace).filter(
        Workspace.id == current_user.workspace_id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Get vector store info
    vector_store_info = rag_service.get_store_info(workspace.id)
    
    return {
        "rag_content": workspace.rag_content,
        "system_prompt": workspace.agent_system_prompt or DEFAULT_SYSTEM_PROMPT,
        "has_gemini_api_key": bool(workspace.gemini_api_key),
        "vector_store_info": vector_store_info
    }

@router.put("/agent/config")
async def update_agent_config(
    data: AgentConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update agent configuration"""
    workspace = db.query(Workspace).filter(
        Workspace.id == current_user.workspace_id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    updated_fields = []
    
    # Update RAG content
    if data.rag_content is not None:
        workspace.rag_content = data.rag_content
        updated_fields.append("rag_content")
        
        # Regenerate vector store if we have API key
        api_key = data.gemini_api_key or workspace.gemini_api_key
        if api_key and data.rag_content:
            try:
                num_chunks = rag_service.update_store(
                    workspace_id=workspace.id,
                    business_content=data.rag_content,
                    api_key=api_key
                )
                print(f"✓ Vector store updated: {num_chunks} chunks")
            except Exception as e:
                print(f"⚠️ Failed to update vector store: {str(e)}")
    
    # Update system prompt
    if data.system_prompt is not None:
        workspace.agent_system_prompt = data.system_prompt
        updated_fields.append("system_prompt")
    
    # Update Gemini API key
    if data.gemini_api_key is not None:
        workspace.gemini_api_key = data.gemini_api_key
        updated_fields.append("gemini_api_key")
        
        # Create vector store if we now have API key and RAG content
        if data.gemini_api_key and workspace.rag_content:
            try:
                num_chunks = rag_service.create_vector_store(
                    workspace_id=workspace.id,
                    business_content=workspace.rag_content,
                    api_key=data.gemini_api_key
                )
                print(f"✓ Vector store created: {num_chunks} chunks")
            except Exception as e:
                print(f"⚠️ Failed to create vector store: {str(e)}")
    
    db.commit()
    
    return {
        "success": True,
        "updated_fields": updated_fields,
        "message": f"Agent configuration updated: {', '.join(updated_fields)}"
    }

@router.post("/agent/rag/regenerate")
async def regenerate_vector_store(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually regenerate vector store from current RAG content"""
    workspace = db.query(Workspace).filter(
        Workspace.id == current_user.workspace_id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if not workspace.rag_content:
        raise HTTPException(status_code=400, detail="No RAG content configured")
        
    if not workspace.gemini_api_key:
        raise HTTPException(status_code=400, detail="No Gemini API key configured")
    
    try:
        num_chunks = rag_service.update_store(
            workspace_id=workspace.id,
            business_content=workspace.rag_content,
            api_key=workspace.gemini_api_key
        )
        
        return {
            "success": True,
            "num_chunks": num_chunks,
            "message": f"Vector store regenerated with {num_chunks} chunks"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to regenerate vector store: {str(e)}")

@router.get("/agent/rag/test-search")
async def test_rag_search(
    query: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test RAG search with a query (for debugging)"""
    workspace = db.query(Workspace).filter(
        Workspace.id == current_user.workspace_id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if not workspace.gemini_api_key:
        raise HTTPException(status_code=400, detail="No Gemini API key configured")
    
    try:
        results = rag_service.search(
            workspace_id=workspace.id,
            query=query,
            api_key=workspace.gemini_api_key,
            top_k=3
        )
        
        return {
            "query": query,
            "results": [
                {
                    "text": r['text'],
                    "similarity": r['similarity']
                }
                for r in results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")