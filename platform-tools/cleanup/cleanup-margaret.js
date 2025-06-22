#!/usr/bin/env node

/**
 * Margaret Cleanup Script
 * 
 * Clears all of Margaret's face assignments and resets her for selective retraining.
 * Keeps the person record but removes all face assignments caused by auto-scanner.
 */

const knex = require('knex');

// Database configuration - using external Docker ports
const dbConfig = {
  client: 'mysql2',
  connection: {
    host: 'localhost',
    port: 3307,  // External Docker port
    user: 'photo',
    password: 'Dalekini21',
    database: 'photo-process'  // Match docker-compose database name
  },
  acquireConnectionTimeout: 60000,
  timeout: 60000
};

const db = knex(dbConfig);

async function main() {
  console.log('🧹 Margaret Face Assignment Cleanup\n');

  try {
    // Step 1: Get Margaret's current state
    const margaret = await db('persons').where('name', 'Margaret').first();
    if (!margaret) {
      console.log('❌ Margaret not found in database');
      return;
    }

    console.log(`📊 Margaret's current state:`);
    console.log(`   ID: ${margaret.id}`);
    console.log(`   Name: ${margaret.name}`);
    console.log(`   Face Count: ${margaret.face_count}`);
    console.log(`   CompreFace Subject: ${margaret.compreface_subject_id}`);
    
    // Get assignment breakdown
    const assignmentStats = await db('detected_faces')
      .select('assigned_by')
      .count('* as count')
      .where('person_id', margaret.id)
      .groupBy('assigned_by');
    
    console.log(`\n📋 Assignment breakdown:`);
    for (const stat of assignmentStats) {
      console.log(`   ${stat.assigned_by || 'null'}: ${stat.count} faces`);
    }

    const totalAssigned = await db('detected_faces')
      .where('person_id', margaret.id)
      .count('id as count')
      .first();
    
    console.log(`\n⚠️  This will:`);
    console.log(`   • Clear ${totalAssigned.count} face assignments from Margaret`);
    console.log(`   • Reset her CompreFace sync status`);
    console.log(`   • Keep the person record for selective retraining`);
    console.log(`   • Keep all face detection records and crop files\n`);
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const proceed = await new Promise(resolve => {
      rl.question('Continue with Margaret cleanup? (yes/no): ', answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
    
    if (!proceed) {
      console.log('❌ Cancelled by user');
      return;
    }

    // Step 2: Clear Margaret's face assignments
    console.log('🔄 Clearing Margaret\'s face assignments...');
    const clearedFaces = await db('detected_faces')
      .where('person_id', margaret.id)
      .update({
        person_id: null,
        person_confidence: null,
        assigned_at: null,
        assigned_by: null,
        compreface_synced: false,
        compreface_uploaded_at: null,
        is_training_image: false
      });
    
    console.log(`✅ Cleared ${clearedFaces} face assignments`);

    // Step 3: Reset Margaret's person record
    console.log('🔄 Resetting Margaret\'s training status...');
    await db('persons')
      .where('id', margaret.id)
      .update({
        face_count: 0,
        training_face_count: 0,
        recognition_status: 'needs_training',
        last_trained_at: null,
        allow_auto_training: false
      });
    
    console.log('✅ Reset Margaret\'s training status');

    // Step 4: Clear any training history
    console.log('🔄 Clearing training history...');
    const deletedHistory = await db('recognition_training_history')
      .where('person_id', margaret.id)
      .del();
    
    console.log(`✅ Cleared ${deletedHistory} training history records`);

    // Step 5: Final verification
    console.log('\n📊 Margaret\'s final state:');
    const updatedMargaret = await db('persons').where('id', margaret.id).first();
    const remainingAssignments = await db('detected_faces')
      .where('person_id', margaret.id)
      .count('id as count')
      .first();
    
    console.log(`   Face Count: ${updatedMargaret.face_count}`);
    console.log(`   Training Status: ${updatedMargaret.recognition_status}`);
    console.log(`   Remaining Assignments: ${remainingAssignments.count}`);
    
    console.log('\n🎉 Margaret cleanup completed successfully!');
    console.log('💡 Margaret is now ready for selective retraining with manually chosen faces.');

  } catch (error) {
    console.error('💥 Error during Margaret cleanup:', error);
  } finally {
    await db.destroy();
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };