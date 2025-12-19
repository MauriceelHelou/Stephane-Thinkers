# AI API Endpoints

Complete API reference for AI-powered features in the Intellectual Genealogy Mapper.

## Base URL

```
http://localhost:8001/api/ai
```

## Authentication

AI endpoints use the same authentication as the main API. If implementing user-specific features, include JWT token in Authorization header:

```http
Authorization: Bearer <token>
```

## Rate Limits

- **Default**: 60 requests per minute per IP
- **Search**: 20 requests per minute
- **Chat**: 10 requests per minute
- **Suggestions**: 30 requests per minute

## Endpoints

### 1. Semantic Search

Search for thinkers using natural language queries.

**Endpoint**: `POST /api/ai/search`

**Request Body**:
```json
{
  "query": "philosophers who wrote about social justice",
  "limit": 10,
  "filters": {
    "field": "Political Philosophy",
    "birth_year_min": 1900,
    "birth_year_max": 2000
  }
}
```

**Parameters**:
- `query` (string, required): Natural language search query
- `limit` (integer, optional): Number of results (default: 10, max: 50)
- `filters` (object, optional): Metadata filters
  - `field` (string): Filter by academic field
  - `birth_year_min` (integer): Minimum birth year
  - `birth_year_max` (integer): Maximum birth year
  - `has_publications` (boolean): Only thinkers with publications

**Response**: `200 OK`
```json
{
  "results": [
    {
      "thinker_id": "uuid-string",
      "name": "John Rawls",
      "field": "Political Philosophy",
      "birth_year": 1921,
      "death_year": 2002,
      "relevance_score": 0.92,
      "snippet": "John Rawls wrote extensively about justice as fairness...",
      "match_reason": "Strong semantic match on 'social justice' concepts"
    }
  ],
  "total": 15,
  "query_time_ms": 45
}
```

**Example**:
```bash
curl -X POST http://localhost:8001/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "German idealists who influenced Hegel",
    "limit": 5
  }'
```

**Errors**:
- `400 Bad Request`: Invalid query or parameters
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: AI service temporarily down

---

### 2. RAG Chat

Chat interface for asking questions about your research database.

**Endpoint**: `POST /api/ai/chat`

**Request Body**:
```json
{
  "message": "Who influenced Rawls' theory of justice?",
  "conversation_id": "optional-uuid",
  "include_sources": true
}
```

**Parameters**:
- `message` (string, required): User's question or message
- `conversation_id` (string, optional): Continue existing conversation
- `include_sources` (boolean, optional): Include citations (default: true)

**Response**: `200 OK`
```json
{
  "response": "John Rawls' theory of justice was primarily influenced by Kant's moral philosophy and social contract theorists like Rousseau. His work also drew on utilitarian critiques from Mill and contemporary debates in political philosophy.",
  "conversation_id": "uuid-string",
  "sources": [
    {
      "thinker_id": "uuid-kant",
      "name": "Immanuel Kant",
      "relevance": "Primary philosophical foundation"
    },
    {
      "thinker_id": "uuid-rousseau",
      "name": "Jean-Jacques Rousseau",
      "relevance": "Social contract theory influence"
    }
  ],
  "context_used": 3,
  "response_time_ms": 1250
}
```

**Streaming Response**: `POST /api/ai/chat/stream`

For real-time streaming responses:

```javascript
const response = await fetch('http://localhost:8001/api/ai/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: "Who influenced Rawls?" })
});

const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}
```

**Example**:
```bash
curl -X POST http://localhost:8001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Compare Kant and Hegel on ethics",
    "include_sources": true
  }'
```

**Errors**:
- `400 Bad Request`: Empty message
- `404 Not Found`: Invalid conversation_id
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: AI service temporarily down

---

### 3. Connection Suggestions

Get AI-powered suggestions for potential connections between thinkers.

**Endpoint**: `POST /api/ai/suggest/{thinker_id}`

**Path Parameters**:
- `thinker_id` (UUID, required): ID of the thinker

