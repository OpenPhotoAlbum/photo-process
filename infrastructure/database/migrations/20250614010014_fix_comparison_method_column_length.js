exports.up = function(knex) {
  return knex.schema.alterTable('face_similarities', function(table) {
    // Change comparison_method from ENUM to VARCHAR(50) to accommodate longer values
    table.string('comparison_method', 50).alter();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('face_similarities', function(table) {
    // Revert back to shorter ENUM (this may cause data loss if longer values exist)
    table.enu('comparison_method', ['embedding_distance', 'compreface_api', 'manual']).alter();
  });
};