# AI Technology Stack

Complete specification of the AI/LLM technology stack for the Intellectual Genealogy Mapper.

## Overview

This project uses a cost-effective, high-performance AI stack optimized for academic research workflows.

**Total Monthly Cost**: $1-5 for moderate use (100x cheaper than GPT-4 equivalent)

## Components

### 1. Large Language Model (LLM)

**Provider**: DeepSeek
**Model**: deepseek-chat (V3)
**Purpose**: Text generation, analysis, summarization, reasoning

#### Specifications

**Model Details**:
- Architecture: Mixture-of-Experts (MoE)
- Parameters: 671B total, 37B active per token
- Context Window: 64K tokens
- Training Data: Multilingual, up to 2024
- Capabilities: Code, reasoning, analysis, creative writing

**API Details**:
- Base URL: `https://api.deepseek.com`
- API Style: OpenAI-compatible
- Authentication: Bearer token
- Rate Limits: Varies by tier (default: 60 RPM)

#### Pricing

**Input Tokens**: $0.27 per 1M tokens
**Output Tokens**: $1.10 per 1M tokens

**Comparison**:
| Provider | Model | Input $/M | Output $/M | Total for 1M in + 1M out |
|----------|-------|-----------|------------|--------------------------|
| DeepSeek | V3 | $0.27 | $1.10 | $1.37 |
| OpenAI | GPT-4 Turbo | $10.00 | $30.00 | $40.00 |
| OpenAI | GPT-4o | $2.50 | $10.00 | $12.50 |
| Anthropic | Claude 3.5 Sonnet | $3.00 | $15.00 | $18.00 |
| Anthropic | Claude 3 Haiku | $0.25 | $1.25 | $1.50 |

**Cost Savings**: DeepSeek is ~30x cheaper than GPT-4, ~9x cheaper than GPT-4o, ~13x cheaper than Claude Sonnet.

#### Performance

**Benchmarks** (from DeepSeek documentation):
- MMLU: 88.5% (competitive with GPT-4)
- HumanEval: 90.2% (code generation)
- MATH: 82.3% (mathematical reasoning)
- GSM8K: 92.5% (grade school math)

**Strengths**:
- Strong reasoning capabilities
- Good at structured data extraction
- Multilingual support (Chinese, English, others)
- Fast response times

**Limitations**:
- Newer provider (less ecosystem support)
- May have more hallucinations than GPT-4/Claude
- Smaller community for troubleshooting

#### Use Cases in Project

1. **Connection Suggestions**: Analyze thinker data to suggest relationships
2. **Chat Interface**: Answer research questions about the database
3. **Summarization**: Generate summaries of timelines, thinkers, movements
4. **Validation**: Check data consistency and flag issues
5. **Citation Parsing**: Extract structured data from free-text citations
6. **Literature Review**: Draft literature review sections
7. **Insight Generation**: Identify patterns and trends

### 2. Embedding Model

**Provider**: OpenAI
**Model**: text-embedding-3-small
**Purpose**: Convert text to vectors for semantic search

#### Specifications

**Model Details**:
- Embedding Dimensions: 1536
- Max Input: 8191 tokens
- Output: Float32 array
- Normalized: Yes (unit vectors)

**API Details**:
- Endpoint: `https://api.openai.com/v1/embeddings`
- Authentication: Bearer token
- Rate Limits: 3000 RPM (requests per minute)

#### Pricing

**Cost**: $0.02 per 1M tokens

**Comparison**:
| Provider | Model | Cost $/M tokens | Dimensions |
|----------|-------|-----------------|------------|
| OpenAI | text-embedding-3-small | $0.02 | 1536 |
| OpenAI | text-embedding-3-large | $0.13 | 3072 |
| Voyage AI | voyage-02 | $0.12 | 1024 |
| Cohere | embed-english-v3.0 | $0.10 | 1024 |

**Why OpenAI**: Best quality-to-cost ratio, well-tested, reliable API.

#### Performance

**Retrieval Performance**:
- MTEB Average: 62.3% (competitive)
- Fast generation: ~500ms for 8K tokens
- Good for semantic similarity tasks

**Alternative Considered**: Sentence-Transformers (local, free)
- Model: all-MiniLM-L6-v2
- Dimensions: 384
- Cost: $0 (runs locally)
- Tradeoff: Slightly lower quality, no API dependency

**Decision**: Use OpenAI for simplicity and quality. Can switch to local models later if cost becomes an issue.

