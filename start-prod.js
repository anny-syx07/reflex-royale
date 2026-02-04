#!/usr/bin/env node

/**
 * Production start script for Render with detailed diagnostics
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting production server with diagnostics...\n');

// Diagnostic: Check environment
console.log('📋 Environment Diagnostics:');
console.log(`   Node version: ${process.version}`);
console.log(`   Platform: ${process.platform}`);
console.log(`   Current directory: ${process.cwd()}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log('');

// Diagnostic: Check source folder
console.log('🔍 Checking source folder...');
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
    const publicFiles = fs.readdirSync(publicPath);
    console.log(`✅ public/ exists with ${publicFiles.length} items`);
} else {
    console.error('❌ ERROR: public/ folder does not exist!');
    console.error('   This should never happen. The source code is broken.');
    process.exit(1);
}
console.log('');

// Step 1: Run build
console.log('📦 Building application...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('\n✅ Build completed successfully!\n');
} catch (error) {
    console.error('\n❌ Build failed with error!');
    console.error('Error details:', error.message);
    console.error('\nAttempting to start with public/ folder as fallback...\n');
}

// Step 2: Verify dist exists
console.log('🔍 Verifying build output...');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    const distFiles = fs.readdirSync(distPath);
    console.log(`✅ dist/ folder exists with ${distFiles.length} items`);

    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        const indexSize = fs.statSync(indexPath).size;
        console.log(`✅ dist/index.html exists (${indexSize} bytes)`);
    } else {
        console.warn('⚠️  dist/index.html is missing!');
    }

    // Check assets
    const assetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(assetsPath)) {
        const audioPath = path.join(assetsPath, 'audio');
        if (fs.existsSync(audioPath)) {
            const audioFiles = fs.readdirSync(audioPath);
            console.log(`✅ dist/assets/audio/ exists with ${audioFiles.length} files`);
        } else {
            console.warn('⚠️  dist/assets/audio/ is missing!');
        }
    }
} else {
    console.warn('⚠️  dist/ folder not found!');
    console.warn('   Server will fallback to serving from public/');
    console.warn('   This means build failed. Check logs above for errors.');
}
console.log('');

// Step 3: Start server
console.log('🌐 Starting Node.js server...\n');
console.log('═'.repeat(60));
console.log('');

process.env.NODE_ENV = 'production';

// Import and run server
require('./server.js');
