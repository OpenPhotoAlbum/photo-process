#!/bin/bash

# Environment Setup Script
# Sets up a new environment for the Photo Processing Service

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env exists
setup_env_file() {
    if [ ! -f ".env" ]; then
        log_info "Creating .env file from example..."
        
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_info "Please edit .env file with your specific configuration"
        else
            log_error ".env.example not found. Creating minimal .env..."
            cat > .env << EOF
# Database Configuration
mysql_host=0.0.0.0
mysql_root_password=your_password_here
mysql_db=photo-process
mysql_user=photo
mysql_pass=your_password_here
mysql_port=3307

# Storage Configuration
media_source_dir=/path/to/your/source
media_dest_dir=/path/to/your/processed

# Optional Configuration
PORT=9000
EOF
            log_info "Please edit .env file with your specific configuration"
        fi
    else
        log_info ".env file already exists"
    fi
}

# Create necessary directories
setup_directories() {
    log_info "Setting up directories..."
    
    # Create config directory if it doesn't exist
    mkdir -p config
    
    # Create logs directory if it doesn't exist
    mkdir -p logs
    
    log_success "Directories created"
}

# Install system dependencies
install_system_deps() {
    log_info "Checking system dependencies..."
    
    # Check for ExifTool
    if ! command -v exiftool &> /dev/null; then
        log_info "Installing ExifTool..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y libimage-exiftool-perl
        elif command -v yum &> /dev/null; then
            sudo yum install -y perl-Image-ExifTool
        elif command -v brew &> /dev/null; then
            brew install exiftool
        else
            log_error "Please install ExifTool manually"
            exit 1
        fi
    else
        log_info "ExifTool already installed"
    fi
    
    # Check for Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is required but not installed"
        log_info "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check for Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is required but not installed"
        log_info "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    log_success "System dependencies verified"
}

main() {
    log_info "Setting up Photo Processing Service environment..."
    
    setup_env_file
    setup_directories
    install_system_deps
    
    log_success "Environment setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env file with your configuration"
    echo "2. Run: ./deploy.sh install"
    echo "3. Run: ./deploy.sh deploy"
}

main "$@"