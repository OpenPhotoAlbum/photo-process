# Auto Scanner Service

Automatically processes pending photos in the background whenever the containers are running.

## Features

- Continuously monitors pending files via FileTracker
- Processes photos in configurable batches
- Prevents concurrent scan conflicts
- Tracks progress between batches
- Automatically stops when no files remain

## Configuration

Environment variables:
- `BATCH_SIZE` - Number of files per batch (default: 50)
- `SCAN_INTERVAL` - Seconds between batches (default: 60)
- `API_URL` - Internal API URL (default: http://api:9000)

## Usage

### Option 1: Docker Container (Recommended)

The auto-scanner runs as a separate container:

```bash
# Start with auto-scanner
docker compose -f docker-compose.platform.yml up -d

# View logs
docker logs photo-auto-scanner -f

# Stop auto-scanner only
docker compose -f docker-compose.platform.yml stop auto-scanner

# Configure batch size
export AUTO_SCAN_BATCH_SIZE=100
docker compose -f docker-compose.platform.yml up -d auto-scanner
```

### Option 2: Built-in API Scanner

Enable in the API service:

```bash
# Add to .env
AUTO_SCAN_ENABLED=true
AUTO_SCAN_BATCH_SIZE=50
AUTO_SCAN_INTERVAL=60
AUTO_SCAN_START_DELAY=30

# Restart API
docker compose -f docker-compose.platform.yml restart api
```

## Monitoring

Check progress:
```bash
# View current pending count
curl http://localhost:9000/scan/status | jq '.file_tracker.pending'

# Watch auto-scanner logs
docker logs photo-auto-scanner -f --tail 50
```

## Performance Tuning

For 233,850 pending files:

- **Small batches (50)**: Safer, less memory, ~80 days to complete
- **Medium batches (100)**: Balanced, ~40 days to complete  
- **Large batches (500)**: Faster but more memory, ~8 days to complete

Adjust based on your system resources:
```bash
# High performance
export AUTO_SCAN_BATCH_SIZE=500
export AUTO_SCAN_INTERVAL=30

# Conservative
export AUTO_SCAN_BATCH_SIZE=25
export AUTO_SCAN_INTERVAL=120
```

## Troubleshooting

If scanning stops:
1. Check logs: `docker logs photo-auto-scanner`
2. Verify API is running: `curl http://localhost:9000/health`
3. Check pending count: `curl http://localhost:9000/scan/status | jq '.file_tracker'`
4. Restart scanner: `docker compose -f docker-compose.platform.yml restart auto-scanner`