# Claude Brain MCP Integration

The Photo Management Platform includes **Claude Brain**, a semantic codebase search system that integrates with Claude Code via the **Model Context Protocol (MCP)**. This enables Claude Code to automatically search and understand your codebase during development sessions.

## Overview

Claude Brain provides intelligent codebase search capabilities that allow Claude Code to:
- **Semantic Search**: Find relevant code using natural language queries
- **File Type Filtering**: Search within specific file types (.ts, .py, .js, etc.)
- **Contextual Understanding**: Get file paths and code snippets with similarity scores
- **Automatic Integration**: Works seamlessly within Claude Code sessions

## Architecture

```
photo-process/
└── claude_brain/                    # MCP Server Directory
    ├── mcp_server_simple.py         # Main MCP Server
    ├── embeddings.db                # 6GB Indexed Codebase
    ├── venv/                        # Python Virtual Environment
    ├── package.json                 # npm Script Management
    └── embeddings/
        ├── embedding_store.py       # Vector Storage
        └── retrieval_engine.py      # Search Engine
```

### Components

- **MCP Server**: Python-based server implementing Model Context Protocol
- **Embeddings Database**: 6GB SQLite database with semantically indexed codebase
- **npm Scripts**: Easy command management from project root
- **Virtual Environment**: Isolated Python dependencies

## Quick Start

### Prerequisites

- Python 3.12+ with virtual environment
- npm (for script management)
- OpenAI API key configured

### Commands

```bash
# Test MCP server
npm run mcp:test

# Start MCP server (for Claude Code integration)
npm run mcp:start

# Start simple MCP server
npm run mcp:start-simple
```

### Available Tools

When the MCP server is running, Claude Code has access to these tools:

#### `search_codebase`
Search the entire codebase using natural language queries.

**Parameters:**
- `query` (required): Natural language description of what you're looking for
- `max_results` (optional): Maximum number of results (default: 5, max: 20)

**Example Query:** "authentication middleware validation"

#### `search_by_file_type`
Search for code within specific file types.

**Parameters:**
- `query` (required): Search query
- `file_type` (required): File extension (.ts, .py, .js, .md, etc.)
- `max_results` (optional): Maximum number of results (default: 5)

**Example:** Search for "database connection" in TypeScript files

## Database Content

The embeddings database contains a semantic index of the entire platform:

- **Size**: 6GB indexed content
- **Coverage**: All TypeScript, Python, JavaScript, configuration files
- **Excluded**: node_modules, logs, build artifacts, media files (via .brainignore)
- **Index Method**: OpenAI text-embedding-3-small model
- **Chunk Size**: Optimized for code context understanding

## Technical Details

### MCP Protocol Implementation

The server implements the Model Context Protocol specification:

```python
@server.list_tools()
async def list_tools() -> List[Tool]:
    """Defines available tools for Claude Code"""

@server.call_tool()
async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
    """Handles tool execution requests"""
```

### Integration Points

1. **Claude Code CLI**: Automatically detects and uses MCP server
2. **npm Scripts**: Convenient command management
3. **Project Root**: Relative path resolution for clean file references
4. **Error Handling**: Graceful fallbacks and informative error messages

## Configuration

### Environment Setup

The MCP server is configured via:

```json
// claude_brain/package.json
{
  "scripts": {
    "start-mcp": "cd /mnt/hdd/photo-process/claude_brain && ./venv/bin/python mcp_server_simple.py --project-root /mnt/hdd/photo-process"
  }
}
```

### Python Dependencies

```text
# claude_brain/requirements.txt
openai>=1.0.0
numpy>=1.24.0
tiktoken>=0.5.0
mcp>=1.0.0
```

## Development Workflow

### Daily Usage

1. **Start Development Session**:
   ```bash
   npm run mcp:start
   ```

2. **Claude Code Integration**: The MCP server runs in background, ready for Claude Code to use

3. **Automatic Search**: Claude Code will automatically search codebase when needed for context

### Maintenance

- **Database Updates**: Re-index when significant code changes occur
- **Dependency Updates**: Keep MCP and OpenAI packages current
- **Performance Monitoring**: 6GB database provides fast semantic search

## Troubleshooting

### Common Issues

**MCP Server Won't Start**:
```bash
# Check Python environment
cd claude_brain && source venv/bin/activate && python --version

# Verify dependencies
pip list | grep mcp
```

**Search Results Empty**:
- Verify embeddings.db exists and has content
- Check query specificity (too vague queries may return no results)
- Ensure file types exist in project (e.g., searching .java in TypeScript project)

**Performance Issues**:
- 6GB database is memory-intensive; ensure adequate RAM
- Close other applications if experiencing slowdowns
- Consider result limit reduction for faster responses

### Logs and Debugging

```bash
# View MCP server output
npm run mcp:start
# Server logs appear in terminal

# Test connectivity
npm run mcp:test
```

## Future Enhancements

- **Live Reindexing**: Automatic database updates on file changes
- **Specialized Search**: Code-specific search patterns (functions, classes, etc.)
- **Performance Optimization**: Faster embedding generation and retrieval
- **Multi-Model Support**: Alternative embedding models for different use cases

## Integration Benefits

With Claude Brain MCP integration, Claude Code can:

✅ **Understand Project Context**: Instantly access relevant code sections  
✅ **Provide Accurate Suggestions**: Context-aware recommendations  
✅ **Navigate Large Codebases**: Find specific implementations quickly  
✅ **Maintain Consistency**: Reference existing patterns and conventions  
✅ **Debug Effectively**: Locate related code for issue investigation  

This transforms Claude Code from a general assistant into a project-aware development partner that understands your specific codebase architecture and patterns.