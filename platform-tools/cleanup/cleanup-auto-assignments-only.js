#!/usr/bin/env node

/**
 * Surgical Auto-Assignment Cleanup Script
 * 
 * SAFELY removes only automatic face assignments while preserving all manual assignments.
 * This is the correct approach that should have been used for Margaret.
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
  const personName = process.argv[2];
  
  if (!personName) {
    console.log('Usage: node cleanup-auto-assignments-only.js <person_name>');
    console.log('Example: node cleanup-auto-assignments-only.js "Henry"');
    return;
  }

  console.log(`🔧 Surgical Auto-Assignment Cleanup for ${personName}\n`);

  try {
    // Step 1: Find the person
    const person = await db('persons').where('name', personName).first();
    if (!person) {
      console.log(`❌ Person "${personName}" not found in database`);
      return;
    }

    console.log(`📊 ${personName}'s current state:`);
    console.log(`   ID: ${person.id}`);
    console.log(`   Name: ${person.name}`);
    console.log(`   Face Count: ${person.face_count}`);
    console.log(`   CompreFace Subject: ${person.compreface_subject_id}`);
    
    // Get assignment breakdown
    const assignmentStats = await db('detected_faces')
      .select('assigned_by')
      .count('* as count')
      .where('person_id', person.id)
      .groupBy('assigned_by');
    
    console.log(`\n📋 Assignment breakdown:`);
    let manualCount = 0;
    let autoCount = 0;
    
    for (const stat of assignmentStats) {
      console.log(`   ${stat.assigned_by || 'null'}: ${stat.count} faces`);
      if (stat.assigned_by === 'user') {
        manualCount = stat.count;
      } else if (stat.assigned_by === 'auto_recognition') {
        autoCount = stat.count;
      }
    }

    if (autoCount === 0) {
      console.log(`\n✅ No automatic assignments found for ${personName}. Nothing to clean up!`);
      return;
    }

    console.log(`\n⚠️  This will:`);
    console.log(`   ✅ KEEP ${manualCount} manually assigned faces`);
    console.log(`   ❌ REMOVE ${autoCount} auto-assigned faces`);
    console.log(`   📁 Keep all face detection records and crop files`);
    console.log(`   🧠 Reset CompreFace sync status for removed faces only\n`);
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const proceed = await new Promise(resolve => {
      rl.question(`Continue with surgical cleanup of ${personName}? (yes/no): `, answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
    
    if (!proceed) {
      console.log('❌ Cancelled by user');
      return;
    }

    // Step 2: Remove ONLY auto-assigned faces (preserve manual assignments)
    console.log(`🔄 Removing auto-assigned faces for ${personName}...`);
    const clearedFaces = await db('detected_faces')
      .where('person_id', person.id)
      .where('assigned_by', 'auto_recognition')  // ONLY remove auto-assigned
      .update({
        person_id: null,
        person_confidence: null,
        assigned_at: null,
        assigned_by: null,
        compreface_synced: false,
        compreface_uploaded_at: null,
        is_training_image: false
      });
    
    console.log(`✅ Removed ${clearedFaces} auto-assigned faces`);

    // Step 3: Update person's face count (only count manual assignments now)
    const remainingFaces = await db('detected_faces')
      .where('person_id', person.id)
      .count('id as count')
      .first();
    
    console.log(`🔄 Updating ${personName}'s face count...`);
    await db('persons')
      .where('id', person.id)
      .update({
        face_count: remainingFaces.count
      });
    
    console.log(`✅ Updated face count to ${remainingFaces.count}`);

    // Step 4: Clear training history for auto-assigned faces only
    console.log('🔄 Clearing auto-assignment training history...');
    const deletedHistory = await db('recognition_training_history')
      .where('person_id', person.id)
      .where('notes', 'like', '%auto%')
      .del();
    
    console.log(`✅ Cleared ${deletedHistory} auto-training history records`);

    // Step 5: Final verification
    console.log(`\n📊 ${personName}'s final state:`);
    const updatedPerson = await db('persons').where('id', person.id).first();
    const finalAssignments = await db('detected_faces')
      .select('assigned_by')
      .count('* as count')
      .where('person_id', person.id)
      .groupBy('assigned_by');
    
    console.log(`   Face Count: ${updatedPerson.face_count}`);
    console.log(`   Remaining assignments:`);
    for (const stat of finalAssignments) {
      console.log(`     ${stat.assigned_by || 'null'}: ${stat.count} faces`);
    }
    
    console.log(`\n🎉 Surgical cleanup completed successfully!`);
    console.log(`💡 ${personName} now has only manually verified faces and is ready for selective training.`);

  } catch (error) {
    console.error(`💥 Error during ${personName} cleanup:`, error);
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