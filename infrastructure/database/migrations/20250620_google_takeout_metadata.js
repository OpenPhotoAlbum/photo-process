/**
 * Google Takeout Metadata Support
 * 
 * This migration adds comprehensive support for importing Google Takeout metadata:
 * 1. Album system with folder-based organization
 * 2. Enhanced image metadata from Google JSON files
 * 3. People tagging system
 * 4. Location enrichments
 * 5. View counts and engagement metrics
 */

exports.up = function(knex) {
  return knex.schema
    // Albums table - represents Google Takeout album folders
    .createTable('albums', function(table) {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('slug', 255).notNullable().unique();
      table.text('description');
      table.string('source', 50).defaultTo('manual'); // 'google_takeout', 'manual', 'smart'
      table.string('source_folder_path', 500); // Original source folder path
      table.string('access_level', 50); // 'protected', 'public', etc.
      table.timestamp('album_date'); // When album was created in Google Photos
      table.string('cover_image_hash', 64); // Hash of cover image
      table.integer('image_count').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index('source');
      table.index('is_active');
      table.index('album_date');
    })
    
    // Album-Image relationships
    .createTable('album_images', function(table) {
      table.increments('id').primary();
      table.integer('album_id').unsigned().notNullable();
      table.integer('image_id').unsigned().notNullable();
      table.integer('sort_order').defaultTo(0);
      table.timestamp('added_at').defaultTo(knex.fn.now());
      
      table.foreign('album_id').references('albums.id').onDelete('CASCADE');
      table.foreign('image_id').references('images.id').onDelete('CASCADE');
      table.unique(['album_id', 'image_id']);
      table.index('sort_order');
    })
    
    // Google-specific metadata for images
    .createTable('google_metadata', function(table) {
      table.increments('id').primary();
      table.integer('image_id').unsigned().notNullable();
      table.string('google_title', 255);
      table.text('google_description');
      table.bigInteger('google_view_count').defaultTo(0);
      table.string('google_url', 500); // Original Google Photos URL
      table.string('device_type', 100); // IOS_PHONE, ANDROID_PHONE, etc.
      table.timestamp('google_creation_time');
      table.timestamp('google_photo_taken_time');
      table.timestamp('google_last_modified_time');
      table.json('google_raw_metadata'); // Store complete JSON for reference
      table.timestamp('imported_at').defaultTo(knex.fn.now());
      
      table.foreign('image_id').references('images.id').onDelete('CASCADE');
      table.unique('image_id');
      table.index('google_view_count');
      table.index('device_type');
      table.index('google_photo_taken_time');
    })
    
    // People tagging system (from Google's people recognition)
    .createTable('google_people_tags', function(table) {
      table.increments('id').primary();
      table.integer('image_id').unsigned().notNullable();
      table.string('person_name', 255).notNullable();
      table.string('source', 50).defaultTo('google_photos'); // 'google_photos', 'manual'
      table.integer('person_id').unsigned(); // Link to our persons table when matched
      table.boolean('is_verified').defaultTo(false); // Manual verification status
      table.timestamp('tagged_at').defaultTo(knex.fn.now());
      
      table.foreign('image_id').references('images.id').onDelete('CASCADE');
      table.foreign('person_id').references('persons.id').onDelete('SET NULL');
      table.index('person_name');
      table.index(['person_name', 'is_verified']);
      table.index('source');
    })
    
    // Location enrichments from Google (place names, POIs)
    .createTable('google_location_enrichments', function(table) {
      table.increments('id').primary();
      table.integer('album_id').unsigned(); // Can be album-level or image-level
      table.integer('image_id').unsigned();
      table.string('place_name', 255).notNullable();
      table.string('place_description', 255);
      table.decimal('latitude', 10, 8);
      table.decimal('longitude', 11, 8);
      table.string('place_type', 100); // POI, city, landmark, etc.
      table.timestamp('enriched_at').defaultTo(knex.fn.now());
      
      table.foreign('album_id').references('albums.id').onDelete('CASCADE');
      table.foreign('image_id').references('images.id').onDelete('CASCADE');
      table.index('place_name');
      table.index(['latitude', 'longitude']);
      table.index('place_type');
    })
    
    // Add Google metadata fields to existing images table
    .table('images', function(table) {
      table.boolean('is_favorited').defaultTo(false);
      table.timestamp('favorited_at');
      table.string('google_photos_id', 255); // Google's internal ID
      table.bigInteger('google_view_count').defaultTo(0);
      table.timestamp('google_imported_at');
      
      table.index('is_favorited');
      table.index('google_view_count');
      table.index('google_imported_at');
    })
    
    // Add enhanced person fields for Google integration
    .table('persons', function(table) {
      table.string('google_person_name', 255); // Original name from Google
      table.integer('google_tag_count').defaultTo(0); // How many Google tags for this person
      table.boolean('is_from_google').defaultTo(false); // Created from Google tags
      table.timestamp('google_first_seen');
      
      table.index('google_person_name');
      table.index('is_from_google');
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('persons', function(table) {
      table.dropColumn('google_person_name');
      table.dropColumn('google_tag_count');
      table.dropColumn('is_from_google');
      table.dropColumn('google_first_seen');
    })
    .table('images', function(table) {
      table.dropColumn('is_favorited');
      table.dropColumn('favorited_at');
      table.dropColumn('google_photos_id');
      table.dropColumn('google_view_count');
      table.dropColumn('google_imported_at');
    })
    .dropTableIfExists('google_location_enrichments')
    .dropTableIfExists('google_people_tags')
    .dropTableIfExists('google_metadata')
    .dropTableIfExists('album_images')
    .dropTableIfExists('albums');
};