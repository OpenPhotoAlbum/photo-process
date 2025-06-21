# Deployment Guide

Deploy the Photo Management Platform to production environments.

## Docker Deployment (Recommended)

### Production Docker Compose

```bash
# Start all services in production mode
docker compose -f docker-compose.platform.yml up -d

# Check service status
docker compose -f docker-compose.platform.yml ps

# View logs
docker compose -f docker-compose.platform.yml logs -f api
```

### Environment Configuration

Create production `.env` file:

```bash
# Database
MYSQL_HOST=localhost
MYSQL_PORT=3307
MYSQL_USER=photo
MYSQL_PASSWORD=your-secure-password
MYSQL_DATABASE=photo-process

# Storage Paths
MEDIA_SOURCE_DIR=/var/photo-platform/source
MEDIA_PROCESSED_DIR=/var/photo-platform/processed
MEDIA_LOGS_DIR=/var/photo-platform/logs

# CompreFace
COMPREFACE_URL=http://compreface-ui:80
COMPREFACE_API_KEY=your-api-key

# Security
NODE_ENV=production
```

## Manual Deployment

### Prerequisites

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### Database Setup

```bash
# Start MySQL via Docker
docker run -d \
  --name photo-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=photo-process \
  -e MYSQL_USER=photo \
  -e MYSQL_PASSWORD=photopass \
  -p 3307:3306 \
  mysql:8.0

# Run migrations
npm run db:migrate
```

### CompreFace Setup

```bash
# Start CompreFace
docker run -d \
  --name compreface \
  -p 8001:80 \
  exadel/compreface:latest
```

### API Service

```bash
# Build the API
cd services/api
npm run build

# Start with PM2 (recommended)
npm install -g pm2
pm2 start npm --name "photo-api" -- start

# Or with systemd
sudo cp platform-tools/deployment/photo-platform.service /etc/systemd/system/
sudo systemctl enable photo-platform
sudo systemctl start photo-platform
```

## Reverse Proxy Setup

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:9000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /compreface/ {
        proxy_pass http://localhost:8001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring

### Health Checks

```bash
# API health
curl http://localhost:9000/api/health

# Database connection
curl http://localhost:9000/api/database/status

# CompreFace status
curl http://localhost:8001/api/v1/recognition/subjects
```

### Logs

```bash
# View API logs
docker compose logs -f api

# View all service logs
docker compose logs -f

# System logs (if using systemd)
journalctl -u photo-platform -f
```

## Backup Strategy

### Database Backup

```bash
# Create backup
docker exec photo-mysql mysqldump \
  -u root -prootpass photo-process > backup.sql

# Restore backup
docker exec -i photo-mysql mysql \
  -u root -prootpass photo-process < backup.sql
```

### File Backup

```bash
# Backup processed photos
tar -czf photos-backup.tar.gz /var/photo-platform/processed

# Backup configuration
tar -czf config-backup.tar.gz .env docker-compose.platform.yml
```

## Security Considerations

- Use strong passwords for MySQL and CompreFace
- Run services behind reverse proxy with SSL
- Limit file upload sizes
- Regular security updates
- Monitor logs for suspicious activity
- Backup data regularly