**Query Parameters**:
- `limit` (integer, optional): Number of suggestions (default: 5, max: 20)
- `min_confidence` (float, optional): Minimum confidence score 0-1 (default: 0.5)

**Response**: `200 OK`
```json
{
  "thinker": {
    "id": "uuid-rawls",
    "name": "John Rawls"
  },
  "suggestions": [
    {
      "suggested_thinker": {
        "id": "uuid-nozick",
        "name": "Robert Nozick",
        "field": "Political Philosophy"
      },
      "connection_type": "critiqued",
      "confidence": 0.95,
      "reasoning": "Nozick's 'Anarchy, State, and Utopia' was written as a direct response to Rawls' 'A Theory of Justice', presenting a libertarian critique of Rawls' difference principle.",
      "suggested_strength": 5,
      "evidence": [
        "Contemporary philosophers in same field",
        "Nozick explicitly references Rawls' work",
        "Opposing views on distributive justice"
      ],
      "bidirectional": false
    },
    {
      "suggested_thinker": {
        "id": "uuid-sen",
        "name": "Amartya Sen",
        "field": "Economics, Philosophy"
      },
      "connection_type": "built_upon",
      "confidence": 0.87,
      "reasoning": "Sen developed the capabilities approach building on Rawls' theory of justice, extending it to economic development and human welfare.",
      "suggested_strength": 4,
      "evidence": [
        "Cites Rawls extensively",
        "Extended Rawlsian framework",
        "Applied theory to development economics"
      ],
      "bidirectional": false
    }
  ],
  "total_analyzed": 150,
  "processing_time_ms": 850
}
```

**Response Fields**:
- `connection_type`: One of `influenced`, `critiqued`, `built_upon`, `synthesized`
- `confidence`: AI confidence score 0-1
- `reasoning`: Explanation for suggestion
- `suggested_strength`: Connection strength 1-5
- `evidence`: List of supporting evidence
- `bidirectional`: Whether connection goes both ways

**Example**:
```bash
curl -X POST http://localhost:8001/api/ai/suggest/uuid-rawls?limit=3
```

**Errors**:
- `404 Not Found`: Thinker not found
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: AI service temporarily down

---

### 4. Batch Connection Suggestions

Get suggestions for multiple thinkers at once.

**Endpoint**: `POST /api/ai/suggest/batch`

**Request Body**:
```json
{
  "thinker_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "limit_per_thinker": 3
}
```

**Response**: `200 OK`
```json
{
  "results": {
    "uuid-1": {
      "suggestions": [...],
      "count": 3
    },
    "uuid-2": {
      "suggestions": [...],
      "count": 3
    }
  },
  "total_suggestions": 6,
  "processing_time_ms": 2100
}
```

---

### 5. Data Validation

AI-powered validation of database quality and consistency.

**Endpoint**: `POST /api/ai/validate`

**Query Parameters**:
- `check_types` (array, optional): Types of checks to run
  - `dates`: Date consistency (birth < death)
  - `connections`: Connection plausibility
  - `duplicates`: Potential duplicate thinkers
  - `semantic`: Semantic inconsistencies

**Response**: `200 OK`
```json
{
  "summary": {
    "total_issues": 15,
    "critical": 3,
    "high": 7,
    "medium": 5,
    "low": 0
  },
  "issues": [
    {
      "severity": "critical",
      "type": "date_inconsistency",
      "thinker_id": "uuid-123",
      "thinker_name": "Example Thinker",
      "issue": "Death year (1850) is before birth year (1900)",
      "suggestion": "Verify dates or swap birth/death years",
      "auto_fixable": true
    },
    {
      "severity": "high",
      "type": "impossible_connection",
      "connection_id": "uuid-456",
      "from_thinker": "Aristotle (384-322 BCE)",
      "to_thinker": "Descartes (1596-1650)",
      "issue": "Connection marked as 'influenced' but thinkers lived 2000 years apart",
      "suggestion": "Change connection type to 'built_upon' or verify accuracy"
    },
    {
      "severity": "medium",
      "type": "possible_duplicate",
      "thinker_ids": ["uuid-789", "uuid-101"],
      "names": ["John Stuart Mill", "J.S. Mill"],
      "similarity_score": 0.92,
      "issue": "These entries may refer to the same person",
      "suggestion": "Review and merge if duplicate"
    }
  ],
  "checked_at": "2025-12-16T19:30:00Z",
  "processing_time_ms": 3500
}
```