#### Use Cases in Project

1. **Semantic Search**: "Find philosophers who wrote about justice"
2. **Similarity Matching**: Find similar thinkers based on description
3. **Auto-tagging**: Suggest tags based on content similarity
4. **Duplicate Detection**: Identify potentially duplicate thinkers
5. **Recommendation**: "People you might want to add"

### 3. Vector Database

**Provider**: Chroma (ChromaDB)
**Type**: Local, embedded vector database
**Purpose**: Store and search embeddings

#### Specifications

**Database Details**:
- Storage Backend: DuckDB + Parquet files
- Index Type: HNSW (Hierarchical Navigable Small World)
- Distance Metrics: Cosine similarity, L2 distance, IP (inner product)
- Persistence: File-based, local storage
- Language: Python (with REST API option)

**Performance**:
- Search Speed: <100ms for 10K vectors, <1s for 100K vectors
- Insertion Speed: ~1000 vectors/second
- Memory Usage: ~1GB per 100K vectors (approximate)

**Limitations**:
- Single machine only (not distributed)
- No built-in replication
- Performance degrades beyond 1M vectors

#### Pricing

**Cost**: $0 (free, open-source)

**Comparison**:
| Provider | Type | Cost | Max Vectors (free) | Scalability |
|----------|------|------|-------------------|-------------|
| Chroma | Local | $0 | Unlimited | ~1M vectors |
| Pinecone | Cloud | $70/mo | 100K (free tier) | Millions |
| Weaviate | Local/Cloud | $0 / varies | Unlimited (local) | Millions |
| Qdrant | Local/Cloud | $0 / varies | Unlimited (local) | Millions |

**Why Chroma**:
- Free and easy to use
- Good Python integration
- Sufficient for academic research scale (<10K thinkers)
- Can migrate to cloud DB later if needed

#### Storage Structure

```
backend/data/chroma/
├── chroma.sqlite3           # Metadata database
└── <collection_uuid>/       # Per-collection data
    ├── index/               # HNSW index files
    │   └── index.bin
    ├── data_level0.bin      # Vector data
    └── header.bin           # Collection metadata
```

**Estimated Storage**:
- 1000 thinkers × 1536 dimensions × 4 bytes = ~6MB
- Plus metadata and index: ~10-15MB total
- Very manageable for local storage

#### Use Cases in Project

1. **Store Embeddings**: All thinker embeddings
2. **Semantic Search**: Query by natural language
3. **Similarity Search**: Find similar thinkers
4. **Filtering**: Combine vector search with metadata filters
5. **RAG Context**: Retrieve relevant context for chat

### 4. Supporting Libraries

#### Python Dependencies

```python
# LLM & Embeddings
openai==1.10.0              # OpenAI client (works with DeepSeek too)

# Vector Database
chromadb==0.4.22            # ChromaDB
pydantic==2.5.0             # Data validation (already in project)

# Utilities
numpy==1.26.3               # Array operations (already in project)
tiktoken==0.5.2             # Token counting
```

#### Optional Dependencies

```python
# For local embeddings (alternative to OpenAI)
sentence-transformers==2.2.2

# For advanced text processing
langchain==0.1.0            # LLM orchestration framework
```

**Decision**: Start without LangChain to keep dependencies minimal. Add if needed for complex workflows.

## Architecture Decisions

### Why DeepSeek?

**Pros**:
- 30x cheaper than GPT-4
- Competitive performance on reasoning tasks
- OpenAI-compatible API (easy integration)
- Good for academic/research text
- 64K context (enough for most queries)

**Cons**:
- Newer provider (established 2023)
- Less ecosystem support than OpenAI
- May need more prompt engineering

**Alternatives Considered**:
- GPT-4o: Better quality but 9x more expensive
- Claude Sonnet: Excellent reasoning but 13x more expensive
- Llama 3 (local): Free but requires GPU, more setup

**Decision**: DeepSeek provides best cost/performance ratio for research use case.

### Why OpenAI Embeddings?

**Pros**:
- Excellent quality-to-cost ratio
- Well-tested and reliable
- Fast API
- Easy to use

**Cons**:
- Not free (but very cheap at $0.02/M)
- External API dependency

**Alternatives Considered**:
- Sentence-Transformers (local): Free but slightly lower quality
- Voyage AI: Better quality but 6x more expensive
- OpenAI large model: Better but 6.5x more expensive

**Decision**: Small model is sufficient for our use case, tiny cost, great reliability.

