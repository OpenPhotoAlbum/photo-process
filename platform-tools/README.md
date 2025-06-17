# Platform Tools

This directory contains various utility tools for managing and maintaining the photo management platform.

## Structure

```
platform-tools/
├── maintenance/     # Data maintenance and migration tools
├── cleanup/         # Data cleanup utilities
├── testing/         # Testing utilities
├── database/        # Database management scripts
├── deployment/      # Production deployment tools
└── development/     # Development setup tools
```

## Maintenance Tools

Located in `maintenance/`, these tools help maintain and update existing data:

### retroactive-process.js
Add new processing features to existing images retroactively.

```bash
# Check status
node platform-tools/maintenance/retroactive-process.js --status

# Process object detection for 50 images
node platform-tools/maintenance/retroactive-process.js --feature=object_detection --limit=50

# Process all missing features
node platform-tools/maintenance/retroactive-process.js --feature=all --limit=25
```

### fix-dates.js
Fix date issues in processed images.

```bash
node platform-tools/maintenance/fix-dates.js
```

### update-objects.js
Update object detection data for existing images.

```bash
node platform-tools/maintenance/update-objects.js --limit=100
```

### import-faces.js
Import face data from external sources.

```bash
node platform-tools/maintenance/import-faces.js --source=/path/to/faces
```

### migrate-features.js
Check and migrate features to new format.

```bash
node platform-tools/maintenance/migrate-features.js --check
node platform-tools/maintenance/migrate-features.js --migrate
```

### check-missing.js
Check for missing files or data.

```bash
node platform-tools/maintenance/check-missing.js
```

## Cleanup Tools

Located in `cleanup/`, these tools help clean up data:

### cleanup-menu.js
Interactive cleanup menu for various cleanup operations.

```bash
node platform-tools/cleanup/cleanup-menu.js
```

### cleanup-compreface.js
Clean up CompreFace data and unknown faces.

```bash
node platform-tools/cleanup/cleanup-compreface.js
```

### cleanup-low-confidence.js
Remove low confidence face detections.

```bash
node platform-tools/cleanup/cleanup-low-confidence.js --threshold=0.5
```

### cleanup-local-data.js
Clean up local processing data and caches.

```bash
node platform-tools/cleanup/cleanup-local-data.js
```

### cleanup-fresh-start.js
Complete system reset (WARNING: Deletes all data!)

```bash
node platform-tools/cleanup/cleanup-fresh-start.js --confirm
```

## Testing Tools

Located in `testing/`, these tools help test the system:

### test-full-processing.js
Test complete processing pipeline on sample images.

```bash
node platform-tools/testing/test-full-processing.js
```

### test-object-detection.js
Test object detection functionality.

```bash
node platform-tools/testing/test-object-detection.js --image=/path/to/test.jpg
```

### test-single-file.js
Test processing of a single file.

```bash
node platform-tools/testing/test-single-file.js --file=/path/to/image.jpg
```

## Database Tools

Located in `database/`, these are shell scripts for database management:

### migrate.sh
Run database migrations.

```bash
./tools/database/migrate.sh
```

### seed.sh
Seed database with test data.

```bash
./tools/database/seed.sh
```

### create-migration.sh
Create a new migration file.

```bash
./tools/database/create-migration.sh add_new_feature
```

## Important Notes

1. **Always compile TypeScript first**: Most tools require the API service to be built. They will attempt to compile automatically.

2. **Database connection**: Tools use the platform database configuration from `infrastructure/database/`.

3. **File paths**: All paths are relative to the platform root (`future/`).

4. **Environment**: Tools respect environment variables for configuration.

5. **Safety**: Many tools have `--dry-run` options to preview changes before applying them.

## Development Guidelines

When creating new tools:

1. Place in appropriate subdirectory (maintenance, cleanup, testing, etc.)
2. Include proper help text with `--help` option
3. Add safety checks for destructive operations
4. Update this README with usage instructions
5. Use platform configuration system (configManager)
6. Include progress indicators for long operations
7. Log important operations for debugging

## Common Issues

### "TypeScript compilation failed"
Solution: Ensure API service dependencies are installed:
```bash
cd services/api && npm install
```

### "Cannot find module"
Solution: Rebuild the API service:
```bash
cd services/api && npm run build
```

### "Database connection failed"
Solution: Ensure database service is running:
```bash
docker-compose up -d database
```