**Example**:
```bash
curl -X POST "http://localhost:8001/api/ai/validate?check_types=dates&check_types=connections"
```

---

### 6. Summary Generation

Generate AI summaries of timelines, thinkers, or movements.

**Endpoint**: `POST /api/ai/summarize`

**Request Body**:
```json
{
  "type": "timeline",
  "id": "uuid-timeline",
  "options": {
    "length": "medium",
    "focus": "influences",
    "include_key_figures": true
  }
}
```

**Parameters**:
- `type` (string, required): One of `timeline`, `thinker`, `period`, `field`
- `id` (UUID, optional): ID of specific entity (required for timeline/thinker)
- `options` (object, optional):
  - `length`: `short` (1 paragraph), `medium` (3-5 paragraphs), `long` (detailed)
  - `focus`: `influences`, `debates`, `contributions`, `chronology`
  - `include_key_figures` (boolean): Highlight important thinkers
  - `period` (object): For period summaries: `{ start_year: 1600, end_year: 1800 }`
  - `field` (string): For field summaries: "Political Philosophy"

**Response**: `200 OK`
```json
{
  "summary": "The Enlightenment period (1685-1815) marked a transformative era in Western philosophy...",
  "key_figures": [
    {
      "name": "Immanuel Kant",
      "contribution": "Synthesized rationalism and empiricism"
    },
    {
      "name": "Voltaire",
      "contribution": "Advocate for civil liberties and religious tolerance"
    }
  ],
  "key_themes": [
    "Reason and scientific method",
    "Individual liberty",
    "Social contract theory"
  ],
  "word_count": 450,
  "generation_time_ms": 2100
}
```

**Examples**:
```bash
# Summarize a timeline
curl -X POST http://localhost:8001/api/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "type": "timeline",
    "id": "uuid-enlightenment",
    "options": { "length": "medium" }
  }'

# Summarize a time period
curl -X POST http://localhost:8001/api/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "type": "period",
    "options": {
      "period": { "start_year": 1900, "end_year": 2000 },
      "field": "Analytic Philosophy"
    }
  }'
```

---

### 7. Citation Import

Parse free-text citations into structured publication data.

**Endpoint**: `POST /api/ai/import-citation`

**Request Body**:
```json
{
  "citation": "Rawls, John. A Theory of Justice. Cambridge: Harvard University Press, 1971.",
  "format": "auto"
}
```

**Parameters**:
- `citation` (string, required): Free-text citation
- `format` (string, optional): Citation format `auto`, `mla`, `apa`, `chicago`

**Response**: `200 OK`
```json
{
  "parsed": {
    "title": "A Theory of Justice",
    "year": 1971,
    "author": "John Rawls",
    "publisher": "Harvard University Press",
    "location": "Cambridge",
    "citation_format": "mla"
  },
  "confidence": 0.98,
  "suggested_thinker": {
    "id": "uuid-rawls",
    "name": "John Rawls",
    "match_confidence": 0.95
  },
  "ready_to_import": true
}
```

**Response Fields**:
- `parsed`: Structured publication data
- `confidence`: Parsing confidence 0-1
- `suggested_thinker`: Matched thinker from database (if found)
- `ready_to_import`: Whether data is complete enough to create publication

**Example**:
```bash
curl -X POST http://localhost:8001/api/ai/import-citation \
  -H "Content-Type: application/json" \
  -d '{
    "citation": "Kant, I. (1781). Critique of Pure Reason."
  }'
```

---

### 8. Batch Citation Import

