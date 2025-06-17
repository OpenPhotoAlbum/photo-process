/**
 * Fix missing recognition_training_history table
 * This migration creates the training history table that was missing due to a partial migration failure
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.hasTable('recognition_training_history')
        .then(exists => {
            if (!exists) {
                console.log('[INFO] Creating missing recognition_training_history table...');
                return knex.schema.createTable('recognition_training_history', table => {
                    table.increments('id').primary();
                    table.integer('person_id').unsigned().notNullable();
                    table.string('person_name', 200).after('person_id');
                    table.integer('faces_trained_count').notNullable();
                    table.enum('training_type', ['initial', 'incremental', 'retrain', 'full', 'validation']).notNullable();
                    table.enum('status', ['pending', 'running', 'in_progress', 'completed', 'failed', 'cancelled']).defaultTo('pending');
                    table.text('error_message');
                    table.float('before_confidence').comment('Average confidence before training');
                    table.float('after_confidence').comment('Average confidence after training');
                    table.timestamp('started_at');
                    table.timestamp('completed_at');
                    table.timestamps(true, true);
                    
                    // Additional columns from implementation
                    table.float('success_rate');
                    table.integer('faces_added');
                    table.integer('faces_failed');
                    
                    table.foreign('person_id').references('id').inTable('persons').onDelete('CASCADE');
                    table.index(['person_id', 'status']);
                    table.index('training_type');
                });
            } else {
                console.log('[INFO] recognition_training_history table already exists');
            }
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTableIfExists('recognition_training_history');
};