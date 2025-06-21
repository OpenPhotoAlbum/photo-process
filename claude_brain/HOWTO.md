# Claude Brain - How To Use

The Claude Brain system creates a searchable memory of your codebase that you can query to find relevant context for Claude coding sessions. Instead of manually hunting through files or explaining your entire architecture, you get precise, relevant code snippets to include in your conversations with Claude.

## Prerequisites

- Python 3.7+
- OpenAI API key
- Your codebase (any combination of Python, JavaScript, TypeScript, Markdown, JSON, HTML, CSS, etc.)

## Setup (One Time Only)

### 1. Install Dependencies
```bash
pip install openai numpy
```

### 2. Set Your OpenAI API Key
```bash
# Linux/Mac
export OPENAI_API_KEY="your-api-key-here"

# Windows
set OPENAI_API_KEY=your-api-key-here
```

### 3. Initialize the Brain Database
```bash
python claude_brain.py init
```
This creates an SQLite database (`embeddings.db`) to store your code embeddings.

## Daily Workflow

### Step 1: Feed Your Codebase to the Brain

**For a single project:**
```bash
python claude_brain.py ingest /path/to/your/project
```

**For just one directory (non-recursive):**
```bash
python claude_brain.py ingest /path/to/directory --no-recursive
```

**For a single file:**
```bash
python claude_brain.py ingest /path/to/specific/file.py
```

**What happens:** The system reads your files, extracts structure (classes, functions, imports), breaks code into smart chunks, and creates searchable embeddings. This takes a few minutes for large projects but only needs to be done once.

### Step 2: Search for Relevant Context

Before starting any coding task, search for related code:

```bash
# Find authentication-related code
python claude_brain.py search "user authentication login middleware" -n 5

# Find database patterns
python claude_brain.py search "database connection query model" -n 3

# Find API endpoint examples
python claude_brain.py search "API route handler express fastapi" -n 4

# Show full content of results
python claude_brain.py search "error handling try catch" --show-content
```

**Search Tips:**
- Use specific technical terms from your domain
- Include multiple related keywords
- Start broad, then narrow down
- Use `-n` to control number of results (default: 5)

### Step 3: Use Results in Claude Sessions

The search returns ranked results showing:
- **Similarity score** (higher = more relevant)
- **Source file** (exact location)
- **Code snippet** (the relevant chunk)

Copy the relevant snippets into your Claude conversation:

```
I'm working on a Node.js app and need to add user authentication. 
Here's how authentication is currently implemented:

[paste relevant search results]

Now I need to add two-factor authentication. Can you help me extend this pattern?
```

## Advanced Usage

### Generate CLAUDE.md Summaries
Create structured documentation for any module:
```bash
python claude_brain.py generate-claude-md /path/to/module
```
This creates a `CLAUDE.md` file summarizing all classes and functions in the module.

### Re-index After Major Changes
When you add significant new code or refactor:
```bash
# Re-ingest the updated project
python claude_brain.py ingest /path/to/your/project
```
The system will add new embeddings alongside existing ones.

### Multiple Projects
Use different databases for different projects:
```bash
python claude_brain.py --db project1.db ingest /path/to/project1
python claude_brain.py --db project2.db ingest /path/to/project2

# Search specific project
python claude_brain.py --db project1.db search "authentication"
```

## Real-World Examples

### Example 1: Adding a New API Endpoint
```bash
# Find existing API patterns
python claude_brain.py search "express router app.get app.post" -n 3

# Find authentication middleware
python claude_brain.py search "middleware auth require" -n 2

# Find validation patterns
python claude_brain.py search "validation joi schema" -n 2
```

Copy relevant results into Claude: "I need to create a new `/api/users/profile` endpoint following these patterns..."

### Example 2: Debugging Database Issues
```bash
# Find database connection code
python claude_brain.py search "database connection pool mongoose" -n 3

# Find similar error patterns
python claude_brain.py search "database error handling timeout" -n 3
```

### Example 3: Understanding Component Architecture
```bash
# Find React component patterns
python claude_brain.py search "component props useState useEffect" -n 5

# Find state management
python claude_brain.py search "redux context provider store" -n 3
```

## Supported File Types

The brain automatically processes:
- **Code:** `.py`, `.js`, `.ts`, `.jsx`, `.tsx`
- **Web:** `.html`, `.css`, `.json`
- **Docs:** `.md`, `.txt`, `.yaml`, `.yml`

For each file type, it extracts appropriate structure (functions, classes, exports) and creates intelligent summaries.

## Tips for Best Results

1. **Use specific technical vocabulary** - Search for actual function names, library names, patterns you use
2. **Include context keywords** - "database query", "API endpoint", "React component"
3. **Start with broad searches** then narrow down
4. **Re-index periodically** as your codebase grows
5. **Use multiple search queries** to gather comprehensive context

## Troubleshooting

**"No results found":**
- Check that you've ingested the relevant code
- Try broader search terms
- Verify your database path is correct

**"Error getting embeddings":**
- Check your OpenAI API key is set correctly
- Verify internet connection
- Check API usage limits

**Large codebases taking too long:**
- Process specific directories first: `python claude_brain.py ingest src/`
- Use `--no-recursive` for shallow processing
- Consider splitting very large projects into multiple databases

## Cost Considerations

OpenAI embeddings cost approximately $0.0001 per 1K tokens. A typical medium-sized project (50,000 lines of code) costs roughly $2-5 to fully index. Search queries are essentially free since they only embed your query text.

## Next Steps

Once you're comfortable with basic usage:
1. Experiment with different search strategies for your codebase
2. Create project-specific databases for better organization
3. Use the generated CLAUDE.md files as additional context
4. Integrate searches into your development workflow