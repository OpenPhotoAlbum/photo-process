/**
 * Hash-Based File Structure Migration
 * 
 * This migration adds support for hash-based file organization while preserving
 * existing original_path references for safe transition and hybrid capability.
 * 
 * New Architecture:
 * - Files copied to organized processed/media/{year}/{month}/ structure
 * - Content-based SHA-256 hashing for unique filenames
 * - Relative paths stored in database (no machine path exposure)
 * - All related files (media, meta, faces, thumbnails) share same hash
 */

exports.up = function(knex) {
    return knex.schema.alterTable('images', function(table) {
        // New hash-based file organization fields
        table.string('relative_media_path', 500).nullable()
            .comment('Relative path to media file in processed/media/ directory');
        
        table.string('relative_meta_path', 500).nullable()
            .comment('Relative path to metadata JSON in processed/meta/ directory');
        
        table.string('source_filename', 255).nullable()
            .comment('Original filename without hash or path');
        
        // file_hash and file_size already exist, skip them
        
        table.timestamp('date_imported').nullable()
            .comment('When file was copied to processed directory');
        
        table.enum('migration_status', ['pending', 'copied', 'verified', 'failed']).defaultTo('pending')
            .comment('Status of migration to new file structure');
            
        // Indexes for performance (check if file_hash index already exists)
        table.index(['migration_status'], 'idx_images_migration_status');
        table.index(['relative_media_path'], 'idx_images_relative_media');
    })
    .then(() => {
        // Update detected_faces table for hash-based face file paths
        return knex.schema.alterTable('detected_faces', function(table) {
            table.string('relative_face_path', 500).nullable()
                .comment('Relative path to face image in processed/faces/ directory');
                
            table.index(['relative_face_path'], 'idx_faces_relative_path');
        });
    });
};

exports.down = function(knex) {
    return knex.schema.alterTable('detected_faces', function(table) {
        table.dropIndex([], 'idx_faces_relative_path');
        table.dropColumn('relative_face_path');
    })
    .then(() => {
        return knex.schema.alterTable('images', function(table) {
            table.dropIndex([], 'idx_images_migration_status');
            table.dropIndex([], 'idx_images_relative_media');
            
            table.dropColumn('relative_media_path');
            table.dropColumn('relative_meta_path');
            table.dropColumn('source_filename');
            // Don't drop file_hash and file_size as they existed before
            table.dropColumn('date_imported');
            table.dropColumn('migration_status');
        });
    });
};