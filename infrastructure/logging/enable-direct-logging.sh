#!/bin/bash

echo "🔧 Enabling direct Elasticsearch logging..."

# Update .env file
if grep -q "ENABLE_ELASTICSEARCH_LOGGING=false" /mnt/hdd/photo-process/.env; then
    sed -i 's/ENABLE_ELASTICSEARCH_LOGGING=false/ENABLE_ELASTICSEARCH_LOGGING=true/' /mnt/hdd/photo-process/.env
    echo "✅ Updated .env to enable Elasticsearch logging"
else
    echo "⚠️  ENABLE_ELASTICSEARCH_LOGGING not found or already enabled"
fi

# Install dependencies in API service
echo "📦 Installing Elasticsearch dependencies..."
docker exec photo-api npm install winston-elasticsearch @elastic/elasticsearch@7

# Restart API service
echo "🔄 Restarting API service..."
docker compose -f /mnt/hdd/photo-process/docker-compose.platform.yml restart api

echo "✅ Direct Elasticsearch logging enabled!"
echo "🔍 Check indices with: curl http://localhost:9200/_cat/indices/photo-platform-*"
echo "📊 View logs in Kibana: http://localhost:5601"