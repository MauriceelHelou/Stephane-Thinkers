# AI Features Overview

This directory contains comprehensive documentation for the AI/LLM integration in the Intellectual Genealogy Mapper.

## Technology Stack

**LLM**: DeepSeek V3 (via OpenAI-compatible API)
**Embeddings**: OpenAI text-embedding-3-small
**Vector Database**: Chroma (ChromaDB)
**Cost**: ~$1-5/month for moderate academic use

## Documentation Structure

### Core Documentation
1. **[STACK.md](STACK.md)** - Detailed technology stack specifications, costs, and setup
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and component design
3. **[IMPLEMENTATION.md](IMPLEMENTATION.md)** - Implementation guide and code structure
4. **[API.md](API.md)** - AI API endpoints and usage examples
5. **[FEATURES.md](FEATURES.md)** - AI-powered features and capabilities

### Reference Documentation
6. **[EMBEDDINGS.md](EMBEDDINGS.md)** - Embedding generation and management
7. **[VECTOR-DB.md](VECTOR-DB.md)** - ChromaDB setup and operations
8. **[DEEPSEEK.md](DEEPSEEK.md)** - DeepSeek API integration guide
9. **[PROMPTS.md](PROMPTS.md)** - Prompt engineering templates
10. **[TESTING.md](TESTING.md)** - Testing AI features

## Quick Start

### Prerequisites
```bash
# Install dependencies
cd backend
source venv/bin/activate
pip install chromadb==0.4.22 openai==1.10.0 sentence-transformers==2.2.2
```

### Environment Variables
```bash
# Add to backend/.env
DEEPSEEK_API_KEY=your-deepseek-api-key
OPENAI_API_KEY=your-openai-api-key  # For embeddings only
```

### Initialize AI System
```python
from app.ai.embeddings import initialize_vector_store
from app.ai.client import test_connection

# Test API connection
test_connection()

# Initialize vector database
initialize_vector_store()
```

## AI Features

### Phase 1: Foundation (Implemented)
- Semantic search across thinkers
- Embedding generation and storage
- Vector database integration

### Phase 2: Analysis (In Progress)
- Connection suggestions
- Influence network analysis
- Quality validation

### Phase 3: Research Assistant (Planned)
- RAG-based chat interface
- Literature review generation
- Summary generation
- Citation import/parsing

### Phase 4: Advanced (Future)
- Real-time collaboration with AI
- Automated research insights
- Trend analysis
- Comparative analysis

## Cost Estimates

### Monthly Costs (Single Researcher, Moderate Use)

**Embedding Generation** (OpenAI):
- 1000 thinkers × 500 tokens average = 500K tokens
- One-time cost: $0.01
- Updates (10% monthly): $0.001/month

**LLM Usage** (DeepSeek):
- 100 connection suggestions: $0.04
- 200 chat queries: $0.16
- 50 summaries: $0.08
- 30 validation checks: $0.02
- **Total: $0.30/month**

**Total Monthly Cost**: ~$0.30 (embeddings are one-time)

**Annual Cost**: ~$3.60 + initial $0.01 embedding cost

