// Downloads and parses ABP/uBlock filter lists, matches network requests,
// supports per-site whitelisting, and auto-updates weekly.

const { net } = require('electron');
const path = require('path');
const fs = require('fs');

// Filter list sources
const FILTER_LISTS = [
  { id: 'easylist', name: 'EasyList', url: 'https://easylist.to/easylist/easylist.txt' },
  { id: 'easyprivacy', name: 'EasyPrivacy', url: 'https://easylist.to/easylist/easyprivacy.txt' },
  { id: 'peter-lowe', name: "Peter Lowe's Ad List", url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext' },
];

const UPDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

let dataDir = null;
let blockedDomains = new Set();
let blockedPatterns = []; // { regex, isException, domains, thirdParty }
let whitelistedSites = new Set(); // per-site whitelist
let cosmeticRules = []; // element hiding rules (domain -> selectors)
let initialized = false;
let stats = { totalFilters: 0, lastUpdate: null, listsLoaded: [] };

function setDataDir(dir) {
  dataDir = dir;
}

function getFilterDir() {
  const d = path.join(dataDir, 'filter-lists');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function getWhitelistFile() {
  return path.join(dataDir, 'adblock-whitelist.json');
}


async function initialize() {
  if (initialized) return;

  // Load whitelist
  try {
    const wl = JSON.parse(fs.readFileSync(getWhitelistFile(), 'utf-8'));
    whitelistedSites = new Set(wl);
  } catch {}

  // Try to load cached filter lists first (instant startup)
  const filterDir = getFilterDir();
  let loadedAny = false;
  for (const list of FILTER_LISTS) {
    const cached = path.join(filterDir, list.id + '.txt');
    if (fs.existsSync(cached)) {
      const content = fs.readFileSync(cached, 'utf-8');
      parseFilterList(content, list.id);
      stats.listsLoaded.push(list.id);
      loadedAny = true;
    }
  }

  initialized = true;

  // Check if update needed (async, non-blocking)
  const metaFile = path.join(filterDir, 'meta.json');
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')); } catch {}

  const now = Date.now();
  const lastUpdate = meta.lastUpdate || 0;
  if (now - lastUpdate > UPDATE_INTERVAL_MS || !loadedAny) {
    updateFilterLists().catch(e => console.error('[AdBlock] Filter update failed:', e.message));
  }
}


async function updateFilterLists() {
  const filterDir = getFilterDir();
  console.log('[AdBlock] Updating filter lists...');

  for (const list of FILTER_LISTS) {
    try {
      const content = await downloadList(list.url);
      if (content && content.length > 100) {
        fs.writeFileSync(path.join(filterDir, list.id + '.txt'), content);
        parseFilterList(content, list.id);
        if (!stats.listsLoaded.includes(list.id)) stats.listsLoaded.push(list.id);
        console.log(`[AdBlock] Updated ${list.name}: ${content.split('\n').length} lines`);
      }
    } catch (e) {
      console.error(`[AdBlock] Failed to update ${list.name}:`, e.message);
    }
  }

  // Save meta
  const metaFile = path.join(filterDir, 'meta.json');
  stats.lastUpdate = Date.now();
  fs.writeFileSync(metaFile, JSON.stringify({ lastUpdate: stats.lastUpdate }));
  console.log(`[AdBlock] Update complete. ${stats.totalFilters} total filters loaded.`);
}

function downloadList(url) {
  return new Promise((resolve, reject) => {
    try {
      const request = net.request(url);
      let body = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => { body += chunk.toString(); });
        response.on('end', () => resolve(body));
        response.on('error', reject);
      });
      request.on('error', reject);
      // Timeout after 30s
      setTimeout(() => reject(new Error('Timeout')), 30000);
      request.end();
    } catch (e) {
      reject(e);
    }
  });
}


function parseFilterList(content, listId) {
  const lines = content.split('\n');
  let count = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines, comments, headers
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;

    // Element hiding rules (##)
    if (line.includes('##') && !line.startsWith('@@')) {
      parseCosmeticRule(line);
      count++;
      continue;
    }

    // Network filter rules
    try {
      const rule = parseNetworkRule(line);
      if (rule) {
        if (rule.isDomain) {
          blockedDomains.add(rule.domain);
        } else {
          blockedPatterns.push(rule);
        }
        count++;
      }
    } catch {}
  }

  stats.totalFilters += count;
}

function parseNetworkRule(line) {
  let isException = false;
  let rule = line;

  // Exception rules (@@)
  if (rule.startsWith('@@')) {
    isException = true;
    rule = rule.slice(2);
  }

  // Extract options after $
  let options = {};
  const dollarIdx = rule.lastIndexOf('$');
  if (dollarIdx > 0 && dollarIdx < rule.length - 1) {
    const optStr = rule.slice(dollarIdx + 1);
    rule = rule.slice(0, dollarIdx);
    for (const opt of optStr.split(',')) {
      const trimOpt = opt.trim().toLowerCase();
      if (trimOpt === 'third-party') options.thirdParty = true;
      else if (trimOpt === '~third-party') options.thirdParty = false;
      else if (trimOpt.startsWith('domain=')) {
        options.domains = trimOpt.slice(7).split('|');
      }
      // Ignore type options for now (image, script, etc.)
    }
  }

  // Pure domain block: ||domain.com^
  const domainMatch = rule.match(/^\|\|([a-z0-9._-]+)\^?$/i);
  if (domainMatch && !isException) {
    return { isDomain: true, domain: domainMatch[1].toLowerCase() };
  }

  // Convert ABP pattern to regex
  const regex = abpPatternToRegex(rule);
  if (!regex) return null;

  return {
    isDomain: false,
    regex,
    isException,
    thirdParty: options.thirdParty,
    domains: options.domains,
  };
}

