#!/bin/bash

echo "=== CompreFace Connectivity Test ==="
echo

echo "1. Testing from HOST machine to CompreFace UI (external access):"
curl -s 'http://localhost:8001/api/v1/recognition/subjects' \
  -H 'x-api-key: 8152b5da-cdd5-4631-b720-80f3907ea64d' | head -3
echo
echo

echo "2. Testing from API container to CompreFace UI (internal network):"
docker compose -f docker-compose.platform.yml exec api curl -s 'http://compreface-ui:80/api/v1/recognition/subjects' \
  -H 'x-api-key: 8152b5da-cdd5-4631-b720-80f3907ea64d' | head -3
echo
echo

echo "3. Testing from API container to CompreFace API directly (internal network):"
docker compose -f docker-compose.platform.yml exec api curl -s 'http://compreface-api:8080/api/v1/recognition/subjects' \
  -H 'x-api-key: 8152b5da-cdd5-4631-b720-80f3907ea64d' | head -3
echo
echo

echo "4. Testing our Photo API endpoints:"
echo "GET /api/persons:"
curl -s http://localhost:9000/api/persons | head -3
echo
echo

echo "5. Container status:"
docker compose -f docker-compose.platform.yml ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" | head -10

echo
echo "=== Configuration Check ==="
echo "CompreFace Base URL configured in API: $(docker compose -f docker-compose.platform.yml exec api printenv COMPREFACE_BASE_URL)"
echo "API can resolve compreface-ui: $(docker compose -f docker-compose.platform.yml exec api nslookup compreface-ui | grep 'Address:' | tail -1)"
echo "API can resolve compreface-api: $(docker compose -f docker-compose.platform.yml exec api nslookup compreface-api | grep 'Address:' | tail -1)"