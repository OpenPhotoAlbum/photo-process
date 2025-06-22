# Claude Brain - Semantic Codebase Search & MCP Integration

Advanced semantic search system for codebases with automated drift detection and Claude Code MCP integration.

## 🎯 What This Is

Claude Brain provides intelligent semantic search capabilities for your entire codebase, allowing natural language queries to find relevant code sections. It integrates seamlessly with Claude Code as an MCP (Model Context Protocol) server, giving Claude automatic access to your codebase during conversations.

## 🏗️ Architecture

```
claude_brain/
├── claude_brain.py              # Main ingestion system
├── embeddings/
│   ├── embedding_store.py       # SQLite storage with 6GB database
│   └── retrieval_engine.py      # Semantic search engine
├── mcp_server_simple.py         # MCP server for Claude Code integration
├── drift_monitor.py             # Automated drift detection system
├── schedule_monitor.py          # Continuous monitoring service
├── cleanup_database.py          # Database maintenance utilities
├── setup-cron.sh               # Automated cron job setup
├── .brainignore                # Smart filtering patterns
└── embeddings.db               # 6GB semantic embeddings database
```

## 🚀 Quick Start

### 1. Basic Setup
```bash
# Create embeddings database (first time)
npm run mcp:rebuild

# Start MCP server for Claude Code
npm run mcp:start

# Test semantic search
npm run mcp:test
```

### 2. Drift Detection
```bash
# Check if database is current
npm run mcp:check-drift

# Auto-update if changes detected
npm run mcp:auto-update

# Start continuous monitoring
npm run mcp:monitor
```

### 3. Claude Code Integration
Once the MCP server is running, Claude Code automatically gains access to semantic search tools:
- `search_codebase`: Natural language search across entire project
- `search_by_file_type`: Filter search by file extensions

## 🔄 Automated Drift Detection

### What It Does
Automatically monitors your codebase for changes and keeps the embeddings database current without manual intervention.

### Key Features
- **File Change Detection**: Hash-based monitoring of all trackable files
- **Smart Filtering**: Excludes logs, binaries, node_modules, and large data files via `.brainignore`
- **Automatic Updates**: Triggers rebuilds when significant drift is detected
- **Continuous Monitoring**: Optional background service with configurable intervals
- **Cron Integration**: Easy setup for scheduled drift checks

### How It Works
1. **File State Tracking**: Maintains cache of all trackable files with hashes and timestamps
2. **Change Detection**: Compares current vs cached state to identify new/modified/deleted files
3. **Database Alignment**: Ensures database contains current filesystem state
4. **Automatic Rebuilds**: Triggers clean rebuilds when drift exceeds threshold
5. **Smart Filtering**: Uses enhanced `.brainignore` to exclude unwanted files

## 📋 Available Commands

### MCP Server Management
```bash
npm run mcp:start           # Start MCP server for Claude Code integration
npm run mcp:start-simple    # Start simple MCP server version
npm run mcp:test           # Test MCP server functionality
```

### Database Management
```bash
npm run mcp:rebuild        # Full database rebuild with current codebase
npm run mcp:inject         # Same as rebuild (alternative name)
npm run mcp:cleanup-db     # Clean unwanted files from existing database
```

### Drift Detection & Monitoring
```bash
npm run mcp:check-drift    # Check for changes since last database update
npm run mcp:auto-update    # Check drift and auto-rebuild if needed
npm run mcp:monitor        # Start continuous monitoring service
npm run mcp:monitor-once   # Single check and update if needed
npm run mcp:update-cache   # Update drift detection cache
```

### Scheduled Monitoring
```bash
# Set up automated drift detection (runs every 4 hours)
./claude_brain/setup-cron.sh

# Manual monitoring with custom intervals
cd claude_brain
./venv/bin/python schedule_monitor.py --interval 30  # Check every 30 minutes
```

## 🔍 Usage Examples

### Natural Language Searches
When Claude Code is connected to the MCP server, you can ask questions like:
- "How does face recognition work in this project?"
- "Show me the database connection code"
- "Find all TypeScript API routes"
- "Where is the mobile app navigation implemented?"

Claude automatically searches your codebase and provides relevant code context.

### Manual Drift Checks
```bash
# Check what's changed since last update
npm run mcp:check-drift

# Example output:
📊 Claude Brain Drift Report
🔄 Filesystem Changes: 15 new files, 8 modified files
🗄️ Database Alignment: 23 files missing from database
⚠️ UPDATE RECOMMENDED: Drift detected!
```

### Continuous Monitoring
```bash
# Start background monitoring service
npm run mcp:monitor

# Output:
🔄 Starting Claude Brain continuous monitoring...
📅 Check interval: 60 minutes
⏰ 2025-06-21 19:30:00 - Checking Claude Brain drift...
✅ No drift detected - database is current
```

