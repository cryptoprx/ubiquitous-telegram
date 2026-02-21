/**
 * Auto-stamps the current package.json version into changelog.json.
 *
 * Usage:
 *   node scripts/update-changelog.js                     → carries forward latest notes
 *   node scripts/update-changelog.js "Fix A" "Feature B" → sets new notes for this version
 *
 * Run after `npm version patch` so the version is already bumped.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const clPath = path.join(__dirname, '..', 'changelog.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;

let changelog = {};
if (fs.existsSync(clPath)) {
  changelog = JSON.parse(fs.readFileSync(clPath, 'utf-8'));
}

// Check if notes were passed as CLI args
const args = process.argv.slice(2);
let notes;

if (args.length > 0) {
  // New notes provided via CLI — use them
  notes = args;
} else {
  // No args — carry forward the latest entry's notes
  const versions = Object.keys(changelog);
  notes = versions.length > 0 ? changelog[versions[0]] : ['Bug fixes and improvements'];
}

// Insert new version at the top (rebuild object with new key first)
const updated = { [version]: notes };
for (const [k, v] of Object.entries(changelog)) {
  if (k !== version) updated[k] = v;
}

fs.writeFileSync(clPath, JSON.stringify(updated, null, 2) + '\n');
console.log(`[Changelog] v${version} → ${notes.length} notes`);
