// Script to copy IronBridge binary to extension bin folder
const fs = require('fs');
const path = require('path');

const binDir = path.join(__dirname, '..', 'bin');
const rustTargetDir = path.join(__dirname, '..', '..', 'ironbridge-rust', 'target', 'release');

// Create bin directory if it doesn't exist
if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
}

// Determine platform-specific binary
const platform = process.platform;
let sourceName, destName;

switch (platform) {
    case 'win32':
        sourceName = 'ironbridge.exe';
        destName = 'ironbridge.exe';
        break;
    case 'darwin':
        sourceName = 'ironbridge';
        destName = 'ironbridge-darwin';
        break;
    default:
        sourceName = 'ironbridge';
        destName = 'ironbridge-linux';
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
    console.warn('Please build the Rust binary first: cd ironbridge-rust && cargo build --release');
}
