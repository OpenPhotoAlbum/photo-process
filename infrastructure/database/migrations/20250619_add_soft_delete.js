/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.alterTable('images', table => {
        // Soft delete columns
        table.timestamp('deleted_at').nullable();
        table.string('deleted_by', 100).nullable(); // Track who deleted it
        table.text('deletion_reason').nullable(); // Optional reason
        
        // Index for efficient queries
        table.index('deleted_at');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.alterTable('images', table => {
        table.dropIndex('deleted_at');
        table.dropColumn('deleted_at');
        table.dropColumn('deleted_by');
        table.dropColumn('deletion_reason');
    });
};