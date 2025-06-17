#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test files
const testFiles = glob.sync('**/*.{test,spec}.ts', { 
  cwd: __dirname,
  absolute: true 
});

const replacements = [
  // Update relative imports from src
  { from: /from ['"]\.\.\/\.\.\/src\//g, to: "from '../../services/api/src/" },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/src\//g, to: "from '../../../services/api/src/" },
  
  // Update @/ imports
  { from: /from ['"]@\//g, to: "from '@api/" },
  
  // Update specific test helper imports remain unchanged
];

let totalUpdated = 0;

testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  replacements.forEach(({ from, to }) => {
    if (from.test(content)) {
      content = content.replace(from, to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`✅ Updated imports in ${path.relative(__dirname, file)}`);
    totalUpdated++;
  }
});

console.log(`\n🎉 Updated ${totalUpdated} test files!`);