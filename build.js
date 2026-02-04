const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, 'dist');

// Create dist directory
function ensureDistDir() {
    try {
        console.log('🧹 Cleaning dist directory...');
        if (fs.existsSync(DIST_DIR)) {
            fs.rmSync(DIST_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(DIST_DIR, { recursive: true });
        console.log('✅ Dist directory created successfully');
    } catch (error) {
        console.error('❌ ERROR creating dist directory:', error);
        throw error;
    }
}

// Recursively copy directory
function copyDir(src, dest) {
    try {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                console.log(`📁 Copying directory: ${entry.name}/`);
                copyDir(srcPath, destPath);
            } else {
                console.log(`📄 Copying file: ${entry.name}`);
                fs.copyFileSync(srcPath, destPath);
            }
        }
    } catch (error) {
        console.error(`❌ ERROR copying from ${src} to ${dest}:`, error);
        throw error;
    }
}

// Verify build output
function verifyBuild() {
    console.log('\n🔍 Verifying build output...');

    // Check if dist directory exists
    if (!fs.existsSync(DIST_DIR)) {
        throw new Error('dist/ directory does not exist after build!');
    }

    // Check if index.html exists
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) {
        throw new Error('dist/index.html does not exist after build!');
    }

    // Check if assets directory exists
    const assetsPath = path.join(DIST_DIR, 'assets');
    if (!fs.existsSync(assetsPath)) {
        console.warn('⚠️  WARNING: dist/assets/ directory does not exist');
    } else {
        // Check for audio files
        const audioPath = path.join(assetsPath, 'audio');
        if (fs.existsSync(audioPath)) {
            const audioFiles = fs.readdirSync(audioPath);
            console.log(`✅ Audio directory found with ${audioFiles.length} files`);
        }
    }

    // Count total files
    let fileCount = 0;
    function countFiles(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                countFiles(path.join(dir, entry.name));
            } else {
                fileCount++;
            }
        }
    }
    countFiles(DIST_DIR);

    console.log(`✅ Build verified! Total files: ${fileCount}`);
}

// Main build function - NUCLEAR OPTION
async function build() {
    console.log('☢️ NUCLEAR OPTION ENABLED: Simple Copy Build...\n');

    // Verify source directory exists
    if (!fs.existsSync(SRC_DIR)) {
        throw new Error(`Source directory ${SRC_DIR} does not exist!`);
    }

    ensureDistDir();

    console.log('📂 Copying public -> dist...\n');
    copyDir(SRC_DIR, DIST_DIR);

    console.log('\n✅ Copy complete!');

    // Verify build
    verifyBuild();

    console.log('\n🎉 Build successful! Files are in dist/ folder');
}

// Run build with error handling
build().catch(err => {
    console.error('\n❌ BUILD FAILED:');
    console.error(err);
    console.error('\nStack trace:');
    console.error(err.stack);
    process.exit(1);
});
