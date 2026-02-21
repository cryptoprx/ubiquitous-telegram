/**
 * Post-publish script — automatically updates the download portal
 * with the new version number and download URL after a successful build.
 *
 * Called at the end of `npm run publish`.
 * Reads PORTAL_API_KEY from .env file or system env.
 */
const fs = require('fs');
const path = require('path');

// Load .env file if present (no extra dependency needed)
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

const PORTAL_URL = 'https://flipdown-silk.vercel.app/api/update-version';
const GH_OWNER = 'cryptoprx';
const GH_REPO = 'ubiquitous-telegram';
const API_KEY = process.env.PORTAL_API_KEY;

if (!API_KEY) {
  console.warn('[Post-Publish] PORTAL_API_KEY not set in .env or environment — skipping portal update');
  console.warn('[Post-Publish] Create a .env file with PORTAL_API_KEY=your-key to enable auto-version sync');
  process.exit(0);
}

const GH_TOKEN = process.env.GH_TOKEN;
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
const version = pkg.version;
const downloadUrl = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download/v${version}/Flip-Browser-Setup-${version}.exe`;

async function publishDraftRelease() {
  if (!GH_TOKEN) {
    console.warn('[Post-Publish] GH_TOKEN not set — cannot auto-publish draft release');
    return;
  }
  console.log(`[Post-Publish] Checking for draft release v${version}…`);
  const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases`, {
    headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  const releases = await res.json();
  const draft = releases.find(r => r.tag_name === `v${version}` && r.draft);
  if (!draft) {
    console.log('[Post-Publish] No draft found — release is already published.');
    return;
  }
  console.log(`[Post-Publish] Publishing draft release #${draft.id}…`);
  const pub = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/${draft.id}`, {
    method: 'PATCH',
    headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft: false }),
  });
  if (!pub.ok) {
    const text = await pub.text();
    console.error(`[Post-Publish] Failed to publish release: ${pub.status} ${text}`);
    process.exit(1);
  }
  console.log('[Post-Publish] Release published — .exe is now publicly downloadable.');
}

async function updatePortal() {
  await publishDraftRelease();
  console.log(`[Post-Publish] Updating portal → v${version}`);
  console.log(`[Post-Publish] Download URL → ${downloadUrl}`);

  const resp = await fetch(PORTAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ version, downloadUrl }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    console.error(`[Post-Publish] Portal returned ${resp.status}: ${text}`);
    if (resp.status === 401) {
      console.error('[Post-Publish] API_KEY mismatch — make sure the same key is set in Vercel env vars (API_KEY) and local .env (PORTAL_API_KEY)');
    }
    process.exit(1);
  }

  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  console.log(`[Post-Publish] Portal updated — version: ${data.version || version}, url: ${data.downloadUrl || downloadUrl}`);
  console.log('[Post-Publish] Installer hosted on GitHub Releases — no manual upload needed.');
}

updatePortal().catch(err => {
  console.error('[Post-Publish] Failed:', err.message);
  process.exit(1);
});
