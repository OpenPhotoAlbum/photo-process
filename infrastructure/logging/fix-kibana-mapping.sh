#!/bin/bash

echo "🔧 Fixing Kibana field mapping conflicts..."

# Apply the index template for consistent field mappings
echo "📝 Applying Elasticsearch index template..."
curl -X PUT "http://localhost:9200/_index_template/photo-platform-template" \
    -H 'Content-Type: application/json' \
    -d @elasticsearch-mapping.json

if [ $? -eq 0 ]; then
    echo -e "\n✅ Index template applied successfully"
else
    echo -e "\n❌ Failed to apply index template"
    exit 1
fi

echo -e "\n🗑️  To completely fix existing mapping conflicts, you may need to:"
echo "1. Delete problematic indices in Kibana: Stack Management → Index Management"
echo "2. Or delete all photo-platform indices and re-ship logs:"
echo "   curl -X DELETE 'http://localhost:9200/photo-platform-*'"
echo "   ./ship-logs.sh 2025-06-19"

echo -e "\n📊 Current indices:"
curl -s "http://localhost:9200/_cat/indices/photo-platform-*"

echo -e "\n🔍 Open Kibana at http://localhost:5601"
echo "   Go to Stack Management → Index Patterns → Create index pattern"
echo "   Use pattern: photo-platform-* or photo-platform-logs-*"