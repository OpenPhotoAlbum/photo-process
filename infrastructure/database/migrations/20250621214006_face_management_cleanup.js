/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // Add timestamp for when face was uploaded to CompreFace
    await knex.schema.table('detected_faces', function(table) {
        table.timestamp('compreface_uploaded_at').nullable();
    });

    // Create detailed training log table
    await knex.schema.createTable('face_training_log', function(table) {
        table.increments('id').primary();
        table.integer('face_id').unsigned().notNullable();
        table.integer('person_id').unsigned().notNullable();
        table.timestamp('upload_attempt_at').defaultTo(knex.fn.now());
        table.boolean('upload_success').defaultTo(false);
        table.text('compreface_response').nullable();
        table.text('error_message').nullable();
        table.integer('training_job_id').nullable();
        
        // Foreign keys
        table.foreign('face_id').references('id').inTable('detected_faces');
        table.foreign('person_id').references('id').inTable('persons');
        
        // Indexes
        table.index(['face_id', 'upload_success'], 'idx_face_upload');
        table.index(['person_id', 'upload_success'], 'idx_person_upload');
        table.index('upload_attempt_at', 'idx_upload_date');
    });

    // Add indexes for faster queries on synced faces
    await knex.schema.table('detected_faces', function(table) {
        table.index(['compreface_synced', 'person_id'], 'idx_compreface_synced');
        table.index(['compreface_uploaded_at', 'person_id'], 'idx_compreface_uploaded');
    });

    // Add flag to control which persons can be auto-trained
    await knex.schema.table('persons', function(table) {
        table.boolean('allow_auto_training').defaultTo(false);
    });

    // Update existing manually assigned faces to be marked as ready for training
    await knex('detected_faces')
        .where('assigned_by', 'user')
        .update({
            compreface_synced: false,
            compreface_uploaded_at: null
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    // Drop in reverse order
    await knex.schema.dropTableIfExists('face_training_log');
    
    await knex.schema.table('detected_faces', function(table) {
        table.dropIndex(['compreface_synced', 'person_id'], 'idx_compreface_synced');
        table.dropIndex(['compreface_uploaded_at', 'person_id'], 'idx_compreface_uploaded');
        table.dropColumn('compreface_uploaded_at');
    });

    await knex.schema.table('persons', function(table) {
        table.dropColumn('allow_auto_training');
    });
};
