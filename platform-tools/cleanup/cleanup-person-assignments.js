#!/usr/bin/env node

/**
 * Cleanup Person Assignments Script
 * 
 * Clears all person/face assignment data to start fresh with person management.
 * Keeps all images, face detection data, and face crop files intact.
 * Only removes person assignments and person records.
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
  console.log('🧹 Starting person assignment cleanup...\n');

  try {
    // Step 1: Get current counts
    console.log('📊 Current database state:');
    const personCount = await db('persons').count('id as count').first();
    const assignedFacesCount = await db('detected_faces').whereNotNull('person_id').count('id as count').first();
    const totalFacesCount = await db('detected_faces').count('id as count').first();
    
    console.log(`   👥 Persons: ${personCount.count}`);
    console.log(`   🔗 Assigned faces: ${assignedFacesCount.count}`);
    console.log(`   👤 Total faces: ${totalFacesCount.count}`);
    console.log(`   📷 Unassigned faces: ${totalFacesCount.count - assignedFacesCount.count}\n`);
    
    if (personCount.count === 0 && assignedFacesCount.count === 0) {
      console.log('✅ No person assignments found. Database is already clean!');
      return;
    }
    
    // Confirmation prompt
    console.log(`⚠️  This will:`);
    console.log(`   • Delete ${personCount.count} person records`);
    console.log(`   • Clear person assignments from ${assignedFacesCount.count} faces`);
    console.log(`   • Keep all ${totalFacesCount.count} face detection records`);
    console.log(`   • Keep all face crop files`);
    console.log(`   • Keep all image records\n`);
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const proceed = await new Promise(resolve => {
      rl.question('Continue with cleanup? (yes/no): ', answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
    
    if (!proceed) {
      console.log('❌ Cancelled by user');
      return;
    }

    // Step 2: Clear face assignments
    console.log('🔄 Step 1: Clearing face-to-person assignments...');
    const clearedAssignments = await db('detected_faces')
      .whereNotNull('person_id')
      .update({
        person_id: null,
        person_confidence: null,
        assigned_at: null,
        assigned_by: null
      });
    
    console.log(`✅ Cleared ${clearedAssignments} face assignments`);

    // Step 3: Delete training history
    console.log('🔄 Step 2: Clearing training history...');
    const deletedTrainingHistory = await db('recognition_training_history').del();
    console.log(`✅ Deleted ${deletedTrainingHistory} training history records`);

    // Step 4: Delete persons
    console.log('🔄 Step 3: Deleting person records...');
    const deletedPersons = await db('persons').del();
    console.log(`✅ Deleted ${deletedPersons} person records`);

    // Step 5: Reset auto-increment counters
    console.log('🔄 Step 4: Resetting ID counters...');
    await db.raw('ALTER TABLE persons AUTO_INCREMENT = 1');
    await db.raw('ALTER TABLE recognition_training_history AUTO_INCREMENT = 1');
    console.log('✅ Reset auto-increment counters');

    // Step 6: Final verification
    console.log('\n📊 Final database state:');
    const finalPersonCount = await db('persons').count('id as count').first();
    const finalAssignedFacesCount = await db('detected_faces').whereNotNull('person_id').count('id as count').first();
    const finalTotalFacesCount = await db('detected_faces').count('id as count').first();
    
    console.log(`   👥 Persons: ${finalPersonCount.count}`);
    console.log(`   🔗 Assigned faces: ${finalAssignedFacesCount.count}`);
    console.log(`   👤 Total faces: ${finalTotalFacesCount.count}`);
    
    console.log('\n🎉 Person assignment cleanup completed successfully!');
    console.log('💡 You can now start fresh with person assignments in the mobile app.');

  } catch (error) {
    console.error('💥 Error during cleanup:', error);
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