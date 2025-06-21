#!/usr/bin/env node
require('dotenv').config();
const { db } = require('./build/models/database');

async function findOrientations() {
  const orientations = await db('image_metadata')
    .join('images', 'image_metadata.image_id', 'images.id')
    .join('detected_faces', 'images.id', 'detected_faces.image_id')
    .select('image_metadata.orientation', 'images.id', 'images.filename', 'images.relative_media_path')
    .whereNotNull('image_metadata.orientation')
    .whereNotNull('detected_faces.face_image_path')
    .groupBy('image_metadata.orientation', 'images.id', 'images.filename', 'images.relative_media_path')
    .orderBy('image_metadata.orientation');
  
  const byOrientation = {};
  orientations.forEach(img => {
    if (!byOrientation[img.orientation]) {
      byOrientation[img.orientation] = [];
    }
    if (byOrientation[img.orientation].length < 3) {
      byOrientation[img.orientation].push(img);
    }
  });
  
  console.log('Images by EXIF Orientation:');
  Object.keys(byOrientation).sort((a,b) => parseInt(a) - parseInt(b)).forEach(orientation => {
    console.log(`\nOrientation ${orientation}:`);
    byOrientation[orientation].forEach(img => {
      console.log(`  Image ${img.id}: ${img.filename}`);
    });
  });
  
  await db.destroy();
}

findOrientations().catch(console.error);