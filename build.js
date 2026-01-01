const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: terserMinify } = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC_DIR = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, 'dist');

// Obfuscation options for JavaScript
const obfuscatorOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 5,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// HTML minification options
const htmlMinifyOptions = {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: false // We'll obfuscate JS separately
};

// Track image hash mappings
const imageHashMap = new Map();

// Generate hash for filename
function generateHash(filename) {
    return crypto.createHash('md5').update(filename + Date.now()).digest('hex').substring(0, 8);
}

// Create dist directory
function ensureDistDir() {
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });
    ['css', 'js', 'assets'].forEach(subdir => {
        fs.mkdirSync(path.join(DIST_DIR, subdir), { recursive: true });
    });
}

// Convert image to base64
function imageToBase64(imagePath) {
    const data = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp'
    };
    const mime = mimeTypes[ext] || 'application/octet-stream';
    return `data:${mime};base64,${data.toString('base64')}`;
}

// Process and copy images with hashed names
function processImages() {
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];

    function processDir(srcDir, destDir, relativePath = '') {
        if (!fs.existsSync(srcDir)) return;
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const items = fs.readdirSync(srcDir);
        items.forEach(item => {
            const srcPath = path.join(srcDir, item);
            const stat = fs.statSync(srcPath);
            const ext = path.extname(item).toLowerCase();

            if (stat.isDirectory()) {
                processDir(srcPath, path.join(destDir, item), path.join(relativePath, item));
            } else if (extensions.includes(ext)) {
                const fileSize = stat.size;
                const originalRelPath = (relativePath ? relativePath + '/' : '') + item;

                // Small images (< 50KB) -> Base64 inline
                if (fileSize < 50000) {
                    const base64 = imageToBase64(srcPath);
                    imageHashMap.set('/' + originalRelPath, base64);
                    console.log(`📦 Inlined (base64): ${item} (${(fileSize / 1024).toFixed(1)}KB)`);
                } else {
                    // Large images -> Copy with hashed name
                    const hash = generateHash(item);
                    const hashedName = hash + ext;
                    const destPath = path.join(DIST_DIR, 'assets', hashedName);
                    fs.copyFileSync(srcPath, destPath);
                    imageHashMap.set('/' + originalRelPath, '/assets/' + hashedName);
                    console.log(`📦 Hashed: ${item} → ${hashedName}`);
                }
            }
        });
    }

    processDir(SRC_DIR, DIST_DIR);
}

// Replace image paths in content
function replaceImagePaths(content) {
    let result = content;
    imageHashMap.forEach((newPath, originalPath) => {
        // Replace various formats of the path
        const escapedPath = originalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedPath, 'g');
        result = result.replace(regex, newPath);

        // Also try without leading slash
        const noSlashPath = originalPath.substring(1);
        const escapedNoSlash = noSlashPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexNoSlash = new RegExp(`(['"])${escapedNoSlash}(['"])`, 'g');
        result = result.replace(regexNoSlash, `$1${newPath}$2`);
    });
    return result;
}

// Obfuscate inline JavaScript in HTML
function obfuscateInlineJS(html) {
    // Match script tags with inline JS
    const scriptRegex = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi;

    return html.replace(scriptRegex, (match, jsContent) => {
        if (!jsContent.trim()) return match;

        try {
            const obfuscated = JavaScriptObfuscator.obfuscate(jsContent, {
                ...obfuscatorOptions,
                selfDefending: false,
                debugProtection: false
            });
            return `<script>${obfuscated.getObfuscatedCode()}</script>`;
        } catch (err) {
            console.warn(`⚠️  Could not obfuscate inline JS: ${err.message}`);
            return match;
        }
    });
}

// Minify and obfuscate HTML files
async function processHtmlFiles() {
    const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.html'));

    for (const file of files) {
        const srcPath = path.join(SRC_DIR, file);
        const destPath = path.join(DIST_DIR, file);
        let content = fs.readFileSync(srcPath, 'utf8');

        try {
            // 1. Replace image paths
            content = replaceImagePaths(content);

            // 2. Obfuscate inline JavaScript
            content = obfuscateInlineJS(content);

            // 3. Minify HTML
            const minified = await minify(content, htmlMinifyOptions);

            fs.writeFileSync(destPath, minified);

            const originalSize = Buffer.byteLength(fs.readFileSync(srcPath), 'utf8');
            const finalSize = Buffer.byteLength(minified, 'utf8');
            console.log(`✅ ${file}: ${originalSize} → ${finalSize} bytes (obfuscated)`);
        } catch (err) {
            console.error(`❌ Error processing ${file}:`, err.message);
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Obfuscate standalone CSS files
async function processCssFiles() {
    const cssDir = path.join(SRC_DIR, 'css');
    const destCssDir = path.join(DIST_DIR, 'css');

    if (!fs.existsSync(cssDir)) return;

    const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
    const cleanCSS = new CleanCSS({ level: 2 });

    for (const file of files) {
        const srcPath = path.join(cssDir, file);
        const destPath = path.join(destCssDir, file);
        let content = fs.readFileSync(srcPath, 'utf8');

        // Replace image paths in CSS
        content = replaceImagePaths(content);

        const result = cleanCSS.minify(content);
        if (result.errors.length === 0) {
            fs.writeFileSync(destPath, result.styles);
            console.log(`✅ css/${file}: minified`);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Obfuscate standalone JS files
async function processJsFiles() {
    const jsDir = path.join(SRC_DIR, 'js');
    const destJsDir = path.join(DIST_DIR, 'js');

    if (!fs.existsSync(jsDir)) return;

    const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
        const srcPath = path.join(jsDir, file);
        const destPath = path.join(destJsDir, file);
        const content = fs.readFileSync(srcPath, 'utf8');

        try {
            // Full obfuscation for standalone JS files
            const obfuscated = JavaScriptObfuscator.obfuscate(content, obfuscatorOptions);
            fs.writeFileSync(destPath, obfuscated.getObfuscatedCode());

            const originalSize = Buffer.byteLength(content, 'utf8');
            const finalSize = Buffer.byteLength(obfuscated.getObfuscatedCode(), 'utf8');
            console.log(`✅ js/${file}: ${originalSize} → ${finalSize} bytes (obfuscated)`);
        } catch (err) {
            console.error(`❌ Error obfuscating ${file}:`, err.message);
            // Fallback to simple minification
            try {
                const minified = await terserMinify(content, { compress: true, mangle: true });
                fs.writeFileSync(destPath, minified.code);
            } catch {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

// Main build function
async function build() {
    console.log('🔨 Building with ADVANCED OBFUSCATION...\n');

    ensureDistDir();

    console.log('📸 Processing images...');
    processImages();
    console.log('');

    console.log('📄 Processing HTML files...');
    await processHtmlFiles();
    console.log('');

    console.log('🎨 Processing CSS files...');
    await processCssFiles();
    console.log('');

    console.log('📦 Processing JS files...');
    await processJsFiles();
    console.log('');

    console.log('✨ Build complete! Code is now HEAVILY OBFUSCATED!');
    console.log('📁 Files are in dist/ folder');
}

build().catch(console.error);
