const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, 'dist');

// Create dist directory
function ensureDistDir() {
    console.log('🧹 Cleaning dist directory...');
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Recursively copy directory
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            console.log(`Copying ${entry.name}...`);
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Main build function - NUCLEAR OPTION
async function build() {
    console.log('☢️ NUCLEAR OPTION ENABLED: Simple Copy Build...\n');

    ensureDistDir();

    console.log('📂 Copying public -> dist...');
    copyDir(SRC_DIR, DIST_DIR);

    console.log('');
    console.log('✅ Build complete! Files copied directly without processing.');
    console.log('Files are in dist/ folder');
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});