### Why Chroma?

**Pros**:
- Free and open-source
- Easy to set up (pip install)
- Good Python integration
- File-based persistence (no separate DB server)
- Fast enough for <100K vectors

**Cons**:
- Not distributed (single machine)
- Limited to ~1M vectors before performance issues
- No managed hosting option

**Alternatives Considered**:
- FAISS: Faster but more manual, no metadata support
- Pinecone: Managed but costs $70/month
- Weaviate: More complex setup

**Decision**: Chroma is perfect for academic research scale, can migrate later if needed.

## Cost Analysis

### One-Time Setup Costs

**Initial Embedding Generation** (1000 thinkers):
- Average text per thinker: 500 tokens
- Total tokens: 500K
- OpenAI cost: 500K / 1M × $0.02 = $0.01

**Total Setup**: $0.01

### Monthly Operating Costs

**Scenario: Single Researcher, Moderate Use**

**Embedding Updates** (10% of thinkers updated monthly):
- 100 thinkers × 500 tokens = 50K tokens
- Cost: 50K / 1M × $0.02 = $0.001/month

**LLM Usage**:
- Connection suggestions: 100 queries × 700 tokens avg (500 in + 200 out) = 70K tokens
  - Input: 50K × $0.27/M = $0.0135
  - Output: 20K × $1.10/M = $0.022
  - Total: $0.036
- Chat queries: 200 queries × 1500 tokens avg (1000 in + 500 out) = 300K tokens
  - Input: 200K × $0.27/M = $0.054
  - Output: 100K × $1.10/M = $0.11
  - Total: $0.164
- Summaries: 50 generations × 3000 tokens avg (2000 in + 1000 out) = 150K tokens
  - Input: 100K × $0.27/M = $0.027
  - Output: 50K × $1.10/M = $0.055
  - Total: $0.082
- Validation: 30 checks × 600 tokens avg (500 in + 100 out) = 18K tokens
  - Input: 15K × $0.27/M = $0.004
  - Output: 3K × $1.10/M = $0.003
  - Total: $0.007

**Total Monthly LLM**: $0.289
**Total Monthly Embeddings**: $0.001
**Total Monthly Vector DB**: $0 (local)

**Grand Total**: ~$0.30/month

### Scaling Scenarios

**10,000 Thinkers** (large research project):
- Initial embeddings: $0.10
- Monthly updates (10%): $0.01/month
- LLM usage (same): $0.29/month
- **Total**: $0.30/month (scales well)

**Multiple Researchers** (5 users):
- Embeddings (shared): $0.01/month
- LLM usage (5x): $1.45/month
- **Total**: $1.46/month

**Heavy Usage** (100 queries/day):
- Embeddings: $0.01/month
- LLM: ~$3-5/month
- **Total**: $3-5/month

**Comparison to Alternatives**:
- Same usage with GPT-4: ~$30-100/month
- Same usage with Claude: ~$20-60/month
- Savings: 10-30x cheaper

## API Configuration

### DeepSeek API Setup

```python
# backend/app/config/ai_config.py
from pydantic_settings import BaseSettings

class AISettings(BaseSettings):
    deepseek_api_key: str
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    deepseek_timeout: int = 30
    deepseek_max_retries: int = 3

    class Config:
        env_file = ".env"
```

```python
# backend/app/ai/client.py
from openai import OpenAI
from app.config.ai_config import AISettings

settings = AISettings()

client = OpenAI(
    api_key=settings.deepseek_api_key,
    base_url=settings.deepseek_base_url,
    timeout=settings.deepseek_timeout,
    max_retries=settings.deepseek_max_retries
)
```

### OpenAI API Setup

```python
# backend/app/config/ai_config.py (add to above)
class AISettings(BaseSettings):
    # ... DeepSeek settings ...
    openai_api_key: str
    openai_embedding_model: str = "text-embedding-3-small"
    openai_timeout: int = 30
```

```python
# backend/app/ai/embeddings.py
from openai import OpenAI
from app.config.ai_config import AISettings

settings = AISettings()

embedding_client = OpenAI(
    api_key=settings.openai_api_key,
    timeout=settings.openai_timeout
)
```

### ChromaDB Setup

```python
# backend/app/config/ai_config.py (add to above)
class AISettings(BaseSettings):
    # ... other settings ...
    chroma_persist_directory: str = "./backend/data/chroma"
    chroma_collection_name: str = "thinkers"
    chroma_distance_function: str = "cosine"  # or "l2", "ip"
```

