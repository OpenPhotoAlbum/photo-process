#!/usr/bin/env node

const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🧹 PHOTO PROCESSING CLEANUP MENU 🧹');
console.log('=====================================\n');

console.log('Select cleanup option:\n');
console.log('1. Full Cleanup (Database + CompreFace + Files)');
console.log('2. Local Data Only (Database + Files)');
console.log('3. CompreFace Only');
console.log('4. Database Only');
console.log('5. Processed Files Only');
console.log('6. Exit\n');

rl.question('Enter your choice (1-6): ', (answer) => {
    console.log('');
    
    let command = null;
    let args = [];
    
    switch(answer.trim()) {
        case '1':
            console.log('🚀 Running full cleanup...\n');
            command = 'node';
            args = [path.join(__dirname, 'cleanup-fresh-start.js')];
            break;
            
        case '2':
            console.log('🚀 Running local data cleanup...\n');
            command = 'node';
            args = [path.join(__dirname, 'cleanup-local-data.js')];
            break;
            
        case '3':
            console.log('🚀 Running CompreFace cleanup...\n');
            command = 'node';
            args = [path.join(__dirname, 'cleanup-compreface.js')];
            break;
            
        case '4':
            console.log('🚀 Running database cleanup only...\n');
            command = 'node';
            args = [path.join(__dirname, 'cleanup-fresh-start.js'), '--keep-compreface', '--keep-processed'];
            break;
            
        case '5':
            console.log('🚀 Running processed files cleanup only...\n');
            command = 'node';
            args = [path.join(__dirname, 'cleanup-fresh-start.js'), '--keep-compreface', '--keep-db'];
            break;
            
        case '6':
            console.log('👋 Exiting cleanup menu.');
            rl.close();
            return;
            
        default:
            console.log('❌ Invalid choice. Please run the script again.');
            rl.close();
            return;
    }
    
    if (command) {
        const child = spawn(command, args, { stdio: 'inherit' });
        
        child.on('exit', (code) => {
            if (code === 0) {
                console.log('\n✅ Cleanup completed successfully!');
            } else {
                console.log('\n❌ Cleanup failed with exit code:', code);
            }
            rl.close();
        });
        
        child.on('error', (error) => {
            console.error('\n❌ Error running cleanup:', error);
            rl.close();
        });
    }
});