function abpPatternToRegex(pattern) {
  if (!pattern || pattern === '*') return null;

  let p = pattern;

  // Handle anchors
  let regexStr = p
    .replace(/[.+?{}()[\]\\]/g, '\\$&') // escape regex chars (except *)
    .replace(/\*/g, '.*')               // * → .*
    .replace(/\^/g, '([^a-zA-Z0-9_.%-]|$)'); // ^ → separator char

  // || at start = domain anchor
  if (regexStr.startsWith('\\|\\|')) {
    regexStr = '^https?://([a-z0-9-]+\\.)*' + regexStr.slice(4);
  } else if (regexStr.startsWith('\\|')) {
    regexStr = '^' + regexStr.slice(2);
  }

  // | at end = end anchor
  if (regexStr.endsWith('\\|')) {
    regexStr = regexStr.slice(0, -2) + '$';
  }

  try {
    return new RegExp(regexStr, 'i');
  } catch {
    return null;
  }
}

function parseCosmeticRule(line) {
  const idx = line.indexOf('##');
  if (idx < 0) return;
  const domains = idx > 0 ? line.slice(0, idx).split(',').map(d => d.trim().toLowerCase()) : ['*'];
  const selector = line.slice(idx + 2).trim();
  if (selector) {
    cosmeticRules.push({ domains, selector });
  }
}


function shouldBlock(url, documentUrl) {
  if (!initialized) return false;

  // Check per-site whitelist
  if (documentUrl) {
    try {
      const docHost = new URL(documentUrl).hostname.toLowerCase();
      if (whitelistedSites.has(docHost)) return false;
    } catch {}
  }

  const hostname = getHostname(url);
  if (!hostname) return false;

  // Check domain block list (fast path)
  if (isDomainBlocked(hostname)) return true;

  // Check pattern rules
  const urlLower = url.toLowerCase();
  let blocked = false;

  for (const rule of blockedPatterns) {
    if (!rule.regex) continue;

    // Skip third-party checks if specified
    if (rule.thirdParty !== undefined && documentUrl) {
      const docHost = getHostname(documentUrl);
      const isTP = hostname !== docHost && !hostname.endsWith('.' + docHost) && !docHost.endsWith('.' + hostname);
      if (rule.thirdParty && !isTP) continue;
      if (!rule.thirdParty && isTP) continue;
    }

    if (rule.regex.test(urlLower)) {
      if (rule.isException) return false; // exception rules take priority
      blocked = true;
    }
  }

  return blocked;
}

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isDomainBlocked(hostname) {
  if (blockedDomains.has(hostname)) return true;
  // Check subdomains
  const parts = hostname.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (blockedDomains.has(parent)) return true;
  }
  return false;
}


function getCosmeticCSS(hostname) {
  if (!hostname) return '';
  const selectors = [];
  for (const rule of cosmeticRules) {
    const applies = rule.domains.includes('*') ||
      rule.domains.some(d => {
        if (d.startsWith('~')) return false;
        return hostname === d || hostname.endsWith('.' + d);
      });
    const excluded = rule.domains.some(d => {
      if (!d.startsWith('~')) return false;
      const ex = d.slice(1);
      return hostname === ex || hostname.endsWith('.' + ex);
    });
    if (applies && !excluded) {
      selectors.push(rule.selector);
    }
  }
  if (selectors.length === 0) return '';
  // Batch selectors into chunks of 50 for performance
  const chunks = [];
  for (let i = 0; i < selectors.length; i += 50) {
    chunks.push(selectors.slice(i, i + 50).join(', ') + ' { display: none !important; }');
  }
  return chunks.join('\n');
}


function isWhitelisted(hostname) {
  return whitelistedSites.has(hostname);
}

function toggleWhitelist(hostname) {
  if (whitelistedSites.has(hostname)) {
    whitelistedSites.delete(hostname);
  } else {
    whitelistedSites.add(hostname);
  }
  // Persist
  try {
    fs.writeFileSync(getWhitelistFile(), JSON.stringify([...whitelistedSites]));
  } catch {}
  return !whitelistedSites.has(hostname); // returns true if now blocking
}

function getWhitelist() {
  return [...whitelistedSites];
}


function getStats() {
  return {
    totalFilters: stats.totalFilters,
    blockedDomains: blockedDomains.size,
    patternRules: blockedPatterns.length,
    cosmeticRules: cosmeticRules.length,
    lastUpdate: stats.lastUpdate,
    listsLoaded: stats.listsLoaded,
    whitelistedSites: whitelistedSites.size,
  };
}

async function forceUpdate() {
  blockedDomains = new Set();
  blockedPatterns = [];
  cosmeticRules = [];
  stats.totalFilters = 0;
  stats.listsLoaded = [];
  await updateFilterLists();
  return getStats();
}

module.exports = {
  setDataDir,
  initialize,
  shouldBlock,
  getCosmeticCSS,
  isWhitelisted,
  toggleWhitelist,
  getWhitelist,
  getStats,
  forceUpdate,
};