Compare to GPT-4 equivalent: ~$360/year (100x more expensive)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Search  │  │   Chat   │  │ Suggest  │  │ Summary  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │             │              │              │         │
└───────┼─────────────┼──────────────┼──────────────┼─────────┘
        │             │              │              │
        ▼             ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Layer                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              /api/ai/* Endpoints                     │  │
│  └──────────────────────────────────────────────────────┘  │
│       │             │              │              │         │
│       ▼             ▼              ▼              ▼         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Search  │  │   Chat   │  │ Suggest  │  │ Summary  │  │
│  │  Module  │  │  Module  │  │  Module  │  │  Module  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼──────────────┼──────────────┼─────────┘
        │             │              │              │
        │             └──────┬───────┴──────────────┘
        │                    │
        ▼                    ▼
┌──────────────┐    ┌──────────────────────┐
│   ChromaDB   │    │   DeepSeek API       │
│  (Local)     │    │   (External)         │
│              │    │                      │
│ - Embeddings │    │ - Text Generation    │
│ - Metadata   │    │ - Analysis           │
│ - Search     │    │ - Summarization      │
└──────────────┘    └──────────────────────┘
        ▲
        │
┌──────────────────┐
│  OpenAI API      │
│  (External)      │
│                  │
│ - Embeddings     │
│   Generation     │
└──────────────────┘
```

## File Structure

```
backend/
├── app/
│   ├── ai/
│   │   ├── __init__.py
│   │   ├── client.py           # DeepSeek API client
│   │   ├── embeddings.py       # Embedding generation (OpenAI)
│   │   ├── vector_store.py     # ChromaDB operations
│   │   ├── search.py           # Semantic search
│   │   ├── suggestions.py      # Connection suggestions
│   │   ├── chat.py             # RAG chat interface
│   │   ├── summaries.py        # Text summarization
│   │   ├── validation.py       # Quality checks
│   │   └── utils.py            # Helper functions
│   ├── routes/
│   │   └── ai.py               # AI API endpoints
│   └── config/
│       └── ai_config.py        # AI configuration
├── data/
│   └── chroma/                 # ChromaDB persistence
│       ├── index/
│       ├── metadata/
│       └── documents/
├── docs/
│   └── ai-overview/            # This documentation
└── tests/
    └── test_ai/                # AI feature tests
        ├── test_embeddings.py
        ├── test_search.py
        └── test_suggestions.py
```

## Security Considerations

**API Keys**:
- Store in `.env` file (never commit)
- Use environment variables in production
- Rotate keys regularly

**Data Privacy**:
- Embeddings are generated externally (OpenAI API)
- LLM queries sent to DeepSeek (external)
- ChromaDB stored locally
- Consider data sensitivity before using external APIs

**Rate Limiting**:
- Implement per-user rate limits
- Cache responses when possible
- Batch operations where appropriate

## Performance Optimization

**Embedding Caching**:
- Generate embeddings once per thinker
- Regenerate only on content changes
- Store embeddings in ChromaDB

**Query Optimization**:
- Limit search results (default: 10)
- Use metadata filtering in ChromaDB
- Cache frequent queries

**LLM Optimization**:
- Use appropriate temperature settings
- Limit context size
- Stream responses for better UX

## Development Workflow

### 1. Local Development
```bash
# Start backend with AI features
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8001
```

### 2. Testing
```bash
# Run AI tests
pytest tests/test_ai/ -v

# Test specific feature
pytest tests/test_ai/test_search.py -v
```

### 3. Monitoring
```bash
# Check ChromaDB status
python -c "from app.ai.vector_store import check_status; check_status()"

# Count embeddings
python -c "from app.ai.vector_store import count_embeddings; print(count_embeddings())"
```

## Troubleshooting

### ChromaDB Issues
- **Error**: "Collection not found"
  - Solution: Run `initialize_vector_store()`
- **Error**: "Permission denied"
  - Solution: Check `backend/data/chroma/` permissions
- **Slow searches**:
  - Solution: Reduce result limit or rebuild index

### API Issues
- **Error**: "Invalid API key"
  - Solution: Check `.env` file for correct keys
- **Error**: "Rate limit exceeded"
  - Solution: Wait or upgrade API tier
- **Slow responses**:
  - Solution: Reduce context size or use caching

### Embedding Issues
- **Error**: "Embedding dimension mismatch"
  - Solution: Recreate ChromaDB collection with correct dimensions
- **Poor search results**:
  - Solution: Regenerate embeddings with more context

## Best Practices

**Embedding Generation**:
- Include relevant context (biography, publications, quotes)
- Keep text chunks under 8000 tokens (OpenAI limit)
- Update embeddings when content changes

**Prompt Engineering**:
- Be specific and clear
- Provide examples for complex tasks
- Use system messages for role/context
- See [PROMPTS.md](PROMPTS.md) for templates

**Error Handling**:
- Graceful fallbacks for API failures
- User-friendly error messages
- Log errors for debugging

**Testing**:
- Test with sample data first
- Mock external APIs in tests
- Measure response times

## Migration & Upgrades

### Upgrading DeepSeek Models
When new models are released:
1. Update `app/ai/client.py` model name
2. Test with sample queries
3. Compare output quality
4. Update documentation

### Changing Vector Database
To migrate from Chroma to another DB:
1. Export embeddings from Chroma
2. Set up new vector DB
3. Import embeddings
4. Update `app/ai/vector_store.py`
5. Test search functionality

### Switching LLM Providers
To switch from DeepSeek:
1. Update `app/ai/client.py` with new provider
2. Adjust prompts if needed (different models have different styles)
3. Test all AI features
4. Monitor costs

## Contributing

When adding new AI features:
1. Follow existing code structure
2. Add tests for new functionality
3. Update relevant documentation
4. Consider cost implications
5. Add usage examples

## Support & Resources

**DeepSeek**:
- API Docs: https://api-docs.deepseek.com/
- Pricing: https://www.deepseek.com/pricing

**OpenAI Embeddings**:
- API Docs: https://platform.openai.com/docs/guides/embeddings
- Pricing: https://openai.com/api/pricing/

**ChromaDB**:
- Docs: https://docs.trychroma.com/
- GitHub: https://github.com/chroma-core/chroma

## Roadmap

### Q1 2025
- Complete semantic search implementation
- Add connection suggestion feature
- Implement basic RAG chat

### Q2 2025
- Literature review generation
- Citation import/parsing
- Advanced validation

### Q3 2025
- Multi-model support
- Custom fine-tuning options
- Advanced analytics

### Q4 2025
- Real-time collaboration features
- Automated research insights
- Performance optimizations

## License

This AI integration follows the same license as the main project. API usage subject to provider terms of service.