Import multiple citations at once.

**Endpoint**: `POST /api/ai/import-citation/batch`

**Request Body**:
```json
{
  "citations": [
    "Rawls, John. A Theory of Justice. 1971.",
    "Nozick, Robert. Anarchy, State, and Utopia. 1974.",
    "Sen, Amartya. Development as Freedom. 1999."
  ]
}
```

**Response**: `200 OK`
```json
{
  "results": [
    {
      "citation": "Rawls, John. A Theory of Justice. 1971.",
      "parsed": { ... },
      "status": "success"
    },
    {
      "citation": "Nozick, Robert. Anarchy, State, and Utopia. 1974.",
      "parsed": { ... },
      "status": "success"
    }
  ],
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0
  }
}
```

---

### 9. Similar Thinkers

Find thinkers similar to a given thinker based on semantic similarity.

**Endpoint**: `GET /api/ai/similar/{thinker_id}`

**Path Parameters**:
- `thinker_id` (UUID, required): ID of reference thinker

**Query Parameters**:
- `limit` (integer, optional): Number of results (default: 10, max: 50)
- `min_similarity` (float, optional): Minimum similarity score 0-1 (default: 0.5)

**Response**: `200 OK`
```json
{
  "reference_thinker": {
    "id": "uuid-rawls",
    "name": "John Rawls"
  },
  "similar_thinkers": [
    {
      "id": "uuid-dworkin",
      "name": "Ronald Dworkin",
      "field": "Political Philosophy, Law",
      "similarity_score": 0.89,
      "common_themes": [
        "Liberalism",
        "Rights-based theories",
        "Legal philosophy"
      ]
    }
  ]
}
```

---

### 10. AI Status

Check AI services health and status.

**Endpoint**: `GET /api/ai/status`

**Response**: `200 OK`
```json
{
  "status": "operational",
  "services": {
    "embeddings": {
      "status": "operational",
      "provider": "openai",
      "model": "text-embedding-3-small",
      "last_call": "2025-12-16T19:45:00Z"
    },
    "llm": {
      "status": "operational",
      "provider": "deepseek",
      "model": "deepseek-chat",
      "last_call": "2025-12-16T19:44:30Z"
    },
    "vector_db": {
      "status": "operational",
      "provider": "chroma",
      "total_embeddings": 1523,
      "last_update": "2025-12-16T19:30:00Z"
    }
  },
  "usage_today": {
    "search_queries": 45,
    "chat_messages": 12,
    "suggestions_generated": 8,
    "tokens_used": 125000
  }
}
```

---

### 11. Regenerate Embeddings

Manually trigger embedding regeneration for specific thinkers or all.

**Endpoint**: `POST /api/ai/embeddings/regenerate`

**Request Body**:
```json
{
  "thinker_ids": ["uuid-1", "uuid-2"],
  "force": false
}
```

**Parameters**:
- `thinker_ids` (array, optional): Specific thinkers to regenerate (omit for all)
- `force` (boolean, optional): Regenerate even if up-to-date (default: false)

**Response**: `202 Accepted`
```json
{
  "job_id": "uuid-job",
  "status": "queued",
  "total_thinkers": 2,
  "estimated_time_seconds": 5
}
```

**Check Job Status**: `GET /api/ai/embeddings/jobs/{job_id}`

```json
{
  "job_id": "uuid-job",
  "status": "completed",
  "progress": {
    "total": 2,
    "completed": 2,
    "failed": 0
  },
  "started_at": "2025-12-16T19:50:00Z",
  "completed_at": "2025-12-16T19:50:05Z"
}
```

---

## Error Responses