## 🗄️ Database Details

### Size & Performance
- **Database Size**: ~6GB for complete photo-process project
- **Total Embeddings**: 385K+ code chunks
- **File Coverage**: 4,600+ trackable files
- **Search Speed**: Sub-second semantic queries
- **Storage**: SQLite with optimized indexing

### Tracked File Types
- **Code**: `.ts`, `.js`, `.py`, `.tsx`, `.jsx`, `.java`, `.cpp`, `.c`, `.h`
- **Config**: `.yml`, `.yaml`, `.json`, `.xml`, `.sql`
- **Documentation**: `.md`, `.txt`
- **Scripts**: `.sh`, `.bash`, `.zsh`, `.ps1`
- **Special**: `Dockerfile`, `Makefile`, etc.

### Smart Filtering (`.brainignore`)
Excludes unwanted content:
- Dependencies: `node_modules/`, `venv/`, Python packages
- Build outputs: `build/`, `dist/`, temporary files
- Logs: All `.log` files and log directories
- Media: Images, videos, binary files
- Data: Large SQL seed files, CSV data
- OS/IDE: `.DS_Store`, `.vscode/`, cache directories

## 🔧 Configuration

### MCP Server Configuration
The MCP server can be configured via command line arguments:
```bash
./venv/bin/python mcp_server_simple.py \
  --db embeddings.db \
  --project-root /mnt/hdd/photo-process
```

### Drift Monitoring Configuration
```bash
# Custom monitoring intervals
./venv/bin/python schedule_monitor.py --interval 30  # 30 minutes

# Run once and exit
./venv/bin/python drift_monitor.py --once

# Auto-update mode
./venv/bin/python drift_monitor.py --auto-update
```

## 🐛 Troubleshooting

### Common Issues

**"MCP server not responding"**
- Check if server is running: `ps aux | grep mcp_server`
- Restart server: `npm run mcp:start`
- Check logs for Python errors

**"No search results found"**
- Verify database exists: `ls -la embeddings.db`
- Check database size: should be several GB
- Rebuild if corrupted: `npm run mcp:rebuild`

**"Drift detection not working"**
- Check cache file: `ls -la drift_cache.json`
- Update cache manually: `npm run mcp:update-cache`
- Verify .brainignore patterns are correct

**"Database rebuild taking too long"**
- Check .brainignore excludes large files
- Monitor progress in terminal output
- Consider running in background: `npm run mcp:rebuild &`

### Performance Tips
- Run drift checks before major development sessions
- Use continuous monitoring for active development
- Set up cron jobs for automated maintenance
- Clean database periodically: `npm run mcp:cleanup-db`

## 📊 Monitoring & Analytics

### File Coverage Statistics
```bash
# Get current drift status
npm run mcp:check-drift

# View detailed database statistics
./venv/bin/python -c "
import sqlite3
db = sqlite3.connect('embeddings.db')
cursor = db.cursor()
cursor.execute('SELECT COUNT(*) FROM embeddings')
print(f'Total embeddings: {cursor.fetchone()[0]}')
"
```

### Log Files
- Drift detection logs: `/var/log/claude-brain-drift.log` (if using cron)
- MCP server logs: Console output from `npm run mcp:start`
- Ingestion logs: `injest.log` in claude_brain directory

## 🎯 Benefits

### For Development
- **90% token reduction** in Claude Code conversations
- **Automatic context discovery** - no manual file hunting
- **Always current** - drift detection keeps database updated
- **Intelligent filtering** - only relevant code, no noise

### For Code Understanding
- **Semantic search** finds related concepts, not just keywords
- **Cross-language search** works across TypeScript, Python, config files
- **Pattern discovery** identifies similar implementations
- **Architecture mapping** understands project structure

### For Maintenance
- **Automated updates** - set and forget drift detection
- **Performance monitoring** - track database size and coverage
- **Easy cleanup** - remove unwanted embedded content
- **Flexible scheduling** - cron jobs or continuous monitoring

## 🚀 Future Enhancements

### Planned Features
- **Incremental updates**: Update only changed files instead of full rebuilds
- **Multiple projects**: Support for multiple codebase databases
- **Advanced filtering**: More sophisticated .brainignore patterns
- **Performance metrics**: Detailed analytics on search usage and accuracy
- **Integration APIs**: REST endpoints for external tool integration

### Contributing
The drift detection system is modular and extensible. Key areas for enhancement:
- Additional file type support in `drift_monitor.py`
- Enhanced filtering patterns in `.brainignore`
- Performance optimizations in database rebuild process
- Additional monitoring and alerting features

---

🎉 **Claude Brain provides intelligent, automated semantic search that keeps your codebase knowledge current and accessible through natural language queries!**