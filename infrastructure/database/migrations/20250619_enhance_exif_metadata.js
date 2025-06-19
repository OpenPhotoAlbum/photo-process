/**
 * Migration to enhance EXIF metadata extraction and storage
 * Adds additional useful fields for richer image details
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema
        // Add new columns to image_metadata table
        .alterTable('image_metadata', table => {
            // Advanced Camera Settings
            table.decimal('exposure_compensation', 5, 2).comment('EV compensation');
            table.string('metering_mode', 50).comment('Spot, center-weighted, etc');
            table.string('exposure_program', 50).comment('Manual, aperture priority, etc');
            table.string('scene_type', 50);
            table.decimal('subject_distance', 10, 2).comment('Distance to subject in meters');
            table.integer('focal_length_35mm').comment('35mm equivalent focal length');
            table.decimal('max_aperture_value', 4, 2).comment('Maximum lens aperture');
            table.decimal('digital_zoom_ratio', 5, 2);
            table.string('gain_control', 50);
            table.string('contrast', 50);
            table.string('saturation', 50);
            table.string('sharpness', 50);
            table.decimal('brightness_value', 8, 4);
            
            // Advanced GPS/Location Data
            table.string('gps_latitude_ref', 1).comment('N or S');
            table.string('gps_longitude_ref', 1).comment('E or W');
            table.string('gps_altitude_ref', 20).comment('Above/below sea level');
            table.decimal('gps_dop', 10, 4).comment('Dilution of precision (accuracy)');
            table.string('gps_satellites', 50).comment('Satellites used');
            table.string('gps_status', 20).comment('Measurement status');
            table.string('gps_measure_mode', 10).comment('2D or 3D');
            table.string('gps_map_datum', 50).comment('Usually WGS84');
            table.datetime('gps_datetime').comment('GPS timestamp');
            table.string('gps_processing_method', 100);
            table.string('gps_area_information', 255).comment('Location name/description');
            table.decimal('gps_h_positioning_error', 10, 4).comment('Horizontal positioning error in meters');
            
            // Time precision
            table.string('subsec_time_original', 10).comment('Subsecond precision');
            table.string('timezone_offset', 10).comment('Original timezone offset');
            
            // Creator/Copyright
            table.string('artist', 255).comment('Photographer/creator name');
            table.string('copyright', 500);
            table.text('image_description').comment('Caption/description');
            table.text('user_comment');
            
            // Additional metadata
            table.integer('rating').comment('Star rating 0-5');
            table.string('lens_make', 100);
            table.string('lens_serial_number', 100);
            table.string('lens_info', 255).comment('Lens specifications');
            table.string('body_serial_number', 100).comment('Camera body serial number');
            table.string('owner_name', 255).comment('Camera owner name');
            
            // Scene/subject detection
            table.string('scene_capture_type', 50).comment('Standard, landscape, portrait, night');
            table.string('subject_area', 100).comment('Subject area in frame');
            table.string('light_source', 50).comment('Type of light source');
            
            // Add indexes for commonly searched fields
            table.index('rating');
            table.index('artist');
            table.index('scene_capture_type');
            table.index('gps_h_positioning_error');
        })
        
        // Create new table for image tags/keywords
        .createTable('image_keywords', table => {
            table.increments('id');
            table.integer('image_id').unsigned().references('id').inTable('images').onDelete('CASCADE');
            table.string('keyword', 100).notNullable();
            table.string('source', 50).defaultTo('exif').comment('exif, user, auto');
            table.timestamp('created_at').defaultTo(knex.fn.now());
            
            table.unique(['image_id', 'keyword']);
            table.index('keyword');
            table.index(['image_id', 'keyword']);
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema
        .dropTableIfExists('image_keywords')
        .alterTable('image_metadata', table => {
            // Drop all the new columns
            table.dropColumn('exposure_compensation');
            table.dropColumn('metering_mode');
            table.dropColumn('exposure_program');
            table.dropColumn('scene_type');
            table.dropColumn('subject_distance');
            table.dropColumn('focal_length_35mm');
            table.dropColumn('max_aperture_value');
            table.dropColumn('digital_zoom_ratio');
            table.dropColumn('gain_control');
            table.dropColumn('contrast');
            table.dropColumn('saturation');
            table.dropColumn('sharpness');
            table.dropColumn('brightness_value');
            
            table.dropColumn('gps_latitude_ref');
            table.dropColumn('gps_longitude_ref');
            table.dropColumn('gps_altitude_ref');
            table.dropColumn('gps_dop');
            table.dropColumn('gps_satellites');
            table.dropColumn('gps_status');
            table.dropColumn('gps_measure_mode');
            table.dropColumn('gps_map_datum');
            table.dropColumn('gps_datetime');
            table.dropColumn('gps_processing_method');
            table.dropColumn('gps_area_information');
            table.dropColumn('gps_h_positioning_error');
            
            table.dropColumn('subsec_time_original');
            table.dropColumn('timezone_offset');
            
            table.dropColumn('artist');
            table.dropColumn('copyright');
            table.dropColumn('image_description');
            table.dropColumn('user_comment');
            
            table.dropColumn('rating');
            table.dropColumn('lens_make');
            table.dropColumn('lens_serial_number');
            table.dropColumn('lens_info');
            table.dropColumn('body_serial_number');
            table.dropColumn('owner_name');
            
            table.dropColumn('scene_capture_type');
            table.dropColumn('subject_area');
            table.dropColumn('light_source');
            
            // Drop indexes
            table.dropIndex('rating');
            table.dropIndex('artist');
            table.dropIndex('scene_capture_type');
            table.dropIndex('gps_h_positioning_error');
        });
};