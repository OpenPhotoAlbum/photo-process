/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // First, clean up any invalid GPS data that's out of range
    console.log('Cleaning up out-of-range GPS data...');
    
    // Set extreme altitude values to NULL (likely invalid EXIF data)
    await knex('images')
        .where(knex.raw('ABS(gps_altitude) > 10000'))
        .update({ gps_altitude: null });
    
    // Set invalid direction values to NULL (direction should be 0-360)
    await knex('images')
        .where('gps_direction', '<', 0)
        .orWhere('gps_direction', '>', 360)
        .update({ gps_direction: null });
    
    // Set extreme speed values to NULL
    await knex('images')
        .where(knex.raw('ABS(gps_speed) > 1000'))
        .update({ gps_speed: null });
    
    console.log('Updating GPS column precision...');
    
    // Now update the column precision
    return knex.schema.alterTable('images', table => {
        // Change gps_direction to handle 0-360 degrees with high precision
        table.decimal('gps_direction', 9, 6).alter();  // 360.123456 max (3 digits before decimal)
        // Change altitude to handle reasonable altitude range with precision
        table.decimal('gps_altitude', 8, 3).alter();   // -9999.999 to 9999.999 meters
        // Change speed to handle reasonable speed values
        table.decimal('gps_speed', 7, 3).alter();      // 0-9999.999 m/s
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.alterTable('images', table => {
        // Revert to original precision (may cause data loss)
        table.decimal('gps_direction', 6, 3).alter();
        table.decimal('gps_altitude', 8, 2).alter();  // Match current schema
        table.decimal('gps_speed', 8, 2).alter();     // Match current schema
    });
};