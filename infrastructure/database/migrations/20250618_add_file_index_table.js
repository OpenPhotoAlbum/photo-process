/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('file_index', function(table) {
        table.string('file_path', 500).primary();
        table.bigInteger('file_size').notNullable();
        table.datetime('file_mtime').notNullable();
        table.string('file_hash', 64).nullable();
        table.datetime('discovered_at').defaultTo(knex.fn.now());
        table.enum('processing_status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
        table.datetime('last_processed').nullable();
        table.integer('retry_count').defaultTo(0);
        table.text('error_message').nullable();
        
        // Indexes for fast queries
        table.index(['processing_status', 'discovered_at'], 'idx_file_index_processing_status');
        table.index('file_hash', 'idx_file_index_hash');
        table.index('file_mtime', 'idx_file_index_mtime');
        table.index('last_processed', 'idx_file_index_last_processed');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable('file_index');
};