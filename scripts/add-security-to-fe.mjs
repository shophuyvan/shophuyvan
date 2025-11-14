#!/usr/bin/env node
// ===================================================================
// add-security-to-fe.mjs - Auto inject security.js to all FE HTML
// Usage: node scripts/add-security-to-fe.mjs
// ===================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Config
const config = {
  // Target directory
  targetDir: 'apps/fe',
  
  // Security script path (relative to HTML files)
  securityScript: './assets/security.js',
  
  // Exclude patterns
  exclude: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.wrangler',
    'functions' // Cloudflare Pages functions
  ],
  
  // Backup before modify
  backup: true,
  
  // Dry run (test without actually modifying files)
  dryRun: false
};

let stats = {
  filesScanned: 0,
  filesModified: 0,
  filesSkipped: 0,
  errors: []
};

function shouldExclude(filePath) {
  return config.exclude.some(pattern => filePath.includes(pattern));
}

function hasSecurityScript(content) {
  return content.includes('security.js') || 
         content.includes('_shared/security.js') ||
         content.includes('assets/security.js');
}

function injectSecurityScript(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already has security script
    if (hasSecurityScript(content)) {
      console.log(`  ⏭️  ${path.relative(rootDir, filePath)}: Already has security script`);
      stats.filesSkipped++;
      return;
    }

    // Find </body> tag
    const bodyCloseTag = '</body>';
    if (!content.includes(bodyCloseTag)) {
      console.log(`  ⚠️  ${path.relative(rootDir, filePath)}: No </body> tag found`);
      stats.filesSkipped++;
      return;
    }

    // Backup original
    if (config.backup && !config.dryRun) {
      const backupPath = filePath + '.backup';
      fs.writeFileSync(backupPath, content, 'utf8');
    }

    // Inject security script before </body>
    const securityScriptTag = `  <script src="${config.securityScript}"></script>\n`;
    const newContent = content.replace(bodyCloseTag, securityScriptTag + bodyCloseTag);

    // Write modified content
    if (!config.dryRun) {
      fs.writeFileSync(filePath, newContent, 'utf8');
    }

    console.log(`  ✅ ${path.relative(rootDir, filePath)}: Security script added`);
    stats.filesModified++;
  } catch (err) {
    stats.errors.push({ file: filePath, error: err.message });
    console.error(`  ❌ ${path.relative(rootDir, filePath)}: ${err.message}`);
  }
}

function processDirectory(dir) {
  const fullPath = path.join(rootDir, dir);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Directory not found: ${dir}`);
    process.exit(1);
  }

  console.log(`\n📂 Processing: ${dir}`);

  function walk(currentPath) {
    const files = fs.readdirSync(currentPath, { withFileTypes: true });

    files.forEach(file => {
      const filePath = path.join(currentPath, file.name);

      if (shouldExclude(filePath)) return;

      if (file.isDirectory()) {
        walk(filePath);
      } else if (file.name.endsWith('.html')) {
        stats.filesScanned++;
        injectSecurityScript(filePath);
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
      } else if (file.name.endsWith('.html.backup')) {
        const originalPath = filePath.replace('.backup', '');
        fs.copyFileSync(filePath, originalPath);
        fs.unlinkSync(filePath);
        console.log(`  ✅ Restored: ${path.relative(rootDir, originalPath)}`);
      }
    });
  }

  walk(path.join(rootDir, config.targetDir));
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
      } else if (file.name.endsWith('.html.backup')) {
        fs.unlinkSync(filePath);
        console.log(`  🗑️  Deleted: ${path.relative(rootDir, filePath)}`);
      }
    });
  }

  walk(path.join(rootDir, config.targetDir));
  console.log('✅ Backups cleaned!');
}

function copySecurityFile() {
  const sourcePath = path.join(rootDir, 'apps/admin/_shared/security.js');
  const targetPath = path.join(rootDir, 'apps/fe/assets/security.js');
  
  // Check if source exists (nếu cần copy từ admin)
  // Hoặc dùng file mới đã tạo riêng cho FE
  
  console.log('\n📋 Note: Make sure security.js exists at apps/fe/assets/security.js');
  console.log('   You can create it manually or copy from admin version\n');
}

// Main execution
console.log('🚀 Starting Auto-Inject Security Script\n');
console.log('📋 Configuration:');
console.log(`   - Target: ${config.targetDir}`);
console.log(`   - Script: ${config.securityScript}`);
console.log(`   - Backup: ${config.backup ? 'YES' : 'NO'}`);
console.log(`   - Dry Run: ${config.dryRun ? 'YES' : 'NO'}`);
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

if (command === 'dry-run') {
  config.dryRun = true;
  console.log('🔍 DRY RUN MODE - No files will be modified\n');
}

// Check if security.js exists
const securityPath = path.join(rootDir, config.targetDir, 'assets/security.js');
if (!fs.existsSync(securityPath)) {
  console.error('❌ ERROR: Security file not found at:', securityPath);
  console.error('   Please create apps/fe/assets/security.js first!');
  process.exit(1);
}

// Process files
processDirectory(config.targetDir);

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Summary:');
console.log(`   📄 Files scanned: ${stats.filesScanned}`);
console.log(`   ✅ Files modified: ${stats.filesModified}`);
console.log(`   ⏭️  Files skipped: ${stats.filesSkipped}`);
console.log(`   ❌ Errors: ${stats.errors.length}`);

if (stats.errors.length > 0) {
  console.log('\n⚠️  Errors:');
  stats.errors.forEach(({ file, error }) => {
    console.log(`   - ${path.relative(rootDir, file)}: ${error}`);
  });
}

console.log('='.repeat(60));

if (!config.dryRun) {
  console.log('\n💡 Commands:');
  console.log('   - Restore backups: node scripts/add-security-to-fe.mjs restore');
  console.log('   - Clean backups: node scripts/add-security-to-fe.mjs clean');
  console.log('   - Test first: node scripts/add-security-to-fe.mjs dry-run');
  console.log('\n✅ Security script injection complete!\n');
} else {
  console.log('\n💡 This was a DRY RUN. Run without dry-run to apply changes.\n');
}
