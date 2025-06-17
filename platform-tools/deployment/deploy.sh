#!/bin/bash

# Photo Processing Service Deployment Script
# Handles application deployment, updates, and service management

set -e  # Exit on any error

# Configuration
PROJECT_NAME="photo-process"
PROJECT_DIR="/mnt/hdd/photo-process"
BACKUP_DIR="/tmp/photo-process-backup"
SERVICE_USER="stephen"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check if running as correct user
check_user() {
    if [ "$(whoami)" != "$SERVICE_USER" ]; then
        log_error "This script must be run as user '$SERVICE_USER'"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 16 ]; then
        log_error "Node.js version 16 or higher is required (found: $(node -v))"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check TypeScript
    if ! command -v tsc &> /dev/null; then
        log_warning "TypeScript not found globally, will use local version"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check ExifTool
    if ! command -v exiftool &> /dev/null; then
        log_error "ExifTool is not installed"
        exit 1
    fi
    
    log_success "All system requirements met"
}

# Stop running services
stop_services() {
    log_info "Stopping services..."
    
    # Stop Node.js server
    if pgrep -f "node.*build/index.js" > /dev/null; then
        log_info "Stopping Node.js server..."
        pkill -f "node.*build/index.js" || true
        sleep 2
    fi
    
    log_success "Services stopped"
}

# Start services
start_services() {
    log_info "Starting services..."
    
    # Start CompreFace if not running
    cd "$PROJECT_DIR/services/CompreFace"
    if ! docker-compose ps | grep -q "Up"; then
        log_info "Starting CompreFace..."
        docker-compose up -d
        log_info "Waiting for CompreFace to be ready..."
        sleep 30
    else
        log_info "CompreFace already running"
    fi
    
    # Start MySQL if not running
    cd "$PROJECT_DIR/services/database"
    if ! docker-compose ps | grep -q "Up"; then
        log_info "Starting MySQL database..."
        docker-compose up -d
        log_info "Waiting for database to be ready..."
        sleep 10
    else
        log_info "MySQL already running"
    fi
    
    # Start Node.js server
    cd "$PROJECT_DIR"
    log_info "Starting Node.js server..."
    nohup node build/index.js > server-debug.log 2>&1 &
    local server_pid=$!
    echo "Server PID: $server_pid"
    
    # Wait for server to start
    log_info "Waiting for server to respond..."
    local retries=0
    while [ $retries -lt 30 ]; do
        if curl -s http://localhost:9000/api/gallery > /dev/null 2>&1; then
            log_success "Server is responding"
            break
        fi
        sleep 1
        retries=$((retries + 1))
    done
    
    if [ $retries -eq 30 ]; then
        log_error "Server failed to start or is not responding"
        return 1
    fi
    
    log_success "All services started successfully"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Install npm dependencies
    npm ci
    
    log_success "Dependencies installed"
}

# Build application
build_application() {
    log_info "Building application..."
    
    cd "$PROJECT_DIR"
    
    # Clean previous build
    if [ -d "build" ]; then
        rm -rf build
    fi
    
    # Build TypeScript
    npx tsc
    
    if [ ! -d "build" ]; then
        log_error "Build failed - build directory not created"
        exit 1
    fi
    
    log_success "Application built successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd "$PROJECT_DIR"
    
    # Wait for database to be ready
    local retries=0
    while [ $retries -lt 30 ]; do
        if ./migrate.sh > /dev/null 2>&1; then
            log_success "Database migrations completed"
            return 0
        fi
        log_info "Waiting for database to be ready..."
        sleep 2
        retries=$((retries + 1))
    done
    
    log_error "Database migrations failed"
    return 1
}

# Health check
health_check() {
    log_info "Running health checks..."
    
    cd "$PROJECT_DIR"
    
    # Check if server is running and responding
    if ! curl -s http://localhost:9000/api/gallery > /dev/null; then
        log_error "API server health check failed"
        return 1
    fi
    
    # Check if CompreFace is responding
    if ! curl -s http://compreface-ui:80 > /dev/null; then
        log_error "CompreFace health check failed"
        return 1
    fi
    
    # Check database connection (via API)
    if ! curl -s http://localhost:9000/api/gallery | grep -q '\[' > /dev/null; then
        log_error "Database health check failed"
        return 1
    fi
    
    log_success "All health checks passed"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/$timestamp"
    
    mkdir -p "$backup_path"
    
    # Backup configuration
    cp "$PROJECT_DIR/.env" "$backup_path/" 2>/dev/null || true
    cp -r "$PROJECT_DIR/config" "$backup_path/" 2>/dev/null || true
    
    # Backup database (dump)
    if docker-compose -f "$PROJECT_DIR/services/database/docker-compose.yaml" exec -T mysql mysqldump -u photo -pDalekini21 photo-process > "$backup_path/database.sql" 2>/dev/null; then
        log_success "Database backup created"
    else
        log_warning "Database backup failed (service may not be running)"
    fi
    
    log_success "Backup created at $backup_path"
    echo "BACKUP_PATH=$backup_path"
}

