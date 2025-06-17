/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Create smart albums table
  await knex.schema.createTable('smart_albums', table => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.string('slug', 255).notNullable().unique(); // URL-friendly identifier
    table.text('description');
    table.enum('type', [
      'object_based',      // Based on detected objects
      'person_based',      // Based on specific people
      'time_based',        // Based on time patterns
      'location_based',    // Based on GPS location
      'technical_based',   // Based on camera/EXIF data
      'characteristic',    // Based on photo characteristics
      'custom_rule'        // Custom rule-based albums
    ]).notNullable();
    table.json('rules').notNullable(); // JSON rules for album membership
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_system').defaultTo(false); // System-generated vs user-created
    table.integer('priority').defaultTo(100); // For ordering albums
    table.string('cover_image_hash', 64); // Hash of album cover image
    table.integer('image_count').defaultTo(0); // Cached count for performance
    table.timestamp('last_updated').defaultTo(knex.fn.now());
    table.timestamps(true, true);
    
    // Indexes
    table.index('slug');
    table.index('type');
    table.index('is_active');
    table.index('priority');
  });

  // Create album membership table (many-to-many relationship)
  await knex.schema.createTable('smart_album_images', table => {
    table.increments('id').primary();
    table.integer('album_id').unsigned().notNullable()
      .references('id').inTable('smart_albums').onDelete('CASCADE');
    table.integer('image_id').unsigned().notNullable()
      .references('id').inTable('images').onDelete('CASCADE');
    table.float('confidence').defaultTo(1.0); // Confidence of membership
    table.json('match_reasons'); // Why this image matches (for debugging)
    table.timestamp('added_at').defaultTo(knex.fn.now());
    
    // Unique constraint to prevent duplicates
    table.unique(['album_id', 'image_id']);
    
    // Indexes
    table.index('album_id');
    table.index('image_id');
    table.index('added_at');
  });

  // Create album rules table for complex rule definitions
  await knex.schema.createTable('smart_album_rules', table => {
    table.increments('id').primary();
    table.integer('album_id').unsigned().notNullable()
      .references('id').inTable('smart_albums').onDelete('CASCADE');
    table.enum('rule_type', [
      'object_detection',   // Requires specific objects
      'face_detection',     // Requires specific people
      'date_range',         // Within date range
      'time_of_day',        // Specific time of day
      'day_of_week',        // Specific days
      'location_radius',    // Within GPS radius
      'camera_model',       // Specific camera
      'photo_type',         // Screenshot, selfie, etc.
      'color_dominant',     // Dominant color matching
      'min_faces',          // Minimum number of faces
      'min_objects'         // Minimum number of objects
    ]).notNullable();
    table.json('parameters').notNullable(); // Rule-specific parameters
    table.enum('operator', ['AND', 'OR', 'NOT']).defaultTo('AND');
    table.integer('priority').defaultTo(100);
    table.boolean('is_active').defaultTo(true);
    
    // Indexes
    table.index('album_id');
    table.index('rule_type');
    table.index('is_active');
  });

  // Create album statistics table for performance tracking
  await knex.schema.createTable('smart_album_stats', table => {
    table.increments('id').primary();
    table.integer('album_id').unsigned().notNullable()
      .references('id').inTable('smart_albums').onDelete('CASCADE');
    table.date('stat_date').notNullable();
    table.integer('image_count').defaultTo(0);
    table.integer('new_images').defaultTo(0); // Images added that day
    table.integer('view_count').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Unique constraint for one stat per album per day
    table.unique(['album_id', 'stat_date']);
    
    // Indexes
    table.index('album_id');
    table.index('stat_date');
  });

  // Add smart album tracking to images table
  await knex.schema.table('images', table => {
    table.timestamp('smart_albums_processed_at');
    table.integer('smart_album_count').defaultTo(0);
    
    table.index('smart_albums_processed_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Remove columns from images table
  await knex.schema.table('images', table => {
    table.dropColumn('smart_albums_processed_at');
    table.dropColumn('smart_album_count');
  });
  
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('smart_album_stats');
  await knex.schema.dropTableIfExists('smart_album_rules');
  await knex.schema.dropTableIfExists('smart_album_images');
  await knex.schema.dropTableIfExists('smart_albums');
};
