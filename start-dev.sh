#!/bin/bash

# Development startup script for Photo Platform
# Starts the platform database and API server

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker first:"
    echo "  sudo systemctl start docker"
    exit 1
fi

log_info "Starting Photo Platform development environment..."

# Start platform database
log_info "Starting MySQL database..."
if docker compose -f docker-compose.platform.yml up -d database; then
    log_success "Database started on port 3307"
else
    log_error "Failed to start database"
    exit 1
fi

# Wait for database to be ready
log_info "Waiting for database to be ready..."
sleep 5

# Check if API is already running
if pgrep -f "node.*build/index.js" > /dev/null; then
    log_warning "API server is already running"
    log_info "Restarting API server..."
    pkill -f "node.*build/index.js" 2>/dev/null || true
    sleep 2
fi

# Start API server
log_info "Starting API server..."
cd services/api

# Build if needed
if [ ! -f "build/index.js" ] || [ "src/index.ts" -nt "build/index.js" ]; then
    log_info "Building TypeScript..."
    tsc
fi

# Start server
nohup node build/index.js > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
sleep 3

# Test if server is responding
if curl -s http://localhost:9000/ > /dev/null 2>&1; then
    log_success "API server is running on http://localhost:9000"
else
    log_error "API server failed to start. Check server.log for details"
    tail -10 server.log
    exit 1
fi

echo ""
log_success "Development environment is ready!"
echo ""
echo "🌐 API: http://localhost:9000"
echo "🗄️  Database: localhost:3307"
echo "📋 API Status: curl http://localhost:9000/"
echo "📊 Gallery: curl http://localhost:9000/api/gallery"
echo ""
echo "To stop:"
echo "  pkill -f 'node.*build/index.js'  # Stop API"
echo "  docker compose -f docker-compose.platform.yml down  # Stop database"