# Restore from backup
restore_backup() {
    local backup_path="$1"
    
    if [ -z "$backup_path" ]; then
        log_error "Backup path required for restore operation"
        exit 1
    fi
    
    if [ ! -d "$backup_path" ]; then
        log_error "Backup directory not found: $backup_path"
        exit 1
    fi
    
    log_info "Restoring from backup: $backup_path"
    
    # Stop services
    stop_services
    
    # Restore configuration
    if [ -f "$backup_path/.env" ]; then
        cp "$backup_path/.env" "$PROJECT_DIR/"
        log_info "Configuration restored"
    fi
    
    if [ -d "$backup_path/config" ]; then
        cp -r "$backup_path/config" "$PROJECT_DIR/"
        log_info "Config directory restored"
    fi
    
    # Restore database
    if [ -f "$backup_path/database.sql" ]; then
        log_info "Restoring database..."
        start_services
        sleep 10
        docker-compose -f "$PROJECT_DIR/services/database/docker-compose.yaml" exec -T mysql mysql -u photo -pDalekini21 photo-process < "$backup_path/database.sql"
        log_success "Database restored"
    fi
    
    log_success "Backup restore completed"
}

# Display usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  install     - Install dependencies and build application"
    echo "  start       - Start all services"
    echo "  stop        - Stop all services"
    echo "  restart     - Restart all services"
    echo "  deploy      - Full deployment (stop, build, start)"
    echo "  update      - Update application (pull, build, restart)"
    echo "  backup      - Create system backup"
    echo "  restore     - Restore from backup (requires backup path)"
    echo "  health      - Run health checks"
    echo "  status      - Show service status"
    echo ""
    echo "Examples:"
    echo "  $0 deploy"
    echo "  $0 backup"
    echo "  $0 restore /tmp/photo-process-backup/20231201_143022"
}

# Show service status
show_status() {
    echo "=== Photo Processing Service Status ==="
    echo ""
    
    # Node.js server
    if pgrep -f "node.*build/index.js" > /dev/null; then
        echo "📟 Node.js Server: RUNNING (PID: $(pgrep -f 'node.*build/index.js'))"
    else
        echo "📟 Node.js Server: STOPPED"
    fi
    
    # CompreFace
    cd "$PROJECT_DIR/services/CompreFace"
    if docker-compose ps | grep -q "Up"; then
        echo "🤖 CompreFace: RUNNING"
    else
        echo "🤖 CompreFace: STOPPED"
    fi
    
    # MySQL
    cd "$PROJECT_DIR/services/database"
    if docker-compose ps | grep -q "Up"; then
        echo "🗄️  MySQL: RUNNING"
    else
        echo "🗄️  MySQL: STOPPED"
    fi
    
    echo ""
    
    # API health check
    if curl -s http://localhost:9000/api/gallery > /dev/null 2>&1; then
        echo "✅ API Health: OK"
    else
        echo "❌ API Health: FAILED"
    fi
    
    # CompreFace health check
    if curl -s http://localhost:8001 > /dev/null 2>&1; then
        echo "✅ CompreFace Health: OK"
    else
        echo "❌ CompreFace Health: FAILED"
    fi
}

# Main script logic
main() {
    local command="${1:-}"
    
    case "$command" in
        "install")
            check_user
            check_requirements
            install_dependencies
            build_application
            ;;
        "start")
            check_user
            start_services
            health_check
            ;;
        "stop")
            check_user
            stop_services
            ;;
        "restart")
            check_user
            stop_services
            sleep 2
            start_services
            health_check
            ;;
        "deploy")
            check_user
            check_requirements
            create_backup
            stop_services
            install_dependencies
            build_application
            start_services
            run_migrations
            health_check
            log_success "Deployment completed successfully!"
            ;;
        "update")
            check_user
            create_backup
            stop_services
            build_application
            start_services
            health_check
            log_success "Update completed successfully!"
            ;;
        "backup")
            check_user
            create_backup
            ;;
        "restore")
            check_user
            restore_backup "$2"
            ;;
        "health")
            health_check
            ;;
        "status")
            show_status
            ;;
        "")
            show_usage
            exit 1
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"