/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    // First drop all existing tables to ensure clean state
    return knex.schema
        .dropTableIfExists('processing_jobs')
        .dropTableIfExists('image_tags')
        .dropTableIfExists('detected_faces')
        .dropTableIfExists('persons')
        .dropTableIfExists('image_metadata')
        .dropTableIfExists('images')
        .dropTableIfExists('media') // Drop the old media table too
        
        // Now create the complete schema
        .createTable('images', table => {
            table.increments('id');
            table.string('filename', 500).notNullable();
            table.string('original_path', 1000).notNullable();
            table.string('processed_path', 1000);
            table.string('thumbnail_path', 1000);
            table.string('file_hash', 64).unique();
            table.bigInteger('file_size');
            table.string('mime_type', 100);
            table.integer('width');
            table.integer('height');
            table.string('dominant_color', 7);
            table.enum('processing_status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
            table.text('processing_error');
            table.timestamp('date_taken');
            table.timestamp('date_processed');
            table.timestamps(true, true);
            
            // Indexes
            table.index('filename');
            table.index('file_hash');
            table.index('processing_status');
            table.index('date_taken');
        })
        
        .createTable('image_metadata', table => {
            table.increments('id');
            table.integer('image_id').unsigned().references('id').inTable('images').onDelete('CASCADE');
            
            // Camera information
            table.string('camera_make', 100);
            table.string('camera_model', 200);
            table.string('software', 200);
            table.string('lens_model', 200);
            
            // Technical settings
            table.decimal('focal_length', 8, 2);
            table.string('aperture', 20);
            table.string('shutter_speed', 50);
            table.integer('iso');
            table.string('flash', 100);
            table.string('white_balance', 50);
            table.string('exposure_mode', 50);
            
            // Location data
            table.decimal('latitude', 10, 8);
            table.decimal('longitude', 11, 8);
            table.string('city', 200);
            table.string('state', 200);
            table.string('country', 200);
            table.decimal('altitude', 10, 2);
            
            // Other metadata
            table.integer('orientation');
            table.string('color_space', 50);
            table.json('raw_exif');
            
            table.timestamps(true, true);
            table.index(['latitude', 'longitude']);
            table.index('camera_make');
        })
        
        .createTable('persons', table => {
            table.increments('id');
            table.string('name', 200);
            table.text('notes');
            table.string('primary_face_path', 1000);
            table.json('average_embedding');
            table.integer('face_count').defaultTo(0);
            table.timestamps(true, true);
            
            table.index('name');
        })
        
        .createTable('detected_faces', table => {
            table.increments('id');
            table.integer('image_id').unsigned().references('id').inTable('images').onDelete('CASCADE');
            table.string('face_image_path', 1000);
            
            // Bounding box coordinates
            table.integer('x_min');
            table.integer('y_min');
            table.integer('x_max');
            table.integer('y_max');
            table.decimal('detection_confidence', 5, 4);
            
            // Demographics
            table.string('predicted_gender', 20);
            table.decimal('gender_confidence', 5, 4);
            table.integer('age_min');
            table.integer('age_max');
            table.decimal('age_confidence', 5, 4);
            
            // Face pose
            table.decimal('pitch', 8, 4);
            table.decimal('roll', 8, 4);
            table.decimal('yaw', 8, 4);
            
            // Facial landmarks and embeddings
            table.json('landmarks');
            table.json('face_embedding');
            
            // Person identification
            table.integer('person_id').unsigned();
            table.decimal('person_confidence', 5, 4);
            
            table.timestamps(true, true);
            table.index('image_id');
            table.index('person_id');
            table.index('predicted_gender');
            table.index(['age_min', 'age_max']);
            
            table.foreign('person_id').references('id').inTable('persons').onDelete('SET NULL');
        })
        
        .createTable('image_tags', table => {
            table.increments('id');
            table.integer('image_id').unsigned().references('id').inTable('images').onDelete('CASCADE');
            table.string('tag', 100).notNullable();
            table.string('tag_type', 50).defaultTo('manual');
            table.decimal('confidence', 5, 4);
            table.timestamps(true, true);
            
            table.unique(['image_id', 'tag']);
            table.index('tag');
            table.index('tag_type');
        })
        
        .createTable('processing_jobs', table => {
            table.increments('id');
            table.integer('image_id').unsigned().references('id').inTable('images').onDelete('CASCADE');
            table.enum('job_type', ['extract_metadata', 'detect_faces', 'generate_thumbnail', 'analyze_content']);
            table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
            table.text('error_message');
            table.timestamp('started_at');
            table.timestamp('completed_at');
            table.timestamps(true, true);
            
            table.index(['status', 'job_type']);
            table.index('image_id');
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema
        .dropTableIfExists('processing_jobs')
        .dropTableIfExists('image_tags')
        .dropTableIfExists('detected_faces')
        .dropTableIfExists('persons')
        .dropTableIfExists('image_metadata')
        .dropTableIfExists('images');
};