const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: terserMinify } = require('terser');

const SRC_DIR = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, 'dist');

// Minification options
const htmlMinifyOptions = {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: {
        compress: {
            drop_console: false // Keep console for debugging
        },
        mangle: true
    }
};

// Create dist directory
function ensureDistDir() {
    if (!fs.existsSync(DIST_DIR)) {
        fs.mkdirSync(DIST_DIR, { recursive: true });
    }
    // Create subdirectories
    ['css', 'js'].forEach(subdir => {
        const dir = path.join(DIST_DIR, subdir);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// Copy non-minifiable files (images, etc.)
function copyAssets() {
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'];

    function copyRecursive(srcDir, destDir) {
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const items = fs.readdirSync(srcDir);
        items.forEach(item => {
            const srcPath = path.join(srcDir, item);
            const destPath = path.join(destDir, item);
            const stat = fs.statSync(srcPath);

            if (stat.isDirectory()) {
                copyRecursive(srcPath, destPath);
            } else if (extensions.includes(path.extname(item).toLowerCase())) {
                fs.copyFileSync(srcPath, destPath);
                console.log(`📦 Copied: ${item}`);
            }
        });
    }

    copyRecursive(SRC_DIR, DIST_DIR);
}

// Minify HTML files
async function minifyHtmlFiles() {
    const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.html'));

    for (const file of files) {
        const srcPath = path.join(SRC_DIR, file);
        const destPath = path.join(DIST_DIR, file);
        const content = fs.readFileSync(srcPath, 'utf8');

        try {
            const minified = await minify(content, htmlMinifyOptions);
            fs.writeFileSync(destPath, minified);

            const originalSize = Buffer.byteLength(content, 'utf8');
            const minifiedSize = Buffer.byteLength(minified, 'utf8');
            const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

            console.log(`✅ ${file}: ${originalSize} → ${minifiedSize} bytes (${reduction}% smaller)`);
        } catch (err) {
            console.error(`❌ Error minifying ${file}:`, err.message);
            // Copy original if minification fails
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Minify standalone CSS files
async function minifyCssFiles() {
    const cssDir = path.join(SRC_DIR, 'css');
    const destCssDir = path.join(DIST_DIR, 'css');

    if (!fs.existsSync(cssDir)) return;

    const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
    const cleanCSS = new CleanCSS({ level: 2 });

    for (const file of files) {
        const srcPath = path.join(cssDir, file);
        const destPath = path.join(destCssDir, file);
        const content = fs.readFileSync(srcPath, 'utf8');

        const result = cleanCSS.minify(content);
        if (result.errors.length === 0) {
            fs.writeFileSync(destPath, result.styles);
            console.log(`✅ css/${file}: minified`);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Minify standalone JS files
async function minifyJsFiles() {
    const jsDir = path.join(SRC_DIR, 'js');
    const destJsDir = path.join(DIST_DIR, 'js');

    if (!fs.existsSync(jsDir)) return;

    const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
        const srcPath = path.join(jsDir, file);
        const destPath = path.join(destJsDir, file);
        const content = fs.readFileSync(srcPath, 'utf8');

        try {
            const result = await terserMinify(content, {
                compress: true,
                mangle: true
            });
            fs.writeFileSync(destPath, result.code);
            console.log(`✅ js/${file}: minified`);
        } catch (err) {
            console.error(`❌ Error minifying ${file}:`, err.message);
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Main build function
async function build() {
    console.log('🔨 Building production files...\n');

    ensureDistDir();
    copyAssets();
    await minifyHtmlFiles();
    await minifyCssFiles();
    await minifyJsFiles();

    console.log('\n✨ Build complete! Files are in dist/ folder');
}

build().catch(console.error);