```python
# backend/app/ai/vector_store.py
import chromadb
from chromadb.config import Settings
from app.config.ai_config import AISettings

settings = AISettings()

client = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory=settings.chroma_persist_directory
))
```

## Environment Variables

```bash
# backend/.env

# DeepSeek Configuration
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com

# OpenAI Configuration (for embeddings)
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# ChromaDB Configuration
CHROMA_PERSIST_DIRECTORY=./backend/data/chroma
CHROMA_COLLECTION_NAME=thinkers
CHROMA_DISTANCE_FUNCTION=cosine
```

## Rate Limits & Quotas

### DeepSeek
- **Free Tier**: 60 RPM (requests per minute)
- **Paid Tier**: Higher limits available
- **Concurrency**: 10 concurrent requests
- **Daily Limits**: None specified

### OpenAI (Embeddings)
- **Tier 1** (free): 3,000 RPM, 1M TPM (tokens per minute)
- **Tier 2** ($5 spent): 3,500 RPM, 5M TPM
- **Higher Tiers**: Up to 500M TPM

### ChromaDB
- **Local**: No limits (hardware dependent)
- **Performance**: ~1000 inserts/second, <100ms searches

## Monitoring & Observability

### Metrics to Track

**Usage Metrics**:
- API calls per day/month
- Tokens consumed (input/output)
- Cost per feature/endpoint
- Response times

**Quality Metrics**:
- Search relevance (user feedback)
- Suggestion acceptance rate
- Chat answer quality (user ratings)
- Error rates

**Performance Metrics**:
- API latency (p50, p95, p99)
- Vector search time
- Cache hit rates
- Database size

### Logging

```python
# backend/app/ai/utils.py
import logging
from datetime import datetime

logger = logging.getLogger("ai")

def log_api_call(provider: str, endpoint: str, tokens: dict, duration: float, cost: float):
    logger.info(f"AI API Call", extra={
        "provider": provider,
        "endpoint": endpoint,
        "input_tokens": tokens.get("input"),
        "output_tokens": tokens.get("output"),
        "duration_ms": duration * 1000,
        "cost_usd": cost,
        "timestamp": datetime.utcnow().isoformat()
    })
```

## Future Considerations

### Scaling Beyond 1M Vectors
If database grows beyond Chroma's sweet spot:
- **Option 1**: Migrate to Pinecone (managed, scales to billions)
- **Option 2**: Self-host Weaviate/Qdrant (more control)
- **Option 3**: Partition data (separate collections per timeline/era)

### Model Upgrades
When better models are released:
- **DeepSeek**: Easy to upgrade (just change model name)
- **Embeddings**: May need to regenerate all embeddings (one-time cost)
- **Vector DB**: Compatible with any embedding dimensions

### Multi-Model Support
Future: Allow users to choose their preferred LLM:
- DeepSeek (cheap)
- GPT-4o (balanced)
- Claude Sonnet (highest quality)
- Local models (Llama, privacy)

### Cost Optimization
If costs become an issue:
- Cache frequently requested results
- Batch API calls
- Use cheaper models for simple tasks
- Switch to local embeddings (Sentence-Transformers)
- Implement aggressive rate limiting

## Security & Compliance

### API Key Management
- Store keys in environment variables
- Never commit keys to version control
- Rotate keys quarterly
- Use separate keys for dev/prod

### Data Privacy
- Embedding generation sends text to OpenAI (consider sensitivity)
- LLM queries sent to DeepSeek (external processing)
- Vector database stored locally (good for privacy)
- Consider on-premises alternatives for sensitive research

### Compliance
- Review provider terms of service
- Ensure compliance with institutional policies
- GDPR considerations if handling EU user data
- Academic research exemptions may apply

## Support & Resources

### DeepSeek
- **Website**: https://www.deepseek.com
- **API Docs**: https://api-docs.deepseek.com/
- **Pricing**: https://www.deepseek.com/pricing
- **Status Page**: Check official website

### OpenAI
- **Platform**: https://platform.openai.com
- **Docs**: https://platform.openai.com/docs
- **Pricing**: https://openai.com/api/pricing/
- **Status**: https://status.openai.com

### ChromaDB
- **Website**: https://www.trychroma.com
- **Docs**: https://docs.trychroma.com
- **GitHub**: https://github.com/chroma-core/chroma
- **Discord**: https://discord.gg/MMeYNTmh3x
