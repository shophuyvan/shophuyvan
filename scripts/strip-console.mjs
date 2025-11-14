#!/usr/bin/env node
// ===================================================================
// strip-console.mjs - Remove console.* for production
// Usage: npm run build:prod
// ===================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Config
const config = {
  // Directories to process
  dirs: [
    'apps/admin',
    'apps/fe/src',
    'workers/shv-api/src'
  ],
  
  // Exclude patterns
  exclude: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.wrangler',
    '_shared/security.js', // ✅ Keep security.js console logs
    'admin_real.js' // Keep admin helper logs
  ],
  
  // File extensions
  extensions: ['.js', '.ts', '.jsx', '.tsx'],
  
  // Backup before strip
  backup: true
};

const consoleRegex = /console\.(log|debug|info|warn|error|table|trace|dir|group|groupEnd|time|timeEnd)\s*\([^)]*\);?/g;

let stats = {
  filesProcessed: 0,
  consoleRemoved: 0,
  errors: []
};

function shouldExclude(filePath) {
  return config.exclude.some(pattern => filePath.includes(pattern));
}

function stripConsoleFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(consoleRegex);
    
    if (!matches || matches.length === 0) return;

    // Backup original
    if (config.backup) {
      const backupPath = filePath + '.backup';
      fs.writeFileSync(backupPath, content, 'utf8');
    }

    // Strip console
    const newContent = content.replace(consoleRegex, '/* console removed */');
    fs.writeFileSync(filePath, newContent, 'utf8');

    const removed = matches.length;
    stats.filesProcessed++;
    stats.consoleRemoved += removed;

    console.log(`  ✅ ${path.relative(rootDir, filePath)}: ${removed} removed`);
  } catch (err) {
    stats.errors.push({ file: filePath, error: err.message });
    console.error(`  ❌ ${path.relative(rootDir, filePath)}: ${err.message}`);
  }
}

function processDirectory(dir) {
  const fullPath = path.join(rootDir, dir);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  Directory not found: ${dir}`);
    return;
  }

  console.log(`\n📂 Processing: ${dir}`);

  function walk(currentPath) {
    const files = fs.readdirSync(currentPath, { withFileTypes: true });

    files.forEach(file => {
      const filePath = path.join(currentPath, file.name);

      if (shouldExclude(filePath)) return;

      if (file.isDirectory()) {
        walk(filePath);
      } else if (config.extensions.some(ext => file.name.endsWith(ext))) {
        stripConsoleFromFile(filePath);
      }
    });
  }

  walk(fullPath);
}

function restoreBackups() {
  console.log('\n🔄 Restoring backups...');
  
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    files.forEach(file => {
      const filePath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        walk(filePath);
      } else if (file.name.endsWith('.backup')) {
        const originalPath = filePath.replace('.backup', '');
        fs.copyFileSync(filePath, originalPath);
        fs.unlinkSync(filePath);
        console.log(`  ✅ Restored: ${path.relative(rootDir, originalPath)}`);
      }
    });
  }

  config.dirs.forEach(dir => walk(path.join(rootDir, dir)));
  console.log('✅ All backups restored!');
}

function cleanBackups() {
  console.log('\n🧹 Cleaning backups...');
  
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    files.forEach(file => {
      const filePath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        walk(filePath);
      } else if (file.name.endsWith('.backup')) {
        fs.unlinkSync(filePath);
      }
    });
  }

  config.dirs.forEach(dir => walk(path.join(rootDir, dir)));
  console.log('✅ Backups cleaned!');
}

// Main execution
console.log('🚀 Starting Production Build - Strip Console\n');
console.log('📋 Configuration:');
console.log(`   - Backup: ${config.backup ? 'YES' : 'NO'}`);
console.log(`   - Directories: ${config.dirs.length}`);
console.log(`   - Exclude: ${config.exclude.length} patterns\n`);

// Check command
const command = process.argv[2];

if (command === 'restore') {
  restoreBackups();
  process.exit(0);
}

if (command === 'clean') {
  cleanBackups();
  process.exit(0);
}

// Strip console
config.dirs.forEach(processDirectory);

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Summary:');
console.log(`   ✅ Files processed: ${stats.filesProcessed}`);
console.log(`   🗑️  Console removed: ${stats.consoleRemoved}`);
console.log(`   ❌ Errors: ${stats.errors.length}`);

if (stats.errors.length > 0) {
  console.log('\n⚠️  Errors:');
  stats.errors.forEach(({ file, error }) => {
    console.log(`   - ${path.relative(rootDir, file)}: ${error}`);
  });
}

console.log('='.repeat(60));
console.log('\n💡 Commands:');
console.log('   - Restore backups: npm run restore-console');
console.log('   - Clean backups: npm run clean-console');
console.log('\n✅ Production build ready!\n');