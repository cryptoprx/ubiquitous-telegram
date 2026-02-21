/**
 * Publish wrapper — loads .env, then runs the full publish pipeline.
 * Ensures GH_TOKEN is available for electron-builder's GitHub publish.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env into process.env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
}

if (!process.env.GH_TOKEN) {
  console.error('[Publish] GH_TOKEN not set in .env — cannot publish to GitHub Releases');
  console.error('[Publish] Add GH_TOKEN=your-token to .env (https://github.com/settings/tokens/new, repo scope)');
  process.exit(1);
}

const steps = [
  'npm version patch --no-git-tag-version',
  'node scripts/update-changelog.js',
  'node scripts/clean-build.js',
  'node scripts/generate-integrity.js',
  'npx vite build',
  'npx electron-builder --publish always',
  'node scripts/restore-output.js',
  'node scripts/post-publish.js',
];

for (const cmd of steps) {
  console.log(`\n[Publish] Running: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', env: process.env, cwd: path.join(__dirname, '..') });
  } catch (err) {
    console.error(`[Publish] Failed at: ${cmd}`);
    process.exit(1);
  }
}

console.log('\n[Publish] Done!');
