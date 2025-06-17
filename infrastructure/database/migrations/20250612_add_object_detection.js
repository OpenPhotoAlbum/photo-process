/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema
        .createTable('detected_objects', table => {
            table.increments('id');
            table.integer('image_id').unsigned().references('id').inTable('images').onDelete('CASCADE');
            table.string('class', 100).notNullable(); // e.g., 'person', 'car', 'dog'
            table.decimal('confidence', 5, 4).notNullable(); // 0.0000 to 1.0000
            
            // Bounding box coordinates
            table.integer('x').notNullable();
            table.integer('y').notNullable();
            table.integer('width').notNullable();
            table.integer('height').notNullable();
            
            table.timestamps(true, true);
            
            // Indexes for efficient searching
            table.index('image_id');
            table.index('class');
            table.index('confidence');
            table.index(['class', 'confidence']); // Compound index for searching specific objects with confidence
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTableIfExists('detected_objects');
};