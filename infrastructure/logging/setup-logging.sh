#!/bin/bash

echo "🔍 Setting up Photo Platform Logging Stack"
echo "=========================================="

# Create the photo-platform network if it doesn't exist
echo "📡 Creating Docker network..."
docker network create photo-platform 2>/dev/null || echo "Network already exists"

# Set proper permissions for Elasticsearch and Filebeat
echo "🔒 Setting up permissions..."
sudo mkdir -p elasticsearch_data
sudo chown -R 1000:1000 elasticsearch_data

# Fix Filebeat config ownership (must be owned by root)
echo "🔧 Fixing Filebeat config permissions..."
sudo chown root:root config/filebeat.yml
sudo chmod 600 config/filebeat.yml

# Start the logging stack
echo "🚀 Starting Elasticsearch, Kibana, and Filebeat..."
docker-compose -f docker-compose.logging.yml up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check if Elasticsearch is running
echo "🏥 Checking Elasticsearch health..."
curl -f http://localhost:9200/_cluster/health?pretty || echo "⚠️  Elasticsearch not ready yet"

echo ""
echo "✅ Logging stack setup complete!"
echo ""
echo "🌐 Access your logs at:"
echo "   Elasticsearch: http://localhost:9200"
echo "   Kibana: http://localhost:5601"
echo ""
echo "📊 In Kibana:"
echo "   1. Go to Analytics > Discover"
echo "   2. Create index pattern: photo-platform-logs-*"
echo "   3. Use @timestamp as time field"
echo "   4. Start exploring your logs!"
echo ""
echo "🔍 Useful queries:"
echo "   - level:error (show only errors)"
echo "   - service:photo-platform AND component:face-recognition"
echo "   - @timestamp:[now-1h TO now] (last hour)"