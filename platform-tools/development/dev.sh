#!/bin/bash

# Photo Management Platform Development Script
# Quick commands for platform development workflow
# Usage: Run from platform root directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[DEV]${NC} $1"
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

# Quick build and restart for development
quick_restart() {
    log_info "Quick restart for development..."
    
    # Kill existing server
    pkill -f "node.*build/index.js" 2>/dev/null || true
    
    # Build
    log_info "Building TypeScript..."
    tsc
    
    # Start server
    log_info "Starting server..."
    nohup node build/index.js > server-debug.log 2>&1 &
    local server_pid=$!
    echo "Server PID: $server_pid"
    
    # Quick health check
    sleep 3
    if curl -s http://localhost:9000/api/gallery > /dev/null 2>&1; then
        log_success "Server restarted successfully"
    else
        log_warning "Server may still be starting..."
    fi
}

# Watch mode for development
watch_mode() {
    log_info "Starting development watch mode..."
    log_info "Press Ctrl+C to stop"
    
    # Initial build and start
    quick_restart
    
    # Watch for TypeScript file changes
    if command -v inotifywait &> /dev/null; then
        log_info "Watching for file changes in src/..."
        while true; do
            inotifywait -r -e modify,create,delete src/ && {
                log_info "Files changed, restarting..."
                quick_restart
            }
        done
    else
        log_warning "inotifywait not available. Install inotify-tools for file watching."
        log_info "Server started. Manually restart with: $0 restart"
    fi
}

# Start only the dependencies (CompreFace + MySQL)
start_deps() {
    log_info "Starting development dependencies..."
    
    # Start CompreFace
    cd services/CompreFace
    if ! docker-compose ps | grep -q "Up"; then
        log_info "Starting CompreFace..."
        docker-compose up -d
    else
        log_info "CompreFace already running"
    fi
    
    # Start MySQL
    cd ../database
    if ! docker-compose ps | grep -q "Up"; then
        log_info "Starting MySQL..."
        docker-compose up -d
    else
        log_info "MySQL already running"
    fi
    
    cd ../..
    log_success "Dependencies started"
}

# Stop only the dependencies
stop_deps() {
    log_info "Stopping development dependencies..."
    
    cd services/CompreFace
    docker-compose down
    
    cd ../database
    docker-compose down
    
    cd ../..
    log_success "Dependencies stopped"
}

# Show development logs
show_logs() {
    local service="${1:-server}"
    
    case "$service" in
        "server")
            log_info "Showing server logs (last 50 lines)..."
            tail -f server-debug.log
            ;;
        "compreface")
            log_info "Showing CompreFace logs..."
            cd services/CompreFace
            docker-compose logs -f
            ;;
        "mysql"|"database")
            log_info "Showing MySQL logs..."
            cd services/database
            docker-compose logs -f
            ;;
        *)
            log_error "Unknown service: $service"
            echo "Available services: server, compreface, mysql"
            exit 1
            ;;
    esac
}

# Run a quick test scan
test_scan() {
    local limit="${1:-2}"
    
    log_info "Running test scan with limit $limit..."
    
    local response=$(curl -s "http://localhost:9000/scan?async=true&limit=$limit")
    local job_id=$(echo "$response" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$job_id" ]; then
        log_success "Scan job started: $job_id"
        
        # Monitor job progress
        log_info "Monitoring job progress..."
        while true; do
            local status=$(curl -s "http://localhost:9000/api/jobs/$job_id" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            
            case "$status" in
                "completed")
                    log_success "Scan completed!"
                    break
                    ;;
                "failed")
                    log_error "Scan failed!"
                    break
                    ;;
                "running")
                    log_info "Scan in progress..."
                    ;;
                *)
                    log_info "Scan status: $status"
                    ;;
            esac
            
            sleep 2
        done
        
        # Show results
        curl -s "http://localhost:9000/api/jobs/$job_id" | grep -o '"result":{[^}]*}' || true
        
    else
        log_error "Failed to start scan job"
        echo "Response: $response"
    fi
}

# Reset development environment
reset_dev() {
    log_warning "This will reset your development environment!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Reset cancelled"
        return
    fi
    
    log_info "Resetting development environment..."
    
    # Stop everything
    pkill -f "node.*build/index.js" 2>/dev/null || true
    stop_deps
    
    # Clean build
    rm -rf build/
    rm -f server-debug.log
    
    # Rebuild
    npm ci
    tsc
    
    # Restart dependencies
    start_deps
    
    log_info "Waiting for dependencies to be ready..."
    sleep 15
    
    # Run migrations
    ./migrate.sh
    
    log_success "Development environment reset complete"
}

# Show quick development status
dev_status() {
    echo "=== Development Status ==="
    echo ""
    
    # TypeScript build status
    if [ -d "build" ] && [ -f "build/index.js" ]; then
        local build_time=$(stat -c %Y build/index.js 2>/dev/null || echo "0")
        local src_time=$(find src -name "*.ts" -exec stat -c %Y {} \; 2>/dev/null | sort -n | tail -1)
        
        if [ "$build_time" -ge "$src_time" ]; then
            echo "🔨 Build: UP TO DATE"
        else
            echo "🔨 Build: NEEDS REBUILD"
        fi
    else
        echo "🔨 Build: NOT BUILT"
    fi
    
    # Server status
    if pgrep -f "node.*build/index.js" > /dev/null; then
        echo "📟 Server: RUNNING"
        if curl -s http://localhost:9000/api/gallery > /dev/null 2>&1; then
            echo "✅ API: RESPONDING"
        else
            echo "❌ API: NOT RESPONDING"
        fi
    else
        echo "📟 Server: STOPPED"
    fi
    
    # Dependencies
    cd services/CompreFace
    if docker-compose ps | grep -q "Up"; then
        echo "🤖 CompreFace: RUNNING"
    else
        echo "🤖 CompreFace: STOPPED"
    fi
    
    cd ../database
    if docker-compose ps | grep -q "Up"; then
        echo "🗄️  MySQL: RUNNING"
    else
        echo "🗄️  MySQL: STOPPED"
    fi
    
    cd ../..
    echo ""
}

# Show usage
show_usage() {
    echo "Development script for Photo Processing Service"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  restart     - Quick build and restart server"
    echo "  watch       - Watch for file changes and auto-restart"
    echo "  deps        - Start only dependencies (CompreFace + MySQL)"
    echo "  stop-deps   - Stop dependencies"
    echo "  logs [svc]  - Show logs (server|compreface|mysql)"
    echo "  test [n]    - Run test scan with n files (default: 2)"
    echo "  reset       - Reset development environment"
    echo "  status      - Show development status"
    echo ""
    echo "Examples:"
    echo "  $0 restart              # Quick restart after code changes"
    echo "  $0 watch                # Auto-restart on file changes"
    echo "  $0 logs server          # Show server logs"
    echo "  $0 test 5               # Test scan with 5 files"
}

# Main script logic
main() {
    local command="${1:-}"
    
    case "$command" in
        "restart"|"r")
            quick_restart
            ;;
        "watch"|"w")
            watch_mode
            ;;
        "deps"|"dependencies")
            start_deps
            ;;
        "stop-deps")
            stop_deps
            ;;
        "logs"|"log")
            show_logs "$2"
            ;;
        "test")
            test_scan "$2"
            ;;
        "reset")
            reset_dev
            ;;
        "status"|"s")
            dev_status
            ;;
        "")
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"