#!/usr/bin/env node

/**
 * Production start script for Render
 * This ensures build runs before starting the server
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting production server...\n');

// Step 1: Run build
console.log('📦 Step 1/3: Building application...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed successfully!\n');
} catch (error) {
    console.error('❌ Build failed! Attempting to start with public/ folder...\n');
}

// Step 2: Verify dist exists
console.log('🔍 Step 2/3: Verifying build output...');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        console.log('✅ dist/ folder ready with index.html\n');
    } else {
        console.warn('⚠️  dist/ exists but index.html is missing!\n');
    }
} else {
    console.warn('⚠️  dist/ folder not found. Server will fallback to public/\n');
}

// Step 3: Start server
console.log('🌐 Step 3/3: Starting Node.js server...\n');
process.env.NODE_ENV = 'production';
require('./server.js');
