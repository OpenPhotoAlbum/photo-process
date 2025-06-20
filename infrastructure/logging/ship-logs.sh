#!/bin/bash

LOGS_DIR="../../logs/api"
ES_URL="http://localhost:9200"

echo "📦 Shipping photo platform logs to Elasticsearch..."

# Find today's log files
TODAY=${1:-$(date +%Y-%m-%d)}

for logfile in "$LOGS_DIR"/*"$TODAY"*.log; do
    if [[ -f "$logfile" ]]; then
        echo "📄 Processing $(basename "$logfile")..."
        
        # Read each line and send to Elasticsearch
        while IFS= read -r line; do
            # Skip empty lines
            [[ -z "$line" ]] && continue
            
            # Try to parse as JSON, if it fails, wrap as message
            if echo "$line" | jq . >/dev/null 2>&1; then
                # Already valid JSON, ensure consistent data types and add timestamp if missing
                line=$(echo "$line" | jq '
                    # Ensure error.code is always a string
                    if has("error") and (.error | has("code")) then
                        .error.code = (.error.code | tostring)
                    else . end |
                    # Add timestamp if missing
                    if has("@timestamp") then . else . + {"@timestamp": now | strftime("%Y-%m-%dT%H:%M:%S.%3NZ")} end
                ')
            else
                # Plain text, wrap in JSON
                line=$(jq -n --arg msg "$line" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" \
                    '{"message": $msg, "@timestamp": $ts, "level": "info"}')
            fi
            
            # Send to Elasticsearch
            curl -s -X POST "$ES_URL/photo-platform-logs-$TODAY/_doc" \
                -H 'Content-Type: application/json' \
                -d "$line" > /dev/null
                
        done < "$logfile"
        
        echo "✅ Shipped $(basename "$logfile")"
    fi
done

echo "🎉 Log shipping complete!"
echo "🔍 View in Kibana: http://localhost:5601"