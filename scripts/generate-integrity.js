const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Critical files to hash
const CRITICAL_FILES = [
  'electron/main.js',
  'electron/preload.js',
];

// Also hash all extension manifests
const extensionsDir = path.join(ROOT, 'extensions');
if (fs.existsSync(extensionsDir)) {
  const dirs = fs.readdirSync(extensionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  for (const dir of dirs) {
    const manifestPath = path.join('extensions', dir, 'manifest.json');
    if (fs.existsSync(path.join(ROOT, manifestPath))) {
      CRITICAL_FILES.push(manifestPath);
    }
  }
}

// Generate SHA-256 hashes
const hashes = {};
for (const relPath of CRITICAL_FILES) {
  const fullPath = path.join(ROOT, relPath);
  const content = fs.readFileSync(fullPath);
  hashes[relPath] = crypto.createHash('sha256').update(content).digest('hex');
}

// Write integrity file next to main.js so it's bundled in asar
const outPath = path.join(ROOT, 'electron', 'integrity.json');
fs.writeFileSync(outPath, JSON.stringify(hashes, null, 2));

console.log(`[Integrity] Generated hashes for ${Object.keys(hashes).length} files → electron/integrity.json`);
