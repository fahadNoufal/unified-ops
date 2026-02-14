"""
RAG Service - Vector Store & Retrieval using Gemini Embeddings
"""
import os
import numpy as np
from typing import List, Dict, Optional
from google import genai
from datetime import datetime

class RAGService:
    """
    Handles RAG functionality:
    1. Generate embeddings using Gemini
    2. Store vectors in memory (can be upgraded to Pinecone/Chroma later)
    3. Retrieve relevant context based on query
    """
    
    def __init__(self):
        self.vector_stores = {}  # workspace_id -> vector store
        self.embedding_model = "models/embedding-001"  # Gemini embedding model
        
    def _get_api_key(self, workspace_api_key: Optional[str] = None) -> str:
        """Get Gemini API key (workspace key or fallback to env)"""
        return workspace_api_key or os.getenv('GEMINI_API_KEY')
    
    def generate_embedding(self, text: str, api_key: str) -> List[float]:
        """
        Generate embedding for text using Gemini
        """
        try:
            genai.configure(api_key=api_key)
            result = genai.embed_content(
                model=self.embedding_model,
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            print(f"❌ Error generating embedding: {str(e)}")
            return []
    
    def create_vector_store(
        self,
        workspace_id: int,
        business_content: str,
        api_key: str,
        chunk_size: int = 500
    ):
        """
        Create vector store from business content
        Splits content into chunks and generates embeddings
        """
        print(f"📚 Creating vector store for workspace {workspace_id}")
        
        # Split content into chunks
        chunks = self._chunk_text(business_content, chunk_size)
        
        # Generate embeddings for each chunk
        vectors = []
        for i, chunk in enumerate(chunks):
            embedding = self.generate_embedding(chunk, api_key)
            if embedding:
                vectors.append({
                    'id': i,
                    'text': chunk,
                    'embedding': np.array(embedding),
                    'metadata': {
                        'chunk_index': i,
                        'created_at': datetime.utcnow().isoformat()
                    }
                })
        
        # Store vectors
        self.vector_stores[workspace_id] = {
            'vectors': vectors,
            'created_at': datetime.utcnow(),
            'num_chunks': len(vectors)
        }
        
        print(f"✓ Vector store created: {len(vectors)} chunks")
        return len(vectors)
    
    def _chunk_text(self, text: str, chunk_size: int) -> List[str]:
        """
        Split text into chunks of approximately chunk_size characters
        Tries to split at sentence boundaries
        """
        if not text:
            return []
        
        # Split by sentences (simple approach)
        sentences = text.replace('\n', ' ').split('. ')
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # If adding this sentence exceeds chunk_size, save current chunk
            if len(current_chunk) + len(sentence) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = sentence + ". "
            else:
                current_chunk += sentence + ". "
        
        # Add last chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def search(
        self,
        workspace_id: int,
        query: str,
        api_key: str,
        top_k: int = 3
    ) -> List[Dict]:
        """
        Search vector store for relevant chunks
        Returns top_k most similar chunks
        """
        if workspace_id not in self.vector_stores:
            print(f"⚠️ No vector store found for workspace {workspace_id}")
            return []
        
        store = self.vector_stores[workspace_id]
        
        # Generate query embedding
        query_embedding = self.generate_embedding(query, api_key)
        if not query_embedding:
            return []
        
        query_vector = np.array(query_embedding)
        
        # Calculate cosine similarity with all vectors
        similarities = []
        for vec in store['vectors']:
            similarity = self._cosine_similarity(query_vector, vec['embedding'])
            similarities.append({
                'text': vec['text'],
                'similarity': similarity,
                'metadata': vec['metadata']
            })
        
        # Sort by similarity and return top_k
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        
        return similarities[:top_k]
    
    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors"""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def get_store_info(self, workspace_id: int) -> Optional[Dict]:
        """Get information about the vector store"""
        if workspace_id not in self.vector_stores:
            return None
        
        store = self.vector_stores[workspace_id]
        return {
            'num_chunks': store['num_chunks'],
            'created_at': store['created_at'].isoformat(),
            'has_data': len(store['vectors']) > 0
        }
    
    def delete_store(self, workspace_id: int):
        """Delete vector store for workspace"""
        if workspace_id in self.vector_stores:
            del self.vector_stores[workspace_id]
            print(f"🗑️ Deleted vector store for workspace {workspace_id}")
    
    def update_store(
        self,
        workspace_id: int,
        business_content: str,
        api_key: str
    ):
        """Update vector store with new content"""
        # Delete old store
        self.delete_store(workspace_id)
        
        # Create new store
        return self.create_vector_store(workspace_id, business_content, api_key)


# Singleton instance
rag_service = RAGService()