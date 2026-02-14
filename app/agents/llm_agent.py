"""
Agentic Conversation System using LangGraph + Gemini
Stateful agent with RAG capabilities for sales conversations
"""
import os
from typing import TypedDict, List, Dict, Optional, Annotated
from datetime import datetime
from google import genai
from langgraph.graph import StateGraph, END
from app.core.config import settings  # Ensure this imports your Pydantic settings
from .rag_service import rag_service
from .prompts import (
    DEFAULT_SYSTEM_PROMPT,
    RAG_DECISION_PROMPT,
    DEFAULT_RAG_QUERY_PROMPT,
    DEFAULT_RESPONSE_PROMPT,
    NO_RAG_RESPONSE_PROMPT
)


class ConversationState(TypedDict):
    """State for conversation agent"""
    workspace_id: int
    conversation_id: int
    customer_message: str
    conversation_history: List[Dict[str, str]]  # [{role, content}]
    business_name: str
    system_prompt: str
    rag_content_summary: str
    gemini_api_key: str
    
    # Agent state
    needs_rag: bool
    rag_query: str
    rag_results: List[Dict]
    final_response: str
    
    # Metadata
    messages_count: int
    max_messages: int  # 14


class ConversationAgent:
    """
    Stateful agentic system for customer conversations
    Uses LangGraph for workflow orchestration
    """
    
    def __init__(self):
        self.model = "gemini-2.0-flash-lite"  # Latest Gemini model
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build LangGraph workflow"""
        workflow = StateGraph(ConversationState)
        
        # Add nodes
        workflow.add_node("check_message_limit", self.check_message_limit)
        workflow.add_node("decide_rag", self.decide_rag_needed)
        workflow.add_node("retrieve_context", self.retrieve_rag_context)
        workflow.add_node("generate_response", self.generate_response)
        
        # Define edges
        workflow.set_entry_point("check_message_limit")
        
        workflow.add_conditional_edges(
            "check_message_limit",
            self.route_after_limit_check,
            {
                "continue": "decide_rag",
                "limit_reached": END
            }
        )
        
        workflow.add_conditional_edges(
            "decide_rag",
            self.route_after_rag_decision,
            {
                "use_rag": "retrieve_context",
                "no_rag": "generate_response"
            }
        )
        
        workflow.add_edge("retrieve_context", "generate_response")
        workflow.add_edge("generate_response", END)
        
        return workflow.compile()
    
    # ========== Node Functions ==========
    
    def check_message_limit(self, state: ConversationState) -> ConversationState:
        """Check if customer has reached message limit"""
        if state['messages_count'] >= state['max_messages']:
            state['final_response'] = (
                f"You've reached the maximum of {state['max_messages']} messages. "
                f"Please book an appointment or contact {state['business_name']} directly for further assistance!"
            )
        return state
    
    def decide_rag_needed(self, state: ConversationState) -> ConversationState:
        """Decide if RAG retrieval is needed for this query"""
        try:
            # FIX: Use Client from new SDK
            client = genai.Client(api_key=state['gemini_api_key'])
            
            # Format conversation history
            history_text = self._format_history(state['conversation_history'][-5:])  # Last 5 messages
            
            # Create decision prompt
            prompt = RAG_DECISION_PROMPT.format(
                customer_message=state['customer_message'],
                conversation_history=history_text,
                business_name=state['business_name'],
                has_rag_data="Yes" if rag_service.get_store_info(state['workspace_id']) else "No"
            )
            
            # FIX: Use client.models.generate_content
            response = client.models.generate_content(
                model=self.model,
                contents=prompt
            )
            decision = response.text.strip().upper()
            
            state['needs_rag'] = "YES" in decision
            
            print(f"🤔 RAG Decision: {'YES' if state['needs_rag'] else 'NO'}")
            
        except Exception as e:
            print(f"❌ Error in RAG decision: {str(e)}")
            state['needs_rag'] = False
        
        return state
    
    def retrieve_rag_context(self, state: ConversationState) -> ConversationState:
        """Retrieve relevant context from RAG"""
        try:
            # FIX: Use Client from new SDK
            client = genai.Client(api_key=state['gemini_api_key'])
            
            history_text = self._format_history(state['conversation_history'][-3:])
            
            query_prompt = DEFAULT_RAG_QUERY_PROMPT.format(
                query=state['customer_message'],
                conversation_history=history_text
            )
            
            # FIX: Use client.models.generate_content
            response = client.models.generate_content(
                model=self.model,
                contents=query_prompt
            )
            search_query = response.text.strip()
            
            print(f"🔍 RAG Search Query: {search_query}")
            
            # Search vector store
            results = rag_service.search(
                workspace_id=state['workspace_id'],
                query=search_query,
                api_key=state['gemini_api_key'],
                top_k=3
            )
            
            state['rag_results'] = results
            state['rag_query'] = search_query
            
            print(f"📚 Retrieved {len(results)} relevant chunks")
            
        except Exception as e:
            print(f"❌ Error retrieving RAG context: {str(e)}")
            state['rag_results'] = []
        
        return state
    
    def generate_response(self, state: ConversationState) -> ConversationState:
        """Generate final response using Gemini"""
        try:
            # FIX: Use Client from new SDK
            client = genai.Client(api_key=state['gemini_api_key'])
            
            # Format conversation history
            history_text = self._format_history(state['conversation_history'])
            
            # --- CONSTRUCT BOOKING LINK ---
            # Use settings from config to get the frontend URL
            base_url = settings.FRONTEND_URL.rstrip('/')
            booking_link = f"{base_url}/book/{state['workspace_id']}"
            
            # Choose prompt based on whether we have RAG results
            prompt = "" 
            if state.get('rag_results') and len(state['rag_results']) > 0:
                # Format RAG results
                rag_context = "\n\n".join([
                    f"[Relevance: {r['similarity']:.2f}]\n{r['text']}"
                    for r in state['rag_results']
                ])
                
                # Pass booking_link to the prompt
                prompt = DEFAULT_RESPONSE_PROMPT.format(
                    business_name=state['business_name'],
                    conversation_history=history_text,
                    rag_results=rag_context,
                    customer_message=state['customer_message'],
                    booking_link=booking_link 
                )
            else:
                # No RAG - use general prompt
                prompt = NO_RAG_RESPONSE_PROMPT.format(
                    business_name=state['business_name'],
                    conversation_history=history_text,
                    customer_message=state['customer_message'],
                    business_summary=state.get('rag_content_summary', 'General business information'),
                    booking_link=booking_link
                )
            
            # Add system prompt context
            full_prompt = f"{state['system_prompt']}\n\n{prompt}"
            
            # FIX: Use client.models.generate_content
            response = client.models.generate_content(
                model=self.model,
                contents=full_prompt
            )
            
            state['final_response'] = response.text.strip()
            
            print(f"💬 Generated response: {state['final_response'][:100]}...")
            
        except Exception as e:
            print(f"❌ Error generating response: {str(e)}")
            state['final_response'] = (
                f"I apologize, I'm having trouble processing your message right now. "
                f"Please try again or contact {state['business_name']} directly!"
            )
        
        return state
    
    # ========== Routing Functions ==========
    
    def route_after_limit_check(self, state: ConversationState) -> str:
        """Route based on message limit"""
        if state['messages_count'] >= state['max_messages']:
            return "limit_reached"
        return "continue"
    
    def route_after_rag_decision(self, state: ConversationState) -> str:
        """Route based on RAG decision"""
        if state['needs_rag']:
            return "use_rag"
        return "no_rag"
    
    # ========== Helper Functions ==========
    
    def _format_history(self, history: List[Dict[str, str]]) -> str:
        """Format conversation history for prompts"""
        if not history:
            return "No previous conversation"
        
        formatted = []
        for msg in history:
            role = "Customer" if msg.get('is_from_customer') else "Assistant"
            formatted.append(f"{role}: {msg['content']}")
        
        return "\n".join(formatted)
    
    # ========== Main Execution ==========
    
    async def process_message(
        self,
        workspace_id: int,
        conversation_id: int,
        customer_message: str,
        conversation_history: List[Dict],
        business_name: str,
        system_prompt: str,
        rag_content_summary: str,
        gemini_api_key: str,
        messages_count: int
    ) -> str:
        """
        Process customer message and generate response
        """
        # Construct booking link for system prompt as well
        base_url = settings.FRONTEND_URL.rstrip('/')
        booking_link = f"{base_url}/book/{workspace_id}"

        # Initialize state
        initial_state: ConversationState = {
            'workspace_id': workspace_id,
            'conversation_id': conversation_id,
            'customer_message': customer_message,
            'conversation_history': conversation_history,
            'business_name': business_name,
            # Added booking_link to system prompt format just in case
            'system_prompt': system_prompt.format(
                business_name=business_name,
                current_date=datetime.now().strftime("%B %d, %Y"),
                rag_context=rag_content_summary,
                booking_link=booking_link 
            ),
            'rag_content_summary': rag_content_summary,
            'gemini_api_key': gemini_api_key,
            'messages_count': messages_count,
            'max_messages': 14,
            'needs_rag': False,
            'rag_query': '',
            'rag_results': [],
            'final_response': ''
        }
        
        # Run graph
        final_state = self.graph.invoke(initial_state)
        
        return final_state['final_response']


# Singleton instance
conversation_agent = ConversationAgent()