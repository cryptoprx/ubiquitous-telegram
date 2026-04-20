/**
 * Stamps the current package.json version + release notes into changelog.json.
 *
 * Usage (required — notes MUST always be provided):
 *   node scripts/update-changelog.js "Fix A" "Feature B" "Improvement C"
 *
 * If no notes are passed, the script exits with an error.
 * This prevents stale notes from being silently carried forward on every publish.
 *
 * Run after `npm version patch` so the version is already bumped.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const clPath  = path.join(__dirname, '..', 'changelog.json');

const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;

// Notes MUST be provided via CLI args — never carry forward silently
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('\n[Changelog] ❌  ERROR: No release notes provided.');
  console.error('[Changelog]    You must pass notes as arguments:');
  console.error('[Changelog]    node scripts/update-changelog.js "Note 1" "Note 2" ...\n');
  console.error('[Changelog]    Or update publish.js RELEASE_NOTES to include what shipped.\n');
  process.exit(1);
}

const notes = args;

let changelog = {};
if (fs.existsSync(clPath)) {
  changelog = JSON.parse(fs.readFileSync(clPath, 'utf-8'));
}

// Insert new version at the top
const updated = { [version]: notes };
for (const [k, v] of Object.entries(changelog)) {
  if (k !== version) updated[k] = v;
}

fs.writeFileSync(clPath, JSON.stringify(updated, null, 2) + '\n');
console.log(`[Changelog] v${version} → ${notes.length} notes`);
