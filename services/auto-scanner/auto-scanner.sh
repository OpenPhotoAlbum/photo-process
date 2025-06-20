#!/bin/sh

# Auto Scanner Service
# Continuously processes pending photos in batches

echo "Auto Scanner Starting..."
echo "API URL: ${API_URL}"
echo "Batch Size: ${BATCH_SIZE}"
echo "Scan Interval: ${SCAN_INTERVAL}s"

# Wait for API to be ready
echo "Waiting for API to be ready..."
while ! curl -s "${API_URL}/health" > /dev/null 2>&1; do
    echo "API not ready, waiting 5 seconds..."
    sleep 5
done
echo "API is ready!"

# Function to get file tracker stats
get_file_tracker_stats() {
    curl -s "${API_URL}/scan/status" | grep -o '"file_tracker":{[^}]*}' | grep -o '"pending":[0-9]*' | cut -d':' -f2
}

# Function to start a scan batch
start_scan_batch() {
    echo "$(date): Starting new scan batch with limit: ${BATCH_SIZE}"
    RESPONSE=$(curl -s -X GET "${API_URL}/scan?limit=${BATCH_SIZE}&workers=true")
    echo "$(date): Scan response: ${RESPONSE}"
}

# Track last scan time
LAST_SCAN_TIME=0

# Main scanning loop
while true; do
    # Get current timestamp
    CURRENT_TIME=$(date +%s)
    
    # Check pending count from file tracker
    PENDING=$(get_file_tracker_stats)
    
    if [ -z "$PENDING" ]; then
        echo "$(date): Unable to get pending count, retrying..."
        sleep 10
        continue
    fi
    
    echo "$(date): FileTracker pending files: ${PENDING}"
    
    if [ "$PENDING" = "0" ]; then
        echo "$(date): No pending files. Sleeping for ${SCAN_INTERVAL} seconds..."
        sleep ${SCAN_INTERVAL}
        continue
    fi
    
    # Check if enough time has passed since last scan
    TIME_SINCE_LAST_SCAN=$((CURRENT_TIME - LAST_SCAN_TIME))
    if [ $TIME_SINCE_LAST_SCAN -lt ${SCAN_INTERVAL} ]; then
        WAIT_TIME=$((SCAN_INTERVAL - TIME_SINCE_LAST_SCAN))
        echo "$(date): Waiting ${WAIT_TIME} seconds before next batch..."
        sleep ${WAIT_TIME}
        continue
    fi
    
    # Start a new batch
    start_scan_batch
    LAST_SCAN_TIME=$(date +%s)
    
    # Wait for batch to process (simplified approach)
    echo "$(date): Waiting ${SCAN_INTERVAL} seconds for batch to process..."
    sleep ${SCAN_INTERVAL}
    
    # Show progress
    NEW_PENDING=$(get_file_tracker_stats)
    if [ ! -z "$NEW_PENDING" ] && [ "$NEW_PENDING" != "$PENDING" ]; then
        PROCESSED=$((PENDING - NEW_PENDING))
        echo "$(date): Processed ${PROCESSED} files in last batch"
    fi
done