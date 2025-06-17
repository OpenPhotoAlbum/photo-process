#!/bin/bash

# Development startup script for Photo Platform
# Uses Docker Compose to start all platform services

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

# Check if services are already running
if docker compose -f docker-compose.platform.yml ps --services --filter "status=running" | grep -q .; then
    log_warning "Some services are already running. Stopping them first..."
    docker compose -f docker-compose.platform.yml down
    sleep 2
fi

# Start all platform services
log_info "Starting all platform services (database, CompreFace, API)..."
if docker compose -f docker-compose.platform.yml up -d; then
    log_success "All services started successfully"
else
    log_error "Failed to start platform services"
    exit 1
fi

# Wait for services to be ready
log_info "Waiting for services to be ready..."
sleep 10

# Test if API server is responding
log_info "Testing API server connectivity..."
if curl -s http://localhost:9000/api/persons > /dev/null 2>&1; then
    log_success "API server is responding on http://localhost:9000"
else
    log_error "API server is not responding. Checking logs..."
    docker compose -f docker-compose.platform.yml logs api | tail -20
    exit 1
fi

# Test if CompreFace is responding
log_info "Testing CompreFace connectivity..."
if curl -s http://localhost:8001 > /dev/null 2>&1; then
    log_success "CompreFace UI is responding on http://localhost:8001"
else
    log_warning "CompreFace UI may still be starting up"
fi

echo ""
log_success "Development environment is ready!"
echo ""
echo "🌐 API: http://localhost:9000/api/persons"
echo "🤖 CompreFace: http://localhost:8001"
echo "🗄️  Database: localhost:3307"
echo "📊 Gallery: http://localhost:9000/api/gallery"
echo "📋 Scan Status: http://localhost:9000/scan/status"
echo ""
echo "To view logs:"
echo "  docker compose -f docker-compose.platform.yml logs -f api"
echo "  docker compose -f docker-compose.platform.yml logs -f database"
echo ""
echo "To stop all services:"
echo "  docker compose -f docker-compose.platform.yml down"