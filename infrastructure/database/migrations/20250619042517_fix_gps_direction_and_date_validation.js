/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Fix GPS direction column size - change from varchar(10) to decimal(6,3) for GPS bearings (0-360 degrees)
  await knex.schema.alterTable('images', table => {
    table.decimal('gps_direction', 6, 3).nullable().alter();
  });
  
  console.log('✅ Fixed GPS direction column size from varchar(10) to decimal(6,3)');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Revert GPS direction back to varchar(10)
  await knex.schema.alterTable('images', table => {
    table.string('gps_direction', 10).nullable().alter();
  });
  
  console.log('⏪ Reverted GPS direction column back to varchar(10)');
};
