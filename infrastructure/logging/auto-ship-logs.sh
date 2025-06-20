#!/bin/bash

# Auto-ship logs script - runs daily to send logs to Elasticsearch
# This runs automatically so you don't have to ship logs manually

cd /mnt/hdd/photo-process/infrastructure/logging

# Ship today's logs for near real-time logging
TODAY=$(date +%Y-%m-%d)

# Only ship if there are new log entries to avoid spam
LOG_FILE="/mnt/hdd/photo-process/logs/api/api-$TODAY.log"
if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
    echo "$(date): Auto-shipping logs for $TODAY"
    
    ./ship-logs.sh "$TODAY" >> /mnt/hdd/photo-process/logs/auto-ship.log 2>&1
    
    if [ $? -eq 0 ]; then
        echo "$(date): Successfully shipped logs for $TODAY" >> /mnt/hdd/photo-process/logs/auto-ship.log
    else
        echo "$(date): Failed to ship logs for $TODAY" >> /mnt/hdd/photo-process/logs/auto-ship.log
    fi
else
    # Don't log anything if no logs to ship (avoid spam)
    :
fi