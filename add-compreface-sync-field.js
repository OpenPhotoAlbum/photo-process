const mysql = require('mysql2/promise');

async function addComprefaceSyncField() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: 'mypassword',
    database: 'photo_management'
  });
  
  try {
    // Check if field already exists
    const [rows] = await connection.execute('DESCRIBE detected_faces');
    const hasComprefaceField = rows.some(row => row.Field === 'compreface_synced');
    
    if (hasComprefaceField) {
      console.log('✅ compreface_synced field already exists');
    } else {
      console.log('Adding compreface_synced field...');
      await connection.execute('ALTER TABLE detected_faces ADD COLUMN compreface_synced BOOLEAN DEFAULT FALSE');
      console.log('✅ compreface_synced field added successfully');
    }
    
    // Show current status
    const [syncedCount] = await connection.execute('SELECT COUNT(*) as count FROM detected_faces WHERE compreface_synced = TRUE');
    const [totalAssigned] = await connection.execute('SELECT COUNT(*) as count FROM detected_faces WHERE person_id > 0');
    
    console.log(`📊 Status: ${syncedCount[0].count} faces synced, ${totalAssigned[0].count} total assigned faces`);
    
  } finally {
    await connection.end();
  }
}

addComprefaceSyncField().catch(console.error);