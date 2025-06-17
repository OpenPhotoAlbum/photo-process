#!/bin/bash

# Database management script for photo management platform
# Usage: ./manage.sh [command]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." &> /dev/null && pwd)"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Default values
MYSQL_HOST=${MYSQL_HOST:-localhost}
MYSQL_PORT=${MYSQL_PORT:-3307}
MYSQL_USER=${MYSQL_USER:-photo_user}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-photo_password}
MYSQL_DATABASE=${MYSQL_DATABASE:-photo_process}

case "$1" in
    "start")
        echo "Starting database..."
        cd "$PROJECT_ROOT"
        docker compose -f docker-compose.platform.yml up -d database
        ;;
    "stop")
        echo "Stopping database..."
        cd "$PROJECT_ROOT"
        docker compose -f docker-compose.platform.yml stop database
        ;;
    "migrate")
        echo "Running migrations..."
        cd "$PROJECT_ROOT"
        # Ensure dependencies are installed
        if [ ! -d "node_modules" ]; then
            echo "Installing dependencies..."
            npm install
        fi
        KNEX_CONFIG="$SCRIPT_DIR/knexfile.platform.js" npx knex migrate:latest --knexfile "$SCRIPT_DIR/knexfile.platform.js"
        ;;
    "rollback")
        echo "Rolling back last migration..."
        cd "$PROJECT_ROOT"
        KNEX_CONFIG="$SCRIPT_DIR/knexfile.platform.js" npx knex migrate:rollback --knexfile "$SCRIPT_DIR/knexfile.platform.js"
        ;;
    "seed")
        echo "Running seeds..."
        cd "$PROJECT_ROOT"
        KNEX_CONFIG="$SCRIPT_DIR/knexfile.platform.js" npx knex seed:run --knexfile "$SCRIPT_DIR/knexfile.platform.js"
        ;;
    "reset")
        echo "Resetting database (DANGER: This will delete all data)..."
        read -p "Are you sure? Type 'yes' to continue: " confirm
        if [ "$confirm" = "yes" ]; then
            cd "$PROJECT_ROOT"
            KNEX_CONFIG="$SCRIPT_DIR/knexfile.platform.js" npx knex migrate:rollback --all --knexfile "$SCRIPT_DIR/knexfile.platform.js"
            KNEX_CONFIG="$SCRIPT_DIR/knexfile.platform.js" npx knex migrate:latest --knexfile "$SCRIPT_DIR/knexfile.platform.js"
        else
            echo "Cancelled."
        fi
        ;;
    "status")
        echo "Database status:"
        docker ps --filter "name=photo-platform-database" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;
    "logs")
        echo "Database logs:"
        docker logs photo-platform-database --tail 50 -f
        ;;
    "shell")
        echo "Connecting to database..."
        docker exec -it photo-platform-database mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"
        ;;
    *)
        echo "Database management script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start     Start the database container"
        echo "  stop      Stop the database container"
        echo "  migrate   Run database migrations"
        echo "  rollback  Rollback last migration"
        echo "  seed      Run database seeds"
        echo "  reset     Reset database (WARNING: deletes all data)"
        echo "  status    Show database container status"
        echo "  logs      Show database logs"
        echo "  shell     Connect to database shell"
        echo ""
        ;;
esac