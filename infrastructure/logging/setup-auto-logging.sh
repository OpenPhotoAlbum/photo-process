#!/bin/bash

echo "🚀 Setting up automatic log shipping to Elasticsearch..."

# Create cron job to ship logs every minute for near real-time logging
CRON_JOB="* * * * * /mnt/hdd/photo-process/infrastructure/logging/auto-ship-logs.sh"
SCRIPT_PATH="/mnt/hdd/photo-process/infrastructure/logging/auto-ship-logs.sh"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$SCRIPT_PATH"; then
    echo "✅ Cron job already exists"
else
    # Add the cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Added cron job to ship logs daily at 1 AM"
fi

echo "📋 Current cron jobs:"
crontab -l | grep -E "(ship-logs|auto-ship)" || echo "No log shipping cron jobs found"

echo -e "\n📊 This will automatically ship logs to Elasticsearch every minute"
echo "📁 Logs will be shipped to: http://localhost:9200/photo-platform-logs-*"
echo "🔍 View in Kibana: http://localhost:5601"
echo "📝 Auto-ship log: /mnt/hdd/photo-process/logs/auto-ship.log"

echo -e "\n🔧 To stop automatic shipping: crontab -e (remove the auto-ship-logs.sh line)"