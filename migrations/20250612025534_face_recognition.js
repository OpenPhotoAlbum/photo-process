/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema
        .createTable('persons', table => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.text('notes');
            table.string('compreface_subject_id').unique(); // Links to CompreFace subject
            table.string('primary_face_path'); // Path to best representative face image
            table.json('average_embedding'); // Average face embedding for clustering
            table.integer('face_count').defaultTo(0); // Number of faces linked to this person
            table.boolean('auto_recognize').defaultTo(true); // Whether to auto-recognize this person
            table.timestamps(true, true);
        })
        .then(() => {
            // Update detected_faces table to link to persons
            return knex.schema.alterTable('detected_faces', table => {
                table.integer('person_id').unsigned();
                table.foreign('person_id').references('id').inTable('persons').onDelete('SET NULL');
                table.float('person_confidence'); // Confidence of person identification
                table.string('recognition_method').defaultTo('manual'); // 'manual', 'auto', 'compreface'
            });
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema
        .alterTable('detected_faces', table => {
            table.dropForeign('person_id');
            table.dropColumn('person_id');
            table.dropColumn('person_confidence');
            table.dropColumn('recognition_method');
        })
        .then(() => {
            return knex.schema.dropTableIfExists('persons');
        });
};
