#!/bin/bash

# Photo Platform Startup Script
# Starts all services with auto-restart enabled

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." &> /dev/null && pwd)"

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
    log_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Function to enable Docker service autostart
enable_docker_autostart() {
    log_info "Checking Docker service auto-start configuration..."
    
    # For systemd-based systems (most modern Linux)
    if command -v systemctl &> /dev/null; then
        if systemctl is-enabled docker &> /dev/null; then
            log_success "Docker service is already enabled for auto-start"
        else
            log_warning "Docker service is not enabled for auto-start"
            echo "To enable Docker auto-start on boot, run:"
            echo "  sudo systemctl enable docker"
        fi
    fi
    
    # For macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        log_info "On macOS, ensure Docker Desktop is set to 'Start Docker Desktop when you log in'"
        log_info "This can be configured in Docker Desktop → Settings → General"
    fi
}

# Start services
start_services() {
    cd "$PROJECT_ROOT"
    
    log_info "Starting Photo Platform services..."
    
    # Start platform database first
    log_info "Starting platform database..."
    docker compose -f docker-compose.platform.yml up -d database
    log_success "Platform database started"
    
    # Start main platform services
    if [ -f "docker-compose.platform.yml" ]; then
        log_info "Starting platform services..."
        docker compose -f docker-compose.platform.yml up -d
        log_success "Platform services started"
    fi
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 10
    
    # Check service status
    check_service_status
}

# Check service status
check_service_status() {
    log_info "Checking service status..."
    echo ""
    
    # Check database
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "database.*Up"; then
        log_success "Database is running"
    else
        log_error "Database is not running"
    fi
    
    # Check API
    if curl -s http://localhost:9000/ > /dev/null 2>&1; then
        log_success "API service is responding"
    else
        log_warning "API service is not responding yet"
    fi
    
    # Check CompreFace
    if docker ps --format "table {{.Names}}" | grep -q "compreface"; then
        log_success "CompreFace services are running"
    else
        log_warning "CompreFace services are not running"
    fi
    
    echo ""
    log_info "All containers with restart policies:"
    docker ps --format "table {{.Names}}\t{{.RestartCount}}\t{{.Status}}" | grep -E "(unless-stopped|always)"
}

# Main execution
main() {
    echo "=== Photo Platform Startup Script ==="
    echo ""
    
    # Check Docker autostart
    enable_docker_autostart
    echo ""
    
    # Start services
    start_services
    echo ""
    
    log_success "Photo Platform startup complete!"
    echo ""
    echo "Services are configured with auto-restart policies:"
    echo "  - 'unless-stopped': Containers will restart automatically after reboot"
    echo "  - They will NOT restart if you manually stop them"
    echo ""
    echo "To stop all services: docker compose -f docker-compose.platform.yml down"
    echo "To view logs: docker compose -f docker-compose.platform.yml logs -f"
    echo ""
    echo "Access points:"
    echo "  - API: http://localhost:9000"
    echo "  - CompreFace UI: http://compreface-ui:80"
    echo "  - MySQL: localhost:3307"
}

main "$@"