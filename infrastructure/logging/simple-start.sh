#!/bin/bash

echo "🔧 Starting simplified ELK without Filebeat for now..."

# Just start Elasticsearch and Kibana
docker-compose -f docker-compose.logging.yml stop filebeat
docker-compose -f docker-compose.logging.yml up -d elasticsearch kibana

echo ""
echo "✅ Elasticsearch and Kibana are running!"
echo "🌐 Kibana: http://localhost:5601"
echo ""
echo "📝 To manually send test data:"
echo "curl -X POST 'localhost:9200/photo-platform-logs-2025.06.19/_doc' -H 'Content-Type: application/json' -d '{\"message\":\"Test log entry\",\"level\":\"info\",\"@timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"}'"