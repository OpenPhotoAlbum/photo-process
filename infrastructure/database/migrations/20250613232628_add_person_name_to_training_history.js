/**
 * Add person_name column to recognition_training_history table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.hasTable('recognition_training_history')
        .then(exists => {
            if (exists) {
                return knex.schema.hasColumn('recognition_training_history', 'person_name')
                    .then(hasColumn => {
                        if (!hasColumn) {
                            return knex.schema.alterTable('recognition_training_history', table => {
                                table.string('person_name', 200).after('person_id');
                            });
                        }
                    });
            } else {
                console.warn('[WARN] recognition_training_history table does not exist, skipping person_name column addition');
            }
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.alterTable('recognition_training_history', table => {
        table.dropColumn('person_name');
    });
};
