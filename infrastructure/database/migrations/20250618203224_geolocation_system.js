/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Countries table with ISO codes and phone codes
  await knex.schema.createTable('geo_countries', table => {
    table.increments('id').primary();
    table.string('country_code', 2).notNullable().unique();
    table.string('iso3', 3);
    table.string('country_name', 100).notNullable();
    table.string('phone_code', 20);
    table.timestamps(true, true);
    
    table.index(['country_code']);
  });

  // States/provinces linked to countries
  await knex.schema.createTable('geo_states', table => {
    table.increments('id').primary();
    table.string('code', 10).notNullable();
    table.string('name', 100).notNullable();
    table.string('country_code', 2).notNullable();
    table.timestamps(true, true);
    
    table.foreign('country_code').references('country_code').inTable('geo_countries').onDelete('CASCADE');
    table.index(['country_code']);
    table.unique(['code', 'country_code']);
  });

  // Cities with precise GPS coordinates
  await knex.schema.createTable('geo_cities', table => {
    table.increments('id').primary();
    table.string('postal_code', 20);
    table.decimal('latitude', 10, 8).notNullable();
    table.decimal('longitude', 11, 8).notNullable();
    table.string('city', 100).notNullable();
    table.string('state_code', 10);
    table.string('county_name', 100);
    table.string('county_names_all', 255);
    table.string('timezone', 50);
    table.timestamps(true, true);
    
    // Spatial indexes for fast coordinate-based queries
    table.index(['latitude', 'longitude'], 'idx_coordinates');
    table.index(['state_code']);
    table.index(['city']);
  });

  // Image-location relationships with confidence scoring
  await knex.schema.createTable('image_geolocations', table => {
    table.increments('id').primary();
    table.integer('image_id').unsigned().notNullable();
    table.integer('city_id').unsigned().notNullable();
    table.decimal('confidence_score', 3, 2).notNullable().defaultTo(0.00);
    table.enu('detection_method', ['EXIF_GPS', 'CLOSEST_MATCH', 'MANUAL']).notNullable();
    table.decimal('distance_miles', 8, 2).nullable();
    table.timestamps(true, true);
    
    table.foreign('image_id').references('id').inTable('images').onDelete('CASCADE');
    table.foreign('city_id').references('id').inTable('geo_cities').onDelete('CASCADE');
    table.unique(['image_id', 'city_id']);
    table.index(['image_id']);
    table.index(['city_id']);
    table.index(['detection_method']);
  });

  // Add GPS columns to images table if they don't exist
  const hasGpsColumns = await knex.schema.hasColumn('images', 'gps_latitude');
  if (!hasGpsColumns) {
    await knex.schema.alterTable('images', table => {
      table.decimal('gps_latitude', 10, 8).nullable();
      table.decimal('gps_longitude', 11, 8).nullable();
      table.decimal('gps_altitude', 8, 2).nullable();
      table.string('gps_direction', 10).nullable();
      table.decimal('gps_speed', 8, 2).nullable();
      
      table.index(['gps_latitude', 'gps_longitude'], 'idx_image_gps');
    });
  }

  // Optional: Location hierarchy cache for fast lookups
  await knex.schema.createTable('location_hierarchy', table => {
    table.increments('id').primary();
    table.integer('city_id').unsigned().notNullable();
    table.string('city_name', 100).notNullable();
    table.string('state_name', 100);
    table.string('state_code', 10);
    table.string('country_name', 100).notNullable();
    table.string('country_code', 2).notNullable();
    table.string('full_location_string', 255).notNullable();
    table.timestamps(true, true);
    
    table.foreign('city_id').references('id').inTable('geo_cities').onDelete('CASCADE');
    table.unique(['city_id']);
    table.index(['country_code']);
    table.index(['state_code']);
    table.index(['full_location_string']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop tables in reverse order of creation (handle foreign key constraints)
  await knex.schema.dropTableIfExists('location_hierarchy');
  await knex.schema.dropTableIfExists('image_geolocations');
  await knex.schema.dropTableIfExists('geo_cities');
  await knex.schema.dropTableIfExists('geo_states');
  await knex.schema.dropTableIfExists('geo_countries');
  
  // Remove GPS columns from images table
  const hasGpsColumns = await knex.schema.hasColumn('images', 'gps_latitude');
  if (hasGpsColumns) {
    await knex.schema.alterTable('images', table => {
      table.dropIndex(['gps_latitude', 'gps_longitude'], 'idx_image_gps');
      table.dropColumn('gps_latitude');
      table.dropColumn('gps_longitude');
      table.dropColumn('gps_altitude');
      table.dropColumn('gps_direction');
      table.dropColumn('gps_speed');
    });
  }
};
