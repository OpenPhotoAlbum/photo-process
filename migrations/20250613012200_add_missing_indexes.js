/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return Promise.all([
    // Add indexes for images table (most important for gallery performance)
    knex.schema.table('images', function(table) {
      table.index('processing_status', 'idx_images_processing_status');
      table.index('date_processed', 'idx_images_date_processed');
      table.index(['date_processed', 'id'], 'idx_images_date_processed_id'); // Composite for cursor pagination
      table.index(['processing_status', 'date_processed'], 'idx_images_status_date');
    }).catch(err => {
      // Ignore errors for existing indexes
      if (!err.message.includes('Duplicate key name')) {
        throw err;
      }
    }),
    
    // Add indexes for persons table
    knex.schema.table('persons', function(table) {
      table.index('name', 'idx_persons_name');
    }).catch(err => {
      if (!err.message.includes('Duplicate key name')) {
        throw err;
      }
    }),
    
    // Add indexes for detected_objects table if it exists
    knex.schema.hasTable('detected_objects').then(exists => {
      if (exists) {
        return knex.schema.table('detected_objects', function(table) {
          table.index('class', 'idx_detected_objects_class');
          table.index(['class', 'confidence'], 'idx_detected_objects_class_confidence');
        }).catch(err => {
          if (!err.message.includes('Duplicate key name')) {
            throw err;
          }
        });
      }
    })
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return Promise.all([
    // Drop indexes for images table
    knex.schema.table('images', function(table) {
      table.dropIndex('processing_status', 'idx_images_processing_status');
      table.dropIndex('date_processed', 'idx_images_date_processed');
      table.dropIndex(['date_processed', 'id'], 'idx_images_date_processed_id');
      table.dropIndex(['processing_status', 'date_processed'], 'idx_images_status_date');
    }).catch(() => {}), // Ignore errors
    
    // Drop indexes for persons table
    knex.schema.table('persons', function(table) {
      table.dropIndex('name', 'idx_persons_name');
    }).catch(() => {}),
    
    // Drop indexes for detected_objects table if it exists
    knex.schema.hasTable('detected_objects').then(exists => {
      if (exists) {
        return knex.schema.table('detected_objects', function(table) {
          table.dropIndex('class', 'idx_detected_objects_class');
          table.dropIndex(['class', 'confidence'], 'idx_detected_objects_class_confidence');
        }).catch(() => {});
      }
    })
  ]);
};