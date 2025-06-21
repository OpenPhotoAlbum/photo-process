#!/usr/bin/env node

const fs = require('fs');

console.log('🔧 Fixing path construction in running code...');

// Read the current file
const filePath = '/app/build/util/compreface-training.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original file size:', content.length);

// Find and replace the problematic line
const oldPattern = /\.map\(face => `\$\{processedDir\}\/\$\{face\.face_image_path\}`\)/g;
const newPattern = `.map(face => {
                const facePath = face.relative_face_path || face.face_image_path;
                return facePath?.startsWith('/') ? facePath : \`\${processedDir}/faces/\${facePath}\`;
            })`;

if (content.match(oldPattern)) {
    content = content.replace(oldPattern, newPattern);
    console.log('✅ Found and replaced old pattern');
} else {
    console.log('❌ Old pattern not found, trying alternative...');
    
    // Look for the filter and map pattern
    const altPattern = /\.filter\(face => face\.face_image_path\)\s*\.map\(face => `\$\{processedDir\}\/\$\{face\.face_image_path\}`\)/g;
    const altNewPattern = `.filter(face => face.relative_face_path || face.face_image_path)
                .map(face => {
                    const facePath = face.relative_face_path || face.face_image_path;
                    if (!facePath) return null;
                    return facePath.startsWith('/') ? facePath : \`\${processedDir}/faces/\${facePath}\`;
                })
                .filter(path => path !== null)`;
    
    if (content.match(altPattern)) {
        content = content.replace(altPattern, altNewPattern);
        console.log('✅ Found and replaced alternative pattern');
    } else {
        console.log('❌ No matching patterns found');
    }
}

// Write the fixed file
fs.writeFileSync(filePath, content);
console.log('✅ File updated successfully');
console.log('New file size:', content.length);