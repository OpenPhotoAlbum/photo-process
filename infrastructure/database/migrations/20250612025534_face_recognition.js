/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema
        .hasTable('persons')
        .then(exists => {
            if (!exists) {
                return knex.schema.createTable('persons', table => {
                    table.increments('id').primary();
                    table.string('name').notNullable();
                    table.text('notes');
                    table.string('compreface_subject_id').unique(); // Links to CompreFace subject
                    table.string('primary_face_path'); // Path to best representative face image
                    table.json('average_embedding'); // Average face embedding for clustering
                    table.integer('face_count').defaultTo(0); // Number of faces linked to this person
                    table.boolean('auto_recognize').defaultTo(true); // Whether to auto-recognize this person
                    table.timestamps(true, true);
                });
            } else {
                // Add missing columns to existing table
                return knex.schema.alterTable('persons', table => {
                    return knex.raw(`
                        ALTER TABLE persons 
                        ADD COLUMN IF NOT EXISTS compreface_subject_id VARCHAR(255) UNIQUE,
                        ADD COLUMN IF NOT EXISTS auto_recognize BOOLEAN DEFAULT true
                    `);
                });
            }
        })
        .then(() => {
            // Check which columns exist in detected_faces
            return knex.schema.hasColumn('detected_faces', 'person_id')
                .then(hasPersonId => {
                    if (!hasPersonId) {
                        // Add all columns if person_id doesn't exist
                        return knex.schema.alterTable('detected_faces', table => {
                            table.integer('person_id').unsigned();
                            table.foreign('person_id').references('id').inTable('persons').onDelete('SET NULL');
                            table.float('person_confidence'); // Confidence of person identification
                            table.string('recognition_method').defaultTo('manual'); // 'manual', 'auto', 'compreface'
                        });
                    } else {
                        // Check for other columns individually
                        return Promise.all([
                            knex.schema.hasColumn('detected_faces', 'person_confidence'),
                            knex.schema.hasColumn('detected_faces', 'recognition_method')
                        ]).then(([hasConfidence, hasMethod]) => {
                            const columnsToAdd = [];
                            if (!hasConfidence) {
                                columnsToAdd.push('ADD COLUMN person_confidence FLOAT');
                            }
                            if (!hasMethod) {
                                columnsToAdd.push("ADD COLUMN recognition_method VARCHAR(255) DEFAULT 'manual'");
                            }
                            
                            if (columnsToAdd.length > 0) {
                                return knex.raw(`ALTER TABLE detected_faces ${columnsToAdd.join(', ')}`);
                            }
                        });
                    }
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
