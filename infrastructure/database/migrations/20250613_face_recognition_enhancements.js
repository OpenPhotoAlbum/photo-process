/**
 * Face Recognition Enhancements
 * Adds advanced face recognition features for person identification and clustering
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema
        // Enhance persons table with additional recognition features
        .alterTable('persons', table => {
            // compreface_subject_id and auto_recognize already exist from earlier migration
            table.enum('recognition_status', ['untrained', 'training', 'trained', 'failed']).defaultTo('untrained').after('auto_recognize');
            table.integer('training_face_count').defaultTo(0).after('recognition_status');
            table.timestamp('last_trained_at').after('training_face_count');
            table.float('avg_recognition_confidence').after('last_trained_at');
        })
        
        // Enhance detected_faces table with recognition metadata
        .alterTable('detected_faces', table => {
            // recognition_method already exists, but need to change it to enum and add new values
            // First check if we need to modify the existing column or add new ones
            table.boolean('needs_review').defaultTo(false).after('recognition_method');
            table.timestamp('assigned_at').after('needs_review');
            table.string('assigned_by').after('assigned_at'); // user who made the assignment
            table.boolean('is_training_image').defaultTo(false).after('assigned_by');
            table.float('similarity_score').after('is_training_image'); // similarity to person's average embedding
        })
        
        // Skip face clusters table creation - already exists from 20250613200049_face_clustering_system.js
        // Just add any missing columns to existing face_clusters table if needed
        .table('face_clusters', table => {
            // Check if we need to add any columns that don't exist in the current schema
            // The existing schema uses different column names, so we'll work with what's there
        })
        
        // Create recognition training history table
        .createTable('recognition_training_history', table => {
            table.increments('id').primary();
            table.integer('person_id').unsigned().notNullable();
            table.integer('faces_trained_count').notNullable();
            table.enum('training_type', ['initial', 'incremental', 'retrain']).notNullable();
            table.enum('status', ['pending', 'in_progress', 'completed', 'failed']).defaultTo('pending');
            table.text('error_message');
            table.float('before_confidence').comment('Average confidence before training');
            table.float('after_confidence').comment('Average confidence after training');
            table.timestamp('started_at');
            table.timestamp('completed_at');
            table.timestamps(true, true);
            
            table.foreign('person_id').references('id').inTable('persons').onDelete('CASCADE');
            table.index(['person_id', 'status']);
            table.index('training_type');
        })
        
        // Create face similarity matrix table for clustering analysis
        .createTable('face_similarities', table => {
            table.increments('id').primary();
            table.integer('face_a_id').unsigned().notNullable();
            table.integer('face_b_id').unsigned().notNullable();
            table.float('similarity_score').notNullable();
            table.enum('comparison_method', ['embedding_distance', 'compreface_api', 'manual']).defaultTo('embedding_distance');
            table.timestamp('calculated_at').defaultTo(knex.fn.now());
            
            table.foreign('face_a_id').references('id').inTable('detected_faces').onDelete('CASCADE');
            table.foreign('face_b_id').references('id').inTable('detected_faces').onDelete('CASCADE');
            table.unique(['face_a_id', 'face_b_id']);
            table.index('similarity_score');
            table.index('comparison_method');
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema
        .dropTableIfExists('face_similarities')
        .dropTableIfExists('recognition_training_history')
        // Skip dropping face_clusters - managed by other migration
        .then(() => {
            return knex.schema.alterTable('detected_faces', table => {
                // Only drop columns that we added in this migration
                table.dropColumn('needs_review');
                table.dropColumn('assigned_at');
                table.dropColumn('assigned_by');
                table.dropColumn('is_training_image');
                table.dropColumn('similarity_score');
            });
        })
        .then(() => {
            return knex.schema.alterTable('persons', table => {
                // Only drop columns that we added in this migration
                table.dropColumn('recognition_status');
                table.dropColumn('training_face_count');
                table.dropColumn('last_trained_at');
                table.dropColumn('avg_recognition_confidence');
            });
        });
};