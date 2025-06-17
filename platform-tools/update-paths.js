#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Update paths in all maintenance tools
const toolDirs = ['maintenance', 'cleanup', 'testing'];
const replacements = [
    // Update build paths to point to API service
    { from: /require\(['"]\.\.\/\.\.\/build\//g, to: "require('../../services/api/build/" },
    { from: /require\(['"]\.\.\/\.\.\/\.\.\/build\//g, to: "require('../../../services/api/build/" },
    
    // Update src paths for any direct imports
    { from: /require\(['"]\.\.\/\.\.\/src\//g, to: "require('../../services/api/src/" },
    { from: /require\(['"]\.\.\/\.\.\/\.\.\/src\//g, to: "require('../../../services/api/src/" },
    
    // Update root-level imports
    { from: /require\(['"]\.\.\/\.\.\/knexfile/g, to: "require('../../infrastructure/database/knexfile.platform" },
    { from: /require\(['"]\.\.\/\.\.\/\.\.\/knexfile/g, to: "require('../../../infrastructure/database/knexfile.platform" },
];

toolDirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) return;
    
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
    
    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        replacements.forEach(({ from, to }) => {
            if (from.test(content)) {
                content = content.replace(from, to);
                modified = true;
            }
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✅ Updated paths in ${dir}/${file}`);
        }
    });
});

console.log('🎉 Path updates complete!');