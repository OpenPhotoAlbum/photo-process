# Database Infrastructure

MySQL database for the photo management platform.

## Configuration

- **Image**: MySQL 8.0
- **Port**: 3307 (external) / 3306 (internal) - Uses 3307 to avoid conflicts with existing database
- **Database**: photo_process
- **User**: photo_user
- **Container**: future-photo-database

## Usage

### Via Management Script
```bash
# Start database
./manage.sh start

# Run migrations
./manage.sh migrate

# Check status
./manage.sh status

# Connect to shell
./manage.sh shell

# View logs
./manage.sh logs
```

### Via Platform Docker Compose
```bash
# Start just the database
docker-compose up -d database

# Start entire platform
docker-compose up -d
```

### Manual Connection
```bash
# From host machine
mysql -h localhost -P 3307 -u photo_user -pphoto_password photo_process

# From container
docker exec -it future-photo-database mysql -u photo_user -pphoto_password photo_process
```

## Migrations

All database migrations are in the `migrations/` directory. They define the complete schema for:

- **Images**: Core photo metadata
- **Faces**: Face detection and recognition data  
- **Objects**: Object detection results
- **Persons**: Person identification and clustering
- **Smart Albums**: Auto-generated photo collections

### Running Migrations
```bash
# Latest migrations
./manage.sh migrate

# Rollback last migration
./manage.sh rollback

# Reset database (WARNING: deletes all data)
./manage.sh reset
```

## Data Migration Notes

**IMPORTANT**: This is a fresh database instance separate from your existing photo database. Your original data is preserved in the current system and will be migrated later when the platform is ready.

## Environment Variables

Configured via `.env` file or environment:

- `MYSQL_HOST` - Database host (default: localhost)
- `MYSQL_PORT` - External port (default: 3307)  
- `MYSQL_USER` - Database user (default: photo_user)
- `MYSQL_PASSWORD` - Database password (default: photo_password)
- `MYSQL_DATABASE` - Database name (default: photo_process)
- `MYSQL_ROOT_PASSWORD` - Root password (default: root_password)

## Performance Tuning

The database is configured with:
- InnoDB buffer pool: 512MB
- Max connections: 1001
- UTF8MB4 character set for full Unicode support
- Optimized for photo metadata workloads