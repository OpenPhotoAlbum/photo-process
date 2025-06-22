#!/bin/bash
# Claude Brain Cron Setup Script
# Sets up automated drift detection via cron job

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 Setting up Claude Brain drift detection cron job..."
echo "📁 Project root: $PROJECT_ROOT"
echo "📁 Script directory: $SCRIPT_DIR"

# Create cron job entry
CRON_JOB="0 */4 * * * cd $SCRIPT_DIR && ./venv/bin/python schedule_monitor.py --cron >> /var/log/claude-brain-drift.log 2>&1"

echo "📝 Cron job to add:"
echo "$CRON_JOB"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "schedule_monitor.py"; then
    echo "⚠️  Cron job already exists. Remove it first if you want to update:"
    echo "   crontab -e"
    echo "   # Remove the claude-brain line"
    exit 1
fi

# Add to crontab
echo "➕ Adding cron job (runs every 4 hours)..."
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

if [ $? -eq 0 ]; then
    echo "✅ Cron job added successfully!"
    echo ""
    echo "📋 Current crontab:"
    crontab -l | grep -A 1 -B 1 "schedule_monitor"
    echo ""
    echo "📊 To check drift manually:"
    echo "   npm run mcp:check-drift"
    echo ""
    echo "🗂️  Logs will be written to:"
    echo "   /var/log/claude-brain-drift.log"
    echo ""
    echo "🔄 To remove cron job later:"
    echo "   crontab -e"
else
    echo "❌ Failed to add cron job"
    exit 1
fi