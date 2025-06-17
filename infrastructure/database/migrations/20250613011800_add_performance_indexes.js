/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return Promise.all([
    // Add indexes for detected_faces table
    knex.schema.table('detected_faces', function(table) {
      table.index('person_id', 'idx_detected_faces_person_id');
      table.index('detection_confidence', 'idx_detected_faces_confidence');
      table.index(['person_id', 'detection_confidence'], 'idx_detected_faces_person_confidence');
      table.index('image_id', 'idx_detected_faces_image_id');
    }),
    
    // Add indexes for images table
    knex.schema.table('images', function(table) {
      table.index('processing_status', 'idx_images_processing_status');
      table.index('date_processed', 'idx_images_date_processed');
      table.index(['date_processed', 'id'], 'idx_images_date_processed_id'); // Composite for cursor pagination
      table.index(['processing_status', 'date_processed'], 'idx_images_status_date');
    }),
    
    // Add indexes for image_metadata table if it exists
    knex.schema.hasTable('image_metadata').then(exists => {
      if (exists) {
        return knex.schema.table('image_metadata', function(table) {
          table.index('image_id', 'idx_image_metadata_image_id');
        });
      }
    }),
    
    // Add indexes for persons table
    knex.schema.table('persons', function(table) {
      table.index('name', 'idx_persons_name');
    }),
    
    // Add indexes for detected_objects table if it exists
    knex.schema.hasTable('detected_objects').then(exists => {
      if (exists) {
        return knex.schema.table('detected_objects', function(table) {
          table.index('image_id', 'idx_detected_objects_image_id');
          table.index('class', 'idx_detected_objects_class');
          table.index('confidence', 'idx_detected_objects_confidence');
          table.index(['class', 'confidence'], 'idx_detected_objects_class_confidence');
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
    // Drop indexes for detected_faces table
    knex.schema.table('detected_faces', function(table) {
      table.dropIndex('person_id', 'idx_detected_faces_person_id');
      table.dropIndex('detection_confidence', 'idx_detected_faces_confidence');
      table.dropIndex(['person_id', 'detection_confidence'], 'idx_detected_faces_person_confidence');
      table.dropIndex('image_id', 'idx_detected_faces_image_id');
    }),
    
    // Drop indexes for images table
    knex.schema.table('images', function(table) {
      table.dropIndex('processing_status', 'idx_images_processing_status');
      table.dropIndex('date_processed', 'idx_images_date_processed');
      table.dropIndex(['date_processed', 'id'], 'idx_images_date_processed_id');
      table.dropIndex(['processing_status', 'date_processed'], 'idx_images_status_date');
    }),
    
    // Drop indexes for image_metadata table if it exists
    knex.schema.hasTable('image_metadata').then(exists => {
      if (exists) {
        return knex.schema.table('image_metadata', function(table) {
          table.dropIndex('image_id', 'idx_image_metadata_image_id');
        });
      }
    }),
    
    // Drop indexes for persons table
    knex.schema.table('persons', function(table) {
      table.dropIndex('name', 'idx_persons_name');
    }),
    
    // Drop indexes for detected_objects table if it exists
    knex.schema.hasTable('detected_objects').then(exists => {
      if (exists) {
        return knex.schema.table('detected_objects', function(table) {
          table.dropIndex('image_id', 'idx_detected_objects_image_id');
          table.dropIndex('class', 'idx_detected_objects_class');
          table.dropIndex('confidence', 'idx_detected_objects_confidence');
          table.dropIndex(['class', 'confidence'], 'idx_detected_objects_class_confidence');
        });
      }
    })
  ]);
};
