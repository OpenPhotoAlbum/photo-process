/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.alterTable('images', function(table) {
        // Change date_taken from TIMESTAMP to DATETIME to support dates before 1970
        table.datetime('date_taken').alter();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.alterTable('images', function(table) {
        // Revert back to TIMESTAMP (note: this will lose data for dates before 1970)
        table.timestamp('date_taken').alter();
    });
};