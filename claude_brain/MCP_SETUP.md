# Claude Brain MCP Integration Setup

## 🎯 What This Does
Integrates Claude Brain directly into Claude Code so Claude can automatically search your codebase during conversations - no more manual commands!

## 📋 Prerequisites
- ✅ Claude Brain database already created (`embeddings.db`)
- ✅ Your project indexed (you've run `python claude_brain.py ingest /mnt/hdd/photo-process`)
- ✅ OpenAI API key available

## 🚀 Setup Steps

### 1. Find Your Claude Desktop Config File

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

### 2. Add Claude Brain MCP Server

Edit (or create) the config file and add this configuration:

```json
{
  "mcpServers": {
    "claude-brain": {
      "command": "python",
      "args": [
        "/mnt/hdd/photo-process/claude_brain_initial_version/mcp_server.py",
        "--db", "/mnt/hdd/photo-process/claude_brain_initial_version/embeddings.db", 
        "--project-root", "/mnt/hdd/photo-process"
      ],
      "env": {
        "OPENAI_API_KEY": "your-actual-openai-api-key-here"
      }
    }
  }
}
```

**⚠️ Important:** Replace `"your-actual-openai-api-key-here"` with your real OpenAI API key.

### 3. Test the MCP Server (Optional)

Test locally first:
```bash
cd /mnt/hdd/photo-process/claude_brain_initial_version
source venv/bin/activate
export OPENAI_API_KEY="your-key"
python mcp_server.py --project-root /mnt/hdd/photo-process
```

You should see:
```
🚀 Starting Claude Brain MCP Server
📁 Project root: /mnt/hdd/photo-process
🗄️  Database: embeddings.db
🌐 Server: http://localhost:8000
🔧 Ready for Claude Code integration!
```

### 4. Restart Claude Code

1. **Quit Claude Code completely**
2. **Restart Claude Code**
3. **Check for the new tool** - Claude should now have access to `search_codebase`

## 🎮 How to Use

Once set up, Claude Code can automatically search your codebase:

### Example Conversations:

**You:** "How does face recognition work in this project?"
**Claude:** [automatically searches for "face recognition" and finds relevant code]

**You:** "Add a new API endpoint for user authentication" 
**Claude:** [searches for "API endpoint authentication" to understand existing patterns]

**You:** "Fix the mobile app navigation bug"
**Claude:** [searches for "mobile app navigation" to see the current implementation]

## 🔧 Available Tools

Claude will have access to these tools:

### `search_codebase`
- **Purpose:** General semantic search across your entire codebase
- **Example:** Finds authentication code, database schemas, API patterns, etc.

### `search_by_file_type` 
- **Purpose:** Search within specific file types (`.js`, `.ts`, `.py`, etc.)
- **Example:** Find all TypeScript components, Python models, etc.

## 🎯 Expected Results

**Before:** 
- Manual file hunting
- Copy-paste entire files into Claude
- High token usage
- Context switching

**After:**
- Claude automatically finds relevant code
- Precise, focused context
- 90% reduction in tokens
- Seamless conversation flow

## 🐛 Troubleshooting

### "MCP server not found"
- Check the file paths in the config are correct
- Ensure Python virtual environment path is accessible

### "API key error"  
- Replace the placeholder API key with your real key
- Check your OpenAI account has credits

### "No search results"
- Verify your database file exists and has data
- Confirm project-root path is correct

### "Permission denied"
- Make sure the MCP server script is executable
- Check file permissions on the database

## 🧪 Testing

Test the integration with simple queries:
- "Show me the main API routes"
- "How is authentication handled?"
- "Find the mobile app components"

Claude should automatically search and provide relevant code context!

---

🎉 **Once this works, you'll have a completely automated code search system integrated into your Claude sessions!**