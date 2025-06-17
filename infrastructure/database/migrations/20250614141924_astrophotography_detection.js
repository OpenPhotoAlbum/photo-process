/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // Check if astrophotography columns already exist
    const hasColumns = await knex.schema.hasColumn('images', 'is_astrophotography');
    
    if (!hasColumns) {
        return knex.schema.table('images', function(table) {
            // Astrophotography detection fields
            table.boolean('is_astrophotography').defaultTo(false).index();
            table.decimal('astro_confidence', 5, 4).nullable(); // 0.0000 to 1.0000
            table.json('astro_details').nullable(); // Store detection details like star count, nebula detection, etc.
            table.string('astro_classification', 100).nullable(); // e.g., 'stars', 'nebula', 'galaxy', 'moon', 'planets'
            table.timestamp('astro_detected_at').nullable();
            
            // Add indexes for efficient querying
            table.index(['is_astrophotography', 'astro_confidence']);
            table.index('astro_classification');
        });
    } else {
        console.log('Astrophotography columns already exist, skipping migration');
        return Promise.resolve();
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.table('images', function(table) {
        // Remove astrophotography detection fields
        table.dropColumn('is_astrophotography');
        table.dropColumn('astro_confidence');
        table.dropColumn('astro_details');
        table.dropColumn('astro_classification');
        table.dropColumn('astro_detected_at');
    });
};
