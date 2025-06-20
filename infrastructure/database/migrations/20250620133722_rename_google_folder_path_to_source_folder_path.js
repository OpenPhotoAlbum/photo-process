/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('albums', function(table) {
    table.renameColumn('google_folder_path', 'source_folder_path');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('albums', function(table) {
    table.renameColumn('source_folder_path', 'google_folder_path');
  });
};