All endpoints follow consistent error response format:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit of 20 requests per minute exceeded",
    "details": {
      "limit": 20,
      "window": "1 minute",
      "retry_after": 45
    }
  }
}
```

### Common Error Codes

- `invalid_request`: Malformed request body or parameters
- `not_found`: Resource not found
- `rate_limit_exceeded`: Too many requests
- `ai_service_unavailable`: External AI service down
- `embedding_generation_failed`: Failed to generate embeddings
- `insufficient_context`: Not enough data for AI analysis
- `timeout`: Request took too long

### HTTP Status Codes

- `200 OK`: Successful request
- `202 Accepted`: Request accepted, processing asynchronously
- `400 Bad Request`: Invalid input
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: AI service temporarily unavailable

---

## Webhooks (Future)

For long-running operations, webhooks can be configured:

**Configure Webhook**: `POST /api/ai/webhooks`

```json
{
  "url": "https://your-domain.com/webhook",
  "events": ["embedding_complete", "validation_complete"],
  "secret": "your-webhook-secret"
}
```

**Webhook Payload**:
```json
{
  "event": "embedding_complete",
  "job_id": "uuid-job",
  "data": {
    "thinker_ids": ["uuid-1", "uuid-2"],
    "successful": 2,
    "failed": 0
  },
  "timestamp": "2025-12-16T19:55:00Z"
}
```

---

## SDKs and Client Libraries

### TypeScript/JavaScript

```typescript
// frontend/src/lib/ai-client.ts
import axios from 'axios';

const aiClient = axios.create({
  baseURL: 'http://localhost:8001/api/ai'
});

export const aiApi = {
  search: async (query: string, filters?: any) =>
    (await aiClient.post('/search', { query, filters })).data,

  chat: async (message: string, conversationId?: string) =>
    (await aiClient.post('/chat', { message, conversation_id: conversationId })).data,

  suggestConnections: async (thinkerId: string, limit: number = 5) =>
    (await aiClient.post(`/suggest/${thinkerId}?limit=${limit}`)).data,

  validate: async (checkTypes?: string[]) =>
    (await aiClient.post('/validate', { check_types: checkTypes })).data,

  summarize: async (type: string, id?: string, options?: any) =>
    (await aiClient.post('/summarize', { type, id, options })).data
};
```

### Python

```python
# Example Python client
import requests

class AIClient:
    def __init__(self, base_url="http://localhost:8001/api/ai"):
        self.base_url = base_url

    def search(self, query, limit=10, filters=None):
        response = requests.post(
            f"{self.base_url}/search",
            json={"query": query, "limit": limit, "filters": filters}
        )
        return response.json()

    def chat(self, message, conversation_id=None):
        response = requests.post(
            f"{self.base_url}/chat",
            json={"message": message, "conversation_id": conversation_id}
        )
        return response.json()

# Usage
client = AIClient()
results = client.search("philosophers who wrote about ethics")
```

---

## Rate Limiting Details

Rate limits are enforced per IP address and reset at the start of each window.

**Headers in Response**:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1702758000
```

**When Rate Limited** (429 response):
```http
Retry-After: 45
```

Wait `Retry-After` seconds before retrying.

---

## Pagination

For endpoints returning large result sets, pagination is supported:

**Query Parameters**:
- `page` (integer): Page number (1-indexed)
- `per_page` (integer): Results per page (default: 10, max: 100)

**Response Metadata**:
```json
{
  "results": [...],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total_pages": 15,
    "total_results": 150
  }
}
```

---

## Best Practices

1. **Cache Results**: AI responses are expensive, cache when possible
2. **Batch Requests**: Use batch endpoints when processing multiple items
3. **Handle Rate Limits**: Implement exponential backoff
4. **Stream Chat Responses**: Use streaming for better UX
5. **Validate Input**: Check input before sending to AI endpoints
6. **Monitor Usage**: Track token usage to manage costs
7. **Handle Errors Gracefully**: Provide fallbacks when AI unavailable
8. **Use Filters**: Narrow search scope with metadata filters for better results

---

## Testing

Use the provided test endpoint to verify AI services without consuming quota:

**Endpoint**: `GET /api/ai/test`

**Response**: `200 OK`
```json
{
  "message": "AI services operational",
  "test_search": true,
  "test_embedding": true,
  "test_llm": true
}
```
