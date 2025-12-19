# AI System Architecture

Detailed architecture documentation for the AI/LLM integration in the Intellectual Genealogy Mapper.

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           User Interface                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │  Search    │  │ AI Chat    │  │ Suggest    │  │ Validate   │   │
│  │  Bar       │  │ Interface  │  │ Button     │  │ & Analyze  │   │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼─────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend                                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     /api/ai/* Endpoints                        │ │
│  │  POST /search  POST /chat  POST /suggest  POST /validate      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    AI Service Layer                            │ │
│  ├────────────┬────────────┬────────────┬────────────────────────┤ │
│  │  Search    │    Chat    │  Suggest   │  Validation            │ │
│  │  Service   │  Service   │  Service   │  Service               │ │
│  └──────┬─────┴──────┬─────┴──────┬─────┴──────┬─────────────────┘ │
│         │            │            │            │                    │
│  ┌──────▼────────────▼────────────▼────────────▼─────────────────┐ │
│  │                   Core AI Components                           │ │
│  ├───────────────┬────────────────────┬─────────────────────────┤ │
│  │  Embedding    │   Vector Store     │    LLM Client           │ │
│  │  Generator    │   Interface        │    Interface            │ │
│  └───────┬───────┴──────────┬─────────┴────────┬────────────────┘ │
└──────────┼──────────────────┼──────────────────┼───────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │  OpenAI API  │  │   ChromaDB       │  │  DeepSeek API    │
  │              │  │   (Local)        │  │                  │
  │ - Embeddings │  │ - Vector Index   │  │ - Generation     │
  │ - 1536 dim   │  │ - Metadata       │  │ - Analysis       │
  └──────────────┘  │ - Search         │  │ - Summarization  │
                    └──────────────────┘  └──────────────────┘
```

## Component Architecture

### 1. Frontend Layer

```typescript
// frontend/src/lib/ai-api.ts
interface AIClient {
  search: (query: string) => Promise<SearchResult[]>
  chat: (message: string, context?: string[]) => Promise<ChatResponse>
  suggestConnections: (thinkerId: string) => Promise<ConnectionSuggestion[]>
  validateData: () => Promise<ValidationReport>
  generateSummary: (timelineId: string) => Promise<Summary>
}
```

**Responsibilities**:
- User input collection
- Display AI responses
- Handle loading states
- Error display and retry logic
- Stream handling for chat responses

**Components**:
- **SearchBar**: Semantic search interface
- **ChatPanel**: RAG chat interface
- **SuggestionsPanel**: Connection/tag suggestions
- **ValidationReport**: Data quality dashboard
- **SummaryView**: Generated summaries display

### 2. API Layer

```python
# backend/app/routes/ai.py
from fastapi import APIRouter, Depends, HTTPException
from app.ai.search import semantic_search
from app.ai.chat import rag_chat
from app.ai.suggestions import suggest_connections
from app.ai.validation import validate_data

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.post("/search")
async def search_thinkers(query: SearchQuery) -> List[SearchResult]:
    """Semantic search across thinkers"""
    pass

@router.post("/chat")
async def chat(message: ChatMessage) -> ChatResponse:
    """RAG-based chat about research database"""
    pass

@router.post("/suggest/{thinker_id}")
async def suggest(thinker_id: UUID) -> List[ConnectionSuggestion]:
    """AI-powered connection suggestions"""
    pass

@router.post("/validate")
async def validate() -> ValidationReport:
    """AI validation of data quality"""
    pass
```

**Responsibilities**:
- Request validation (Pydantic)
- Authentication/authorization
- Rate limiting
- Error handling
- Response formatting

### 3. Service Layer

Each AI feature is encapsulated in a service module:

#### Search Service
```python
# backend/app/ai/search.py
class SearchService:
    def __init__(self, vector_store, db_session):
        self.vector_store = vector_store
        self.db = db_session

    async def semantic_search(
        self,
        query: str,
        limit: int = 10,
        filters: dict = None
    ) -> List[SearchResult]:
        # 1. Generate query embedding
        query_embedding = await generate_embedding(query)

        # 2. Search vector database
        vector_results = self.vector_store.search(
            query_embedding,
            limit=limit * 2,  # Get more for filtering
            metadata_filter=filters
        )

        # 3. Fetch full thinker data from DB
        thinker_ids = [r['thinker_id'] for r in vector_results]
        thinkers = self.db.query(Thinker).filter(
            Thinker.id.in_(thinker_ids)
        ).all()

        # 4. Rank and return results
        return self._rank_results(thinkers, vector_results)[:limit]
```

#### Chat Service (RAG)
```python
# backend/app/ai/chat.py
class ChatService:
    def __init__(self, vector_store, llm_client, db_session):
        self.vector_store = vector_store
        self.llm = llm_client
        self.db = db_session

    async def chat(
        self,
        message: str,
        conversation_history: List[Message] = None
    ) -> ChatResponse:
        # 1. Retrieve relevant context from vector DB
        context_docs = await self._retrieve_context(message)

        # 2. Build prompt with context
        prompt = self._build_rag_prompt(
            message,
            context_docs,
            conversation_history
        )

        # 3. Call LLM
        response = await self.llm.complete(prompt)

        # 4. Extract citations
        citations = self._extract_citations(response, context_docs)

        return ChatResponse(
            message=response,
            citations=citations,
            context_used=context_docs
        )

    async def _retrieve_context(self, query: str, k: int = 5):
        query_embedding = await generate_embedding(query)
        results = self.vector_store.search(query_embedding, limit=k)

        # Fetch full context
        thinker_ids = [r['thinker_id'] for r in results]
        thinkers = self.db.query(Thinker).options(
            joinedload(Thinker.publications),
            joinedload(Thinker.quotes)
        ).filter(Thinker.id.in_(thinker_ids)).all()

        return self._format_context(thinkers)
```

#### Suggestion Service
```python
# backend/app/ai/suggestions.py
class SuggestionService:
    def __init__(self, vector_store, llm_client, db_session):
        self.vector_store = vector_store
        self.llm = llm_client
        self.db = db_session

    async def suggest_connections(
        self,
        thinker_id: UUID,
        limit: int = 5
    ) -> List[ConnectionSuggestion]:
        # 1. Get thinker details
        thinker = self.db.query(Thinker).options(
            joinedload(Thinker.publications),
            joinedload(Thinker.connections_from),
            joinedload(Thinker.connections_to)
        ).filter(Thinker.id == thinker_id).first()

        # 2. Find similar thinkers via vector search
        similar_thinkers = await self._find_similar(thinker)

        # 3. Filter already connected
        candidates = self._filter_existing(thinker, similar_thinkers)

        # 4. Use LLM to analyze and suggest
        suggestions = await self._analyze_candidates(thinker, candidates)

        return suggestions[:limit]

    async def _analyze_candidates(self, thinker, candidates):
        prompt = self._build_suggestion_prompt(thinker, candidates)
        response = await self.llm.complete(prompt)
        return self._parse_suggestions(response)
```

#### Validation Service
```python
# backend/app/ai/validation.py
class ValidationService:
    def __init__(self, llm_client, db_session):
        self.llm = llm_client
        self.db = db_session

    async def validate_data(self) -> ValidationReport:
        issues = []

        # 1. Rule-based validation
        issues.extend(self._validate_dates())
        issues.extend(self._validate_connections())
        issues.extend(self._validate_duplicates())

        # 2. AI-powered validation
        ai_issues = await self._ai_validate()
        issues.extend(ai_issues)

        return ValidationReport(
            total_issues=len(issues),
            critical=self._count_critical(issues),
            issues=issues
        )

    async def _ai_validate(self):
        # Check for semantic inconsistencies
        thinkers = self.db.query(Thinker).all()
        batch_size = 10

        issues = []
        for i in range(0, len(thinkers), batch_size):
            batch = thinkers[i:i+batch_size]
            batch_issues = await self._validate_batch(batch)
            issues.extend(batch_issues)

        return issues
```

### 4. Core AI Components

#### Embedding Generator
```python
# backend/app/ai/embeddings.py
from openai import OpenAI
from typing import List, Union

class EmbeddingGenerator:
    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.dimension = 1536

    async def generate(self, text: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        """Generate embeddings for text(s)"""
        is_batch = isinstance(text, list)
        texts = text if is_batch else [text]

        response = self.client.embeddings.create(
            model=self.model,
            input=texts
        )

        embeddings = [data.embedding for data in response.data]
        return embeddings if is_batch else embeddings[0]

    def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        import tiktoken
        encoding = tiktoken.encoding_for_model(self.model)
        return len(encoding.encode(text))

# Singleton instance
_embedding_generator = None

def get_embedding_generator():
    global _embedding_generator
    if _embedding_generator is None:
        from app.config.ai_config import AISettings
        settings = AISettings()
        _embedding_generator = EmbeddingGenerator(
            api_key=settings.openai_api_key,
            model=settings.openai_embedding_model
        )
    return _embedding_generator

async def generate_embedding(text: str) -> List[float]:
    generator = get_embedding_generator()
    return await generator.generate(text)
```

#### Vector Store Interface
```python
# backend/app/ai/vector_store.py
import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any
from uuid import UUID

class VectorStore:
    def __init__(self, persist_directory: str, collection_name: str):
        self.client = chromadb.Client(Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=persist_directory
        ))

        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def add_thinker(
        self,
        thinker_id: UUID,
        embedding: List[float],
        document: str,
        metadata: Dict[str, Any]
    ):
        """Add or update a thinker's embedding"""
        self.collection.upsert(
            ids=[str(thinker_id)],
            embeddings=[embedding],
            documents=[document],
            metadatas=[metadata]
        )

    def search(
        self,
        query_embedding: List[float],
        limit: int = 10,
        metadata_filter: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar thinkers"""
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where=metadata_filter
        )

        return [
            {
                'thinker_id': results['ids'][0][i],
                'distance': results['distances'][0][i],
                'metadata': results['metadatas'][0][i],
                'document': results['documents'][0][i]
            }
            for i in range(len(results['ids'][0]))
        ]

    def delete_thinker(self, thinker_id: UUID):
        """Remove a thinker's embedding"""
        self.collection.delete(ids=[str(thinker_id)])

    def count(self) -> int:
        """Count total embeddings"""
        return self.collection.count()

# Singleton instance
_vector_store = None

def get_vector_store():
    global _vector_store
    if _vector_store is None:
        from app.config.ai_config import AISettings
        settings = AISettings()
        _vector_store = VectorStore(
            persist_directory=settings.chroma_persist_directory,
            collection_name=settings.chroma_collection_name
        )
    return _vector_store
```

#### LLM Client
```python
# backend/app/ai/client.py
from openai import OpenAI
from typing import List, Dict, Optional

class LLMClient:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str = "deepseek-chat"
    ):
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        self.model = model

    async def complete(
        self,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> str:
        """Generate completion"""
        messages = []

        if system_message:
            messages.append({"role": "system", "content": system_message})

        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        return response.choices[0].message.content

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> str:
        """Multi-turn conversation"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        return response.choices[0].message.content

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000
    ):
        """Streaming chat (for real-time UI updates)"""
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True
        )

        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

# Singleton instance
_llm_client = None

def get_llm_client():
    global _llm_client
    if _llm_client is None:
        from app.config.ai_config import AISettings
        settings = AISettings()
        _llm_client = LLMClient(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            model=settings.deepseek_model
        )
    return _llm_client
```

## Data Flow

### 1. Embedding Generation Flow

```
Thinker Created/Updated
        │
        ▼
Extract Text Content
(name, biography, publications, quotes)
        │
        ▼
Generate Embedding
(OpenAI API call)
        │
        ▼
Store in ChromaDB
(with metadata: id, name, field, years)
        │
        ▼
Update Complete
```

### 2. Semantic Search Flow

```
User Query ("philosophers who wrote about justice")
        │
        ▼
Generate Query Embedding
(OpenAI API)
        │
        ▼
Search ChromaDB
(cosine similarity)
        │
        ▼
Get Top K Results
(thinker IDs + distances)
        │
        ▼
Fetch Full Thinker Data
(from PostgreSQL)
        │
        ▼
Rank and Format
        │
        ▼
Return to User
```

### 3. RAG Chat Flow

```
User Message ("Who influenced Rawls?")
        │
        ├─────────────────────┐
        ▼                     ▼
Generate Query         Store in
Embedding             Conversation History
        │                     │
        ▼                     │
Search Vector DB              │
(retrieve relevant context)   │
        │                     │
        ▼                     │
Format Context                │
(thinker data, publications)  │
        │                     │
        └─────────┬───────────┘
                  ▼
        Build Prompt
        (context + history + query)
                  │
                  ▼
        LLM API Call
        (DeepSeek)
                  │
                  ▼
        Parse Response
                  │
                  ▼
        Extract Citations
                  │
                  ▼
        Return to User
```

### 4. Connection Suggestion Flow

```
Request Suggestions for Thinker X
        │
        ▼
Fetch Thinker Data
(with existing connections)
        │
        ▼
Find Similar Thinkers
(vector search)
        │
        ▼
Filter Already Connected
        │
        ▼
Build Analysis Prompt
(X's details + candidates' details)
        │
        ▼
LLM Analysis
(DeepSeek evaluates potential connections)
        │
        ▼
Parse Suggestions
(connection type, strength, reasoning)
        │
        ▼
Return Top N Suggestions
```

## Database Schema

### Embeddings Storage (ChromaDB)

**Collection**: `thinkers`

**Document Structure**:
```json
{
  "id": "uuid-string",
  "embedding": [0.1, 0.2, ..., 0.5],  // 1536 dimensions
  "document": "Name: John Rawls | Field: Political Philosophy | Biography: ...",
  "metadata": {
    "thinker_id": "uuid-string",
    "name": "John Rawls",
    "field": "Political Philosophy",
    "birth_year": 1921,
    "death_year": 2002,
    "has_publications": true,
    "publication_count": 5,
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Metadata Filters**:
- `field`: Filter by academic field
- `birth_year >= X AND death_year <= Y`: Filter by time period
- `has_publications = true`: Only thinkers with publications
- `publication_count > N`: Filter by productivity

### Conversation History (PostgreSQL - Optional)

If implementing persistent chat history:

```sql
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY,
    user_id UUID,  -- If multi-user
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES ai_conversations(id),
    role VARCHAR(20),  -- 'user', 'assistant', 'system'
    content TEXT,
    metadata JSONB,  -- citations, context used, etc.
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration

### AI Settings Structure

```python
# backend/app/config/ai_config.py
from pydantic_settings import BaseSettings

class AISettings(BaseSettings):
    # DeepSeek Configuration
    deepseek_api_key: str
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    deepseek_timeout: int = 30
    deepseek_max_retries: int = 3
    deepseek_temperature: float = 0.7
    deepseek_max_tokens: int = 2000

    # OpenAI Configuration (Embeddings)
    openai_api_key: str
    openai_embedding_model: str = "text-embedding-3-small"
    openai_timeout: int = 30
    openai_batch_size: int = 100

    # ChromaDB Configuration
    chroma_persist_directory: str = "./backend/data/chroma"
    chroma_collection_name: str = "thinkers"
    chroma_distance_function: str = "cosine"

    # Feature Flags
    enable_ai_search: bool = True
    enable_ai_chat: bool = True
    enable_ai_suggestions: bool = True
    enable_ai_validation: bool = True

    # Rate Limiting
    rate_limit_per_minute: int = 60
    rate_limit_per_hour: int = 500

    # Caching
    cache_embeddings: bool = True
    cache_search_results: bool = True
    cache_ttl_seconds: int = 3600

    class Config:
        env_file = ".env"
```

## Error Handling

### Error Types

```python
# backend/app/ai/exceptions.py
class AIException(Exception):
    """Base exception for AI features"""
    pass

class EmbeddingGenerationError(AIException):
    """Failed to generate embedding"""
    pass

class VectorSearchError(AIException):
    """Vector database search failed"""
    pass

class LLMAPIError(AIException):
    """LLM API call failed"""
    pass

class RateLimitError(AIException):
    """Rate limit exceeded"""
    pass

class InvalidInputError(AIException):
    """Invalid input provided"""
    pass
```

### Error Handling Strategy

```python
# backend/app/ai/utils.py
from functools import wraps
import logging

logger = logging.getLogger("ai")

def handle_ai_errors(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except EmbeddingGenerationError as e:
            logger.error(f"Embedding generation failed: {e}")
            raise HTTPException(
                status_code=503,
                detail="Embedding service temporarily unavailable"
            )
        except VectorSearchError as e:
            logger.error(f"Vector search failed: {e}")
            raise HTTPException(
                status_code=500,
                detail="Search service error"
            )
        except LLMAPIError as e:
            logger.error(f"LLM API error: {e}")
            raise HTTPException(
                status_code=503,
                detail="AI service temporarily unavailable"
            )
        except RateLimitError as e:
            logger.warning(f"Rate limit hit: {e}")
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later."
            )
    return wrapper
```

## Performance Optimization

### Caching Strategy

```python
# backend/app/ai/cache.py
from functools import lru_cache
from typing import List
import hashlib

class EmbeddingCache:
    def __init__(self, max_size: int = 10000):
        self.cache = {}
        self.max_size = max_size

    def _hash_text(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()

    def get(self, text: str) -> Optional[List[float]]:
        key = self._hash_text(text)
        return self.cache.get(key)

    def set(self, text: str, embedding: List[float]):
        if len(self.cache) >= self.max_size:
            # Remove oldest entry (simple FIFO)
            self.cache.pop(next(iter(self.cache)))

        key = self._hash_text(text)
        self.cache[key] = embedding

# Global cache instance
embedding_cache = EmbeddingCache()
```

### Batch Processing

```python
# backend/app/ai/batch.py
async def batch_generate_embeddings(texts: List[str], batch_size: int = 100):
    """Generate embeddings in batches"""
    results = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        batch_embeddings = await generate_embedding(batch)
        results.extend(batch_embeddings)

    return results
```

## Security

### API Key Protection

```python
# backend/app/api/dependencies.py
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Security(api_key_header)):
    """Verify API key for AI endpoints"""
    from app.config import settings

    if api_key != settings.internal_api_key:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key"
        )

    return api_key
```

### Rate Limiting

```python
# backend/app/api/rate_limit.py
from fastapi import Request, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/search")
@limiter.limit("20/minute")
async def search(request: Request, query: SearchQuery):
    """Rate limited search endpoint"""
    pass
```

## Monitoring

### Metrics Collection

```python
# backend/app/ai/metrics.py
from prometheus_client import Counter, Histogram

# Counters
ai_requests_total = Counter(
    'ai_requests_total',
    'Total AI API requests',
    ['feature', 'status']
)

# Histograms
ai_request_duration = Histogram(
    'ai_request_duration_seconds',
    'AI request duration',
    ['feature']
)

ai_tokens_used = Histogram(
    'ai_tokens_used',
    'Tokens used per request',
    ['feature', 'type']  # type: input/output
)

# Usage
def track_request(feature: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            with ai_request_duration.labels(feature=feature).time():
                try:
                    result = await func(*args, **kwargs)
                    ai_requests_total.labels(
                        feature=feature,
                        status='success'
                    ).inc()
                    return result
                except Exception as e:
                    ai_requests_total.labels(
                        feature=feature,
                        status='error'
                    ).inc()
                    raise
        return wrapper
    return decorator
```

## Testing Strategy

### Unit Tests
- Test embedding generation
- Test vector search
- Test LLM prompt building
- Test response parsing

### Integration Tests
- Test full search flow
- Test RAG chat flow
- Test suggestion flow
- Test with real APIs (dev keys)

### Mocking
```python
# tests/mocks/ai_mocks.py
class MockEmbeddingGenerator:
    async def generate(self, text):
        return [0.1] * 1536  # Fake embedding

class MockLLMClient:
    async def complete(self, prompt, **kwargs):
        return "Mocked LLM response"
```

See [TESTING.md](TESTING.md) for detailed testing documentation.
