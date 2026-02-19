// Script to copy Chasm binary to extension bin folder
const fs = require('fs');
const path = require('path');

const binDir = path.join(__dirname, '..', 'bin');
const rustTargetDir = path.join(__dirname, '..', '..', 'chasm-rust', 'target', 'release');

// Create bin directory if it doesn't exist
if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
}

// Determine platform-specific binary
const platform = process.platform;
let sourceName, destName;

switch (platform) {
    case 'win32':
        sourceName = 'chasm.exe';
        destName = 'chasm.exe';
        break;
    case 'darwin':
        sourceName = 'chasm';
        destName = 'chasm-darwin';
        break;
    default:
        sourceName = 'chasm';
        destName = 'chasm-linux';
}

const sourcePath = path.join(rustTargetDir, sourceName);
const destPath = path.join(binDir, destName);

if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${sourcePath} to ${destPath}`);

    // Make executable on Unix platforms
    if (platform !== 'win32') {
        fs.chmodSync(destPath, 0o755);
    }
} else {
    console.warn(`Warning: Binary not found at ${sourcePath}`);
    console.warn('Please build the Rust binary first: cd chasm-rust && cargo build --release');
}
