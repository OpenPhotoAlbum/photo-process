# Database Migration Setup

Complete Knex migration tooling for the photo management platform.

## What's Included

### 📁 Directory Structure
```
infrastructure/database/
├── migrations/          # 15 migration files (complete schema)
├── seeds/              # Database seed files  
├── init-scripts/       # Docker initialization scripts
├── knexfile.platform.js # Platform Knex configuration
├── manage.sh           # Database management script
└── README.md           # Documentation
```

### 🗄️ Migration Files (Complete Schema)
All 15 migrations from the original project:
- `20250522032033_media.js` - Core media table
- `20250611_reset_and_create_schema.js` - Schema reset
- `20250612025534_face_recognition.js` - Face detection tables
- `20250612184220_add_screenshot_detection.js` - Screenshot detection
- `20250612_add_object_detection.js` - Object detection tables
- `20250612_fix_date_taken_column.js` - Date column fixes
- `20250613011800_add_performance_indexes.js` - Performance indexes
- `20250613012200_add_missing_indexes.js` - Additional indexes
- `20250613200049_face_clustering_system.js` - Face clustering tables
- `20250613232628_add_person_name_to_training_history.js` - Training history
- `20250613_face_recognition_enhancements.js` - Recognition improvements
- `20250614010014_fix_comparison_method_column_length.js` - Column fixes
- `20250614050115_hash_based_file_structure.js` - Hash-based file structure
- `20250614141924_astrophotography_detection.js` - Astrophotography detection
- `20250614224103_smart-albums-system.js` - Smart albums system

### ⚙️ Available Commands

#### Via npm (Recommended)
```bash
# Database lifecycle
npm run db:start         # Start database container
npm run db:stop          # Stop database container  
npm run db:status        # Check container status

# Schema management
npm run db:migrate       # Run latest migrations
npm run db:rollback      # Rollback last migration
npm run db:seed          # Run seed files
npm run db:reset         # Reset database (WARNING: deletes all data)

# Development tools
npm run db:create-migration <name>  # Create new migration
npm run db:create-seed <name>       # Create new seed file
npm run db:shell         # Connect to database shell
npm run db:logs          # View database logs
```

#### Via Management Script
```bash
# Direct script access
./infrastructure/database/manage.sh <command>
```

#### Via Tools Directory
```bash
# Legacy tool compatibility
./tools/database/migrate.sh
./tools/database/seed.sh
./tools/database/create-migration.sh <name>
./tools/database/create-seed.sh <name>
```

### 🔧 Configuration

#### Database Connection
- **Host**: localhost (internal: database)
- **Port**: 3308 (external) / 3306 (internal)
- **Database**: photo_process
- **User**: photo_user
- **Password**: photo_password

#### Environment Variables
Set in `.env` file:
```bash
MYSQL_HOST=localhost
MYSQL_PORT=3308
MYSQL_USER=photo_user
MYSQL_PASSWORD=photo_password
MYSQL_DATABASE=photo_process
```

### 🚀 Quick Start

1. **Start the database**:
   ```bash
   npm run db:start
   ```

2. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

3. **Seed with sample data** (optional):
   ```bash
   npm run db:seed
   ```

4. **Check status**:
   ```bash
   npm run db:status
   ```

### 🔄 Migration Workflow

#### Creating New Migrations
```bash
# Create new migration
npm run db:create-migration add_new_feature

# Edit the migration file
# migrations/20250615_add_new_feature.js

# Apply migration
npm run db:migrate

# If needed, rollback
npm run db:rollback
```

#### Working with Seeds
```bash
# Create new seed
npm run db:create-seed sample_data

# Edit the seed file
# seeds/sample_data.js

# Run seeds
npm run db:seed
```

### ⚠️ Important Notes

1. **Separate Database**: This uses port 3308 and is completely separate from your existing production database

2. **Data Preservation**: Your original photo database is safe and untouched

3. **Environment**: Uses `development` environment by default in knexfile.platform.js

4. **Container Name**: Database runs as `future-photo-database` to avoid conflicts

5. **Auto-Install**: Management script will automatically install npm dependencies if needed

### 🐛 Troubleshooting

#### Connection Issues
```bash
# Check if database is running
npm run db:status

# View database logs
npm run db:logs

# Restart database
npm run db:stop && npm run db:start
```

#### Migration Issues
```bash
# Check migration status
npx knex migrate:status --knexfile infrastructure/database/knexfile.platform.js

# Reset if needed (WARNING: deletes data)
npm run db:reset
```

#### Permission Issues
```bash
# Make scripts executable
chmod +x infrastructure/database/manage.sh
chmod +x tools/database/*.sh
```