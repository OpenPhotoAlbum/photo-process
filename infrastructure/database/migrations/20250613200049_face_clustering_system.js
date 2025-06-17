/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema
        // Note: face_similarities table already exists from face_recognition_enhancements migration
        // Skip creating it here to avoid conflicts
        
        // Face clusters for grouping similar faces
        .createTable('face_clusters', function(table) {
            table.increments('id').primary();
            table.string('cluster_id').notNullable().unique(); // UUID or identifier
            table.decimal('min_similarity', 5, 4).notNullable(); // Minimum similarity threshold for this cluster
            table.string('algorithm').notNullable().defaultTo('bbox_intersection');
            table.integer('face_count').unsigned().notNullable().defaultTo(0);
            table.decimal('avg_similarity', 5, 4); // Average similarity within cluster
            table.integer('representative_face_id').unsigned(); // Face that best represents the cluster
            table.boolean('needs_review').notNullable().defaultTo(true);
            table.integer('suggested_person_id').unsigned(); // AI suggestion for person assignment
            table.decimal('person_confidence', 5, 4); // Confidence in person suggestion
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
            
            table.foreign('representative_face_id').references('id').inTable('detected_faces').onDelete('SET NULL');
            table.foreign('suggested_person_id').references('id').inTable('persons').onDelete('SET NULL');
            table.index(['needs_review', 'face_count']);
            table.index(['algorithm', 'min_similarity']);
        })
        
        // Many-to-many relationship between faces and clusters
        .createTable('face_cluster_memberships', function(table) {
            table.increments('id').primary();
            table.integer('face_id').unsigned().notNullable();
            table.integer('cluster_id').unsigned().notNullable();
            table.decimal('membership_score', 5, 4).notNullable(); // How well this face fits the cluster
            table.boolean('is_representative').notNullable().defaultTo(false); // Is this the cluster representative?
            table.timestamp('added_at').notNullable().defaultTo(knex.fn.now());
            
            table.foreign('face_id').references('id').inTable('detected_faces').onDelete('CASCADE');
            table.foreign('cluster_id').references('id').inTable('face_clusters').onDelete('CASCADE');
            
            table.unique(['face_id', 'cluster_id']);
            table.index(['cluster_id', 'membership_score']);
            table.index(['face_id']);
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema
        .dropTableIfExists('face_cluster_memberships')
        .dropTableIfExists('face_clusters');
        // Note: Don't drop face_similarities as it's managed by face_recognition_enhancements migration
};
