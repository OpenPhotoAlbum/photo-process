/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.table('images', function(table) {
        table.boolean('is_screenshot').defaultTo(false);
        table.integer('screenshot_confidence').defaultTo(0); // 0-100 confidence score
        table.text('screenshot_reasons'); // JSON array of detection reasons
        table.enum('junk_status', ['unreviewed', 'confirmed_junk', 'confirmed_important']).defaultTo('unreviewed');
        table.timestamp('junk_reviewed_at');
        
        // Add indexes for filtering
        table.index('is_screenshot');
        table.index('junk_status');
        table.index(['is_screenshot', 'junk_status']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.table('images', function(table) {
        table.dropColumn('is_screenshot');
        table.dropColumn('screenshot_confidence');
        table.dropColumn('screenshot_reasons');
        table.dropColumn('junk_status');
        table.dropColumn('junk_reviewed_at');
    });
};
