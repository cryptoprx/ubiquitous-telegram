const { app, BrowserWindow, ipcMain, session, dialog, protocol, net, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const wallet = require('./wallet');
const adblock = require('./adblock');
const isDev = process.env.NODE_ENV === 'development';

// Suppress Electron security warnings in development (unsafe-eval is required by Monaco + Vite HMR)
if (isDev) process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Suppress noisy GUEST_VIEW_MANAGER_CALL errors (ERR_ABORTED -3) from webview navigation cancellations
process.on('unhandledRejection', (reason) => {
  if (reason && reason.errno === -3) return; // ERR_ABORTED — normal during navigation
  console.error('[UnhandledRejection]', reason);
});

// Register flip-music:// protocol scheme (must be before app.ready)
protocol.registerSchemesAsPrivileged([
  { scheme: 'flip-music', privileges: { stream: true, supportFetchAPI: true, bypassCSP: true } },
]);

function verifyIntegrity() {
  if (!app.isPackaged) return true;
  try {
    const integrityPath = path.join(__dirname, 'integrity.json');
    if (!fs.existsSync(integrityPath)) {
      console.warn('[Integrity] No integrity.json found — skipping check');
      return true;
    }
    const expected = JSON.parse(fs.readFileSync(integrityPath, 'utf-8'));
    const basePath = path.join(__dirname, '..');
    const tampered = [];

    for (const [relPath, expectedHash] of Object.entries(expected)) {
      const fullPath = path.join(basePath, relPath);
      if (!fs.existsSync(fullPath)) {
        tampered.push(`${relPath} (missing)`);
        continue;
      }
      const content = fs.readFileSync(fullPath);
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      if (actualHash !== expectedHash) {
        tampered.push(relPath);
      }
    }

    if (tampered.length > 0) {
      console.error('[Integrity] TAMPERED FILES:', tampered);
      dialog.showErrorBox(
        'Flip Browser — Integrity Check Failed',
        `The following files have been modified and may be compromised:\n\n${tampered.join('\n')}\n\nPlease reinstall Flip Browser from the official source.`
      );
      app.quit();
      return false;
    }

    console.log('[Integrity] All files verified ✓');
    return true;
  } catch (e) {
    console.error('[Integrity] Check failed:', e.message);
    return true;
  }
}

// Set app name and metadata
app.setName('Flip Browser');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.flip.browser');
}

// Enable DNS-over-HTTPS (Cloudflare)
app.commandLine.appendSwitch('enable-features', 'DnsOverHttps');
app.commandLine.appendSwitch('force-fieldtrials', 'DnsOverHttps/Enabled');
app.commandLine.appendSwitch('dns-over-https-mode', 'secure');
app.commandLine.appendSwitch('dns-over-https-templates', 'https://cloudflare-dns.com/dns-query');

// WebRTC enhancements
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
app.commandLine.appendSwitch('webrtc-max-cpu-consumption-percentage', '50');

let mainWindow;
let adBlockEnabled = true;
let trackingProtectionEnabled = true;
let httpsOnlyMode = true;
let fingerprintProtection = true;

// Fingerprint protection: script injected into every webview to neuter fingerprinting APIs
const FINGERPRINT_PROTECTION_JS = `
(function() {
  // Block canvas fingerprinting
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  HTMLCanvasElement.prototype.toDataURL = function() {
    const ctx = this.getContext('2d');
    if (ctx && this.width > 16 && this.height > 16) {
      const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        imgData.data[i] ^= 1; // subtle noise
      }
      ctx.putImageData(imgData, 0, 0);
    }
    return origToDataURL.apply(this, arguments);
  };
  HTMLCanvasElement.prototype.toBlob = function(cb, type, quality) {
    const dataUrl = this.toDataURL(type, quality);
    const byteString = atob(dataUrl.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    cb(new Blob([ab], { type: type || 'image/png' }));
  };

  // Block WebGL fingerprinting
  const origGetParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(param) {
    // UNMASKED_VENDOR_WEBGL / UNMASKED_RENDERER_WEBGL
    if (param === 0x9245 || param === 0x9246) return 'Generic GPU';
    return origGetParameter.call(this, param);
  };
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(param) {
      if (param === 0x9245 || param === 0x9246) return 'Generic GPU';
      return origGetParam2.call(this, param);
    };
  }

  // Block AudioContext fingerprinting
  if (typeof AudioContext !== 'undefined') {
    const origCreateOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function() {
      const osc = origCreateOscillator.call(this);
      const origConnect = osc.connect.bind(osc);
      osc.connect = function(dest) {
        if (dest instanceof AnalyserNode) {
          // Add noise node in between
          return origConnect(dest);
        }
        return origConnect(dest);
      };
      return osc;
    };
  }

  // Spoof navigator properties to reduce fingerprint surface
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
})();
`;

// --- Ad & Tracker Domain Lists (curated from EasyList / EasyPrivacy / Peter Lowe's) ---
const AD_DOMAINS = new Set([
  // Google Ads
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.com', 'pagead2.googlesyndication.com', 'googleads.g.doubleclick.net',
  'www.googletagservices.com', 'adclick.g.doubleclick.net', 'securepubads.g.doubleclick.net',
  'tpc.googlesyndication.com', 'partner.googleadservices.com',
  // Facebook / Meta
  'pixel.facebook.com', 'an.facebook.com', 'www.facebook.com/tr',
  // Amazon Ads
  'aax.amazon-adsystem.com', 'z-na.amazon-adsystem.com', 'fls-na.amazon-adsystem.com',
  'assoc-redirect.amazon.com', 'ir-na.amazon-adsystem.com',
  // Twitter / X
  'ads-api.twitter.com', 'ads.twitter.com', 'analytics.twitter.com',
  // Microsoft / Bing
  'ads.bing.com', 'bat.bing.com', 'c.bing.com', 'c.msn.com',
  // Ad networks
  'media.net', 'contextweb.com', 'revcontent.com', 'taboola.com', 'cdn.taboola.com',
  'trc.taboola.com', 'outbrain.com', 'widgets.outbrain.com', 'paid.outbrain.com',
  'criteo.com', 'bidswitch.net', 'casalemedia.com', 'pubmatic.com', 'rubiconproject.com',
  'openx.net', 'adnxs.com', 'adsrvr.org', 'advertising.com', 'adform.net',
  'adroll.com', 'adobedtm.com', 'serving-sys.com', 'smartadserver.com',
  'turn.com', 'yieldmo.com', 'yieldmanager.com', 'sovrn.com', 'sharethrough.com',
  'moatads.com', 'doubleverify.com', 'adsafeprotected.com', 'integralads.com',
  'flashtalking.com', 'sizmek.com', 'eyereturn.com', 'ipredictive.com',
  'tribalfusion.com', 'undertone.com', 'zedo.com', 'innovid.com',
  'nativo.com', 'mathtag.com', 'bounceexchange.com', 'bouncex.net',
  'exoclick.com', 'propellerads.com', 'popcash.net', 'popads.net',
  'admob.com', 'admob.google.com', 'unityads.unity3d.com',
  'mopub.com', 'applovin.com', 'vungle.com', 'chartboost.com',
  'inmobi.com', 'supersonicads.com', 'startapp.com',
  // Popups / redirects
  'adf.ly', 'linkbucks.com', 'shorte.st',
]);

const TRACKER_DOMAINS = new Set([
  // Google Analytics / Tag Manager
  'google-analytics.com', 'www.google-analytics.com', 'ssl.google-analytics.com',
  'analytics.google.com', 'www.googletagmanager.com', 'tagmanager.google.com',
  // Facebook tracking
  'connect.facebook.net', 'pixel.facebook.com',
  // General trackers
  'hotjar.com', 'static.hotjar.com', 'script.hotjar.com',
  'mixpanel.com', 'cdn.mxpnl.com', 'api.mixpanel.com',
  'amplitude.com', 'api.amplitude.com', 'cdn.amplitude.com',
  'segment.io', 'cdn.segment.com', 'api.segment.io',
  'fullstory.com', 'rs.fullstory.com',
  'mouseflow.com', 'o2.mouseflow.com',
  'luckyorange.com', 'luckyorange.net',
  'crazyegg.com', 'script.crazyegg.com',
  'heap.io', 'heapanalytics.com',
  'kissmetrics.com', 'i.kissmetrics.com',
  'intercom.io', 'widget.intercom.io',
  'hubspot.com', 'js.hs-analytics.net', 'track.hubspot.com',
  'marketo.net', 'marketo.com', 'munchkin.marketo.net',
  'pardot.com', 'pi.pardot.com',
  'drift.com', 'js.driftt.com',
  'optimizely.com', 'cdn.optimizely.com', 'logx.optimizely.com',
  'newrelic.com', 'js-agent.newrelic.com', 'bam.nr-data.net',
  'sentry.io', 'browser.sentry-cdn.com',
  'bugsnag.com', 'd2wy8f7a9ursnm.cloudfront.net',
  'rollbar.com', 'cdnjs.cloudflare.com/ajax/libs/rollbar.js',
  'loggly.com', 'logs-01.loggly.com',
  'datadoghq.com', 'browser-intake-datadoghq.com',
  'clarity.ms', 'www.clarity.ms',
  'plausible.io',
  'matomo.cloud',
  'quantserve.com', 'quantcount.com', 'scorecardresearch.com',
  'comscore.com', 'b.scorecardresearch.com',
  'omtrdc.net', 'demdex.net', '2o7.net',
  'linkedin.com/li/track', 'ads.linkedin.com', 'snap.licdn.com',
  'tiktok.com/i18n/pixel', 'analytics.tiktok.com',
  'pinterest.com/ct', 'ct.pinterest.com',
  // Fingerprinting
  'fingerprintjs.com', 'fpjs.io',
]);

// Safe Browsing: known phishing, malware, and scam domains (curated from PhishTank / URLhaus / abuse.ch)
const UNSAFE_DOMAINS = new Set([
  // Common phishing TLDs and patterns
  'malware-traffic-analysis.net', '0-0-0-0-0-0-0-0-0.info',
  // Known phishing aggregators
  'bit-login.com', 'secure-login-verify.com', 'account-verify-login.com',
  'update-your-account.com', 'verify-your-identity.com', 'login-secure-verify.com',
  // Crypto scams
  'elon-airdrop.com', 'claim-free-crypto.com', 'eth-giveaway.com',
  'btc-doubler.com', 'free-nft-claim.com',
  // Tech support scams
  'microsoft-alert.support', 'windows-defender-alert.com', 'apple-security-warning.com',
  'virus-alert-warning.com', 'your-pc-is-infected.com',
  // Generic scam patterns
  'free-gift-card.com', 'you-won-prize.com', 'claim-reward-now.com',
]);

// Safe Browsing URL pattern checks (heuristic-based)
function isSuspiciousUrl(hostname, url) {
  if (UNSAFE_DOMAINS.has(hostname)) return 'phishing-domain';
  for (const d of UNSAFE_DOMAINS) {
    if (hostname.endsWith('.' + d)) return 'phishing-subdomain';
  }
  // Heuristic: detect IDN homograph attacks (punycode domains pretending to be known sites)
  if (hostname.startsWith('xn--') && /paypal|google|apple|microsoft|amazon|bank/i.test(url)) return 'idn-homograph';
  return null;
}

// Extract hostname from URL
function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// Check if hostname matches or is a subdomain of a blocked domain
function isDomainBlocked(hostname, blockedSet) {
  if (blockedSet.has(hostname)) return true;
  // Check if it's a subdomain: e.g. "cdn.taboola.com" matches "taboola.com"
  for (const domain of blockedSet) {
    if (hostname.endsWith('.' + domain)) return true;
  }
  return false;
}

// Strip known tracking query parameters from URLs
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_name', 'utm_cid',
  'utm_reader', 'utm_viz_id', 'utm_pubreferrer', 'utm_swu', 'utm_brand',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
  'msclkid', 'twclid', 'li_fat_id', 'igshid', 'mc_cid', 'mc_eid',
  '_ga', '_gl', '_hsenc', '_hsmi', '_openstat',
  'yclid', 'ymclid', 'oly_anon_id', 'oly_enc_id',
  'vero_conv', 'vero_id', 'wickedid', 'mkt_tok',
  'epik', 'pp', 'ref_', 'ref_src', 'ref_url',
  'rb_clickid', 'spm', 'scm', 's_kwcid', 'ef_id',
  'trk', 'trkCampaign', 'trkInfo',
]);

function stripTrackingParams(url) {
  try {
    const u = new URL(url);
    let changed = false;
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || key.startsWith('utm_') || key.startsWith('__hs') || key.startsWith('mc_')) {
        u.searchParams.delete(key);
        changed = true;
      }
    }
    return changed ? u.toString() : url;
  } catch {
    return url;
  }
}

// Check if URL path matches pattern-based rules
function isPathBlocked(url) {
  const pathPatterns = [
    '/pagead/', '/ad_', '/ads/', '/adserv', '/adserver',
    '/doubleclick/', '/_ads/', '/adframe', '/adview',
    '/show_ads', '/banner_ad', '/popunder',
    '/facebook.com/tr', '/collect?', '/analytics.js',
    '/gtag/', '/gtm.js',
  ];
  const lower = url.toLowerCase();
  return pathPatterns.some(p => lower.includes(p));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0c0a09',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: true,
      spellcheck: true,
    },
    icon: isDev
      ? path.join(__dirname, '..', 'public', 'fliplogo.png')
      : path.join(__dirname, '..', 'dist', 'fliplogo.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up ad/tracker blocking
  setupAdBlocker();

  // HTTPS-only mode is now handled inside setupAdBlocker() to avoid overwriting the onBeforeRequest listener

  // Permission request handler — prompt user for sensitive permissions
  const pendingPermCallbacks = {};
  let permIdCounter = 0;

  // Permission check handler — Electron 28+ calls this for synchronous permission checks.
  // Must return true so setPermissionRequestHandler fires for media permissions.
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    // Silenced verbose log — uncomment for debugging:
    // console.log('[PermCheck]', permission, 'origin:', requestingOrigin, 'wcId:', webContents?.id, 'mainId:', mainWindow?.webContents?.id);
    // If request comes from the main window (where extension iframes live), always allow
    if (mainWindow && !mainWindow.isDestroyed() && webContents && webContents.id === mainWindow.webContents.id) {
      // console.log('[PermCheck] ALLOW — main window webContents');
      return true;
    }
    // Always allow safe permissions
    const safePerms = ['clipboard-read', 'clipboard-sanitized-write', 'notifications', 'fullscreen', 'pointerLock'];
    if (safePerms.includes(permission)) return true;
    // Auto-allow for file:// and empty origins (app content)
    if (!requestingOrigin || requestingOrigin === 'null' || requestingOrigin.startsWith('file://')) return true;
    // For web pages: check stored decisions
    const perms = encryptedRead(notifFile, {});
    let origin;
    try { origin = new URL(requestingOrigin).hostname; } catch { return true; }
    if (!origin) return true;
    const key = `${origin}:${permission}`;
    if (perms[key] !== undefined) return perms[key];
    return true;
  });

  // Device permission handler — persist device-level grants (camera/mic hardware)
  session.defaultSession.setDevicePermissionHandler((details) => true);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // console.log('[PermReq]', permission, 'url:', webContents?.getURL()?.slice(0, 60), 'wcId:', webContents?.id, 'mainId:', mainWindow?.webContents?.id);
    // If request comes from the main window (extension iframes), auto-allow
    if (mainWindow && !mainWindow.isDestroyed() && webContents && webContents.id === mainWindow.webContents.id) {
      console.log('[PermReq] ALLOW — main window webContents');
      return callback(true);
    }
    // Auto-allow safe permissions
    const silentAllow = ['clipboard-read', 'clipboard-sanitized-write'];
    if (silentAllow.includes(permission)) return callback(true);
    // Auto-allow file:// origins (app content)
    let url;
    try { url = new URL(webContents.getURL()); } catch { return callback(true); }
    if (!url.hostname || url.protocol === 'file:') return callback(true);
    // For web pages: check stored permissions
    const origin = url.hostname;
    const perms = encryptedRead(notifFile, {});
    const key = `${origin}:${permission}`;
    if (perms[key] !== undefined) return callback(perms[key]);
    // Prompt the user via the renderer
    const id = ++permIdCounter;
    pendingPermCallbacks[id] = (allowed) => {
      const current = encryptedRead(notifFile, {});
      current[key] = allowed;
      encryptedWrite(notifFile, current);
      callback(allowed);
    };
    mainWindow.webContents.send('permission-request', { id, origin, permission });
  });

  ipcMain.handle('respond-permission', (_, id, allowed) => {
    const cb = pendingPermCallbacks[id];
    if (cb) {
      cb(allowed);
      delete pendingPermCallbacks[id];
    }
    return true;
  });

  // Certificate error handler — reject bad certs and notify renderer to show interstitial
  mainWindow.webContents.on('did-attach-webview', (_, webviewContents) => {
    webviewContents.on('certificate-error', (event, url, error, certificate, callback) => {
      event.preventDefault();
      callback(false); // Always reject bad certificates
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('certificate-error', { url, error, issuer: certificate?.issuerName || '' });
      }
    });

    // Webview crash recovery — notify renderer when a tab's render process dies
    webviewContents.on('render-process-gone', (event, details) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-crashed', { url: webviewContents.getURL(), reason: details?.reason || 'unknown' });
      }
    });

    // Inject fingerprint protection into all loaded pages
    webviewContents.on('did-finish-load', () => {
      if (fingerprintProtection) {
        webviewContents.executeJavaScript(FINGERPRINT_PROTECTION_JS).catch(() => {});
      }
    });
  });

  // Download tracking
  session.defaultSession.on('will-download', (event, item) => {
    const dl = {
      id: Date.now(),
      filename: item.getFilename(),
      url: item.getURL(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing',
      savePath: item.getSavePath(),
      startTime: Date.now(),
    };
    downloads.push(dl);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-started', dl);
    }

    item.on('updated', (_, state) => {
      dl.receivedBytes = item.getReceivedBytes();
      dl.state = state;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-updated', dl);
      }
    });

    item.once('done', (_, state) => {
      dl.state = state;
      dl.receivedBytes = item.getReceivedBytes();
      dl.savePath = item.getSavePath();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-done', dl);
      }
    });
  });

  // CSP is now handled inside setupAdBlocker() to avoid overwriting the onHeadersReceived listener
}

function setupAdBlocker() {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    // Skip internal requests
    if (details.url.startsWith('devtools://') || details.url.includes('localhost')) {
      return callback({});
    }

    const hostname = getHostname(details.url);
    if (!hostname) return callback({});

    // Safe Browsing: block known phishing/malware/scam domains
    if (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') {
      const threat = isSuspiciousUrl(hostname, details.url);
      if (threat) {
        blockedCount++;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('safe-browsing-warning', { url: details.url, threat, hostname });
        }
        return callback({ cancel: true });
      }
    }

    // HTTPS-only mode: upgrade HTTP to HTTPS
    if (httpsOnlyMode && details.url.startsWith('http://')) {
      if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.endsWith('.local')) {
        const httpsUrl = details.url.replace(/^http:/, 'https:');
        return callback({ redirectURL: httpsUrl });
      }
    }

    // Mixed content blocking: block insecure subresources on HTTPS pages
    if (httpsOnlyMode && details.url.startsWith('http://') && details.referrer && details.referrer.startsWith('https://')) {
      const refHost = getHostname(details.referrer);
      if (refHost && refHost !== 'localhost' && refHost !== '127.0.0.1') {
        const type = details.resourceType;
        // Block active mixed content (scripts, stylesheets, iframes, xhr, fetch, websocket)
        if (['script', 'stylesheet', 'subFrame', 'xhr', 'websocket', 'object'].includes(type)) {
          blockedCount++;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ad-blocked', { url: details.url, reason: 'mixed-content', count: blockedCount });
          }
          return callback({ cancel: true });
        }
        // Upgrade passive mixed content (images, media, fonts) to HTTPS
        if (['image', 'media', 'font'].includes(type)) {
          return callback({ redirectURL: details.url.replace(/^http:/, 'https:') });
        }
      }
    }

    // Strip tracking query parameters (utm_*, fbclid, gclid, etc.)
    if (trackingProtectionEnabled && details.url.includes('?')) {
      const stripped = stripTrackingParams(details.url);
      if (stripped !== details.url) {
        return callback({ redirectURL: stripped });
      }
    }

    let blocked = false;
    let reason = '';

    // Ad blocking — enhanced filter engine first, then fallback to hardcoded lists
    if (adBlockEnabled) {
      if (adblock.shouldBlock(details.url, details.referrer || details.url)) {
        blocked = true;
        reason = 'filter-list';
      } else if (isDomainBlocked(hostname, AD_DOMAINS)) {
        blocked = true;
        reason = 'ad-domain';
      } else if (isPathBlocked(details.url)) {
        blocked = true;
        reason = 'ad-path';
      }
    }

    // Tracking protection
    if (!blocked && trackingProtectionEnabled) {
      if (isDomainBlocked(hostname, TRACKER_DOMAINS)) {
        blocked = true;
        reason = 'tracker';
      }
    }

    if (blocked) {
      blockedCount++;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ad-blocked', {
          url: details.url,
          reason,
          count: blockedCount,
        });
      }
      callback({ cancel: true });
    } else {
      callback({});
    }
  });

  // Strip tracking headers and known tracking query params + inject proxy auth
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };

    // Inject proxy authentication if configured
    if (global._flipProxyAuth) {
      headers['Proxy-Authorization'] = global._flipProxyAuth;
    }

    if (!trackingProtectionEnabled) return callback({ requestHeaders: headers });

    // Remove Google's client tracking header
    delete headers['X-Client-Data'];

    // Remove known tracking/fingerprinting headers for third-party requests
    const requestHost = getHostname(details.url);
    const referrerHost = details.referrer ? getHostname(details.referrer) : '';

    const isThirdParty = requestHost && referrerHost && !requestHost.endsWith(referrerHost) && !referrerHost.endsWith(requestHost);

    if (isThirdParty) {
      // Strip cookies on third-party tracking requests
      if (isDomainBlocked(requestHost, TRACKER_DOMAINS) || isDomainBlocked(requestHost, AD_DOMAINS)) {
        delete headers['Cookie'];
        delete headers['Referer'];
      }
    }

    callback({ requestHeaders: headers });
  });

  // Combined onHeadersReceived: CSP + tracking header stripping
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let headers = { ...details.responseHeaders };

    // Production CSP for local file:// pages (renderer)
    if (!isDev && details.url.startsWith('file://')) {
      headers['Content-Security-Policy'] = [
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com blob:; " +
        "style-src 'self' 'unsafe-inline' https://unpkg.com; " +
        "img-src 'self' data: https: http:; " +
        "font-src 'self' data: https:; " +
        "connect-src 'self' https: http: ws: wss:; " +
        "media-src 'self' https: http:; " +
        "frame-src 'self' https: http:; " +
        "worker-src 'self' blob:; " +
        "object-src 'none'; " +
        "base-uri 'self';"
      ];
    }

    // Strip tracking cookies from known trackers
    if (trackingProtectionEnabled) {
      const hostname = getHostname(details.url);
      if (isDomainBlocked(hostname, TRACKER_DOMAINS) || isDomainBlocked(hostname, AD_DOMAINS)) {
        delete headers['set-cookie'];
        delete headers['Set-Cookie'];
      }
    }

    if (details.statusCode === 402) {
      // Parse x402 payment headers (per x402 spec)
      const paymentHeader =
        headers['x-payment'] || headers['X-Payment'] ||
        headers['payment-required'] || headers['Payment-Required'] ||
        headers['x-payment-required'] || headers['X-Payment-Required'];

      if (paymentHeader) {
        try {
          // Parse JSON from header value (may be array with single element)
          const raw = Array.isArray(paymentHeader) ? paymentHeader[0] : paymentHeader;
          const paymentReqs = JSON.parse(raw);
          const req = Array.isArray(paymentReqs) ? paymentReqs[0] : paymentReqs;

          // Build payment request info for the UI
          const paymentInfo = {
            id: ++x402PaymentIdCounter,
            url: details.url,
            hostname: getHostname(details.url),
            price: req.maxAmountRequired || req.price || req.amount || '0',
            asset: req.asset || req.token || 'USDC',
            network: req.network || `eip155:8453`,
            payTo: req.payToAddress || req.payTo || req.recipient || '',
            description: req.description || req.resource || '',
            scheme: req.scheme || 'exact',
            extra: req.extra || {},
            rawRequirement: req,
          };

          // Notify the renderer to show a payment prompt
          if (mainWindow && !mainWindow.isDestroyed()) {
            pendingX402Callbacks[paymentInfo.id] = { paymentInfo, url: details.url };
            mainWindow.webContents.send('x402-payment-request', paymentInfo);
          }
        } catch (e) {
          console.error('[x402] Failed to parse payment header:', e.message);
        }
      }
    }

    callback({ responseHeaders: headers });
  });
}

let x402PaymentIdCounter = 0;
const pendingX402Callbacks = {};
const FLIP_PLATFORM_FEE = 0.02; // 2% platform fee
const FLIP_TREASURY_ADDRESS = '0x9F894D4d1aFCfcDF45008edBe5D32e75f68601CA';

ipcMain.handle('respond-x402-payment', async (_, id, approved) => {
  const pending = pendingX402Callbacks[id];
  if (!pending) return { error: 'No pending payment' };
  delete pendingX402Callbacks[id];

  if (!approved) return { cancelled: true };

  try {
    const { paymentInfo, url } = pending;

    // Calculate platform fee (2%) on top of the content price
    const rawPrice = parseFloat(paymentInfo.price.replace('$', '')) || 0;
    const feeAmount = +(rawPrice * FLIP_PLATFORM_FEE).toFixed(6);
    const totalPrice = +(rawPrice + feeAmount).toFixed(6);
    const testnet = paymentInfo.network?.includes('84532');

    // 1) Sign the content payment to the resource server (original price)
    const signResult = await wallet.signX402Payment({
      price: rawPrice.toString(),
      payTo: paymentInfo.payTo,
      network: paymentInfo.network,
    });

    if (signResult.error) return { error: signResult.error };

    // 2) Send the 2% platform fee to the Flip treasury (fire-and-forget)
    if (feeAmount > 0 && FLIP_TREASURY_ADDRESS) {
      wallet.sendUsdc(FLIP_TREASURY_ADDRESS, feeAmount.toString(), testnet)
        .then(r => {
          if (r?.success) {
            wallet.addTxRecord({
              id: Date.now(),
              type: 'x402-fee',
              to: FLIP_TREASURY_ADDRESS,
              amount: feeAmount.toString(),
              asset: 'USDC',
              site: paymentInfo.hostname,
              network: paymentInfo.network,
              timestamp: Date.now(),
            });
          }
        })
        .catch(() => {});
    }

    // Record the content transaction
    wallet.addTxRecord({
      id: Date.now(),
      type: 'x402',
      to: paymentInfo.payTo,
      amount: rawPrice.toString(),
      fee: feeAmount.toString(),
      total: totalPrice.toString(),
      asset: paymentInfo.asset || 'USDC',
      site: paymentInfo.hostname,
      url: paymentInfo.url,
      network: paymentInfo.network,
      timestamp: Date.now(),
    });

    // Return the signed payment so the renderer can retry with the header
    return {
      success: true,
      url: url,
      paymentSignature: JSON.stringify(signResult.payload),
      paymentInfo,
      fee: feeAmount,
      total: totalPrice,
    };
  } catch (e) {
    return { error: e.message };
  }
});

// IPC Handlers

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized());

// Toggle fullscreen (F11)
ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

// New window (Ctrl+N)
ipcMain.handle('new-window', () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0c0a09',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: true,
      spellcheck: true,
    },
    icon: isDev
      ? path.join(__dirname, '..', 'public', 'fliplogo.png')
      : path.join(__dirname, '..', 'dist', 'fliplogo.png'),
  });
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
});

// New private / incognito window (Ctrl+Shift+N)
ipcMain.handle('new-private-window', () => {
  const partition = `private-${Date.now()}`;
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0c0a09',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: false,
      partition,
    },
    icon: isDev
      ? path.join(__dirname, '..', 'public', 'fliplogo.png')
      : path.join(__dirname, '..', 'dist', 'fliplogo.png'),
  });
  if (isDev) {
    win.loadURL('http://localhost:5173?private=1');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { private: '1' } });
  }
});

// Extensions: default-on for first launch
const DEFAULT_ENABLED_EXTENSIONS = [
  'community-chat',
  'calendar-widget',
  'sample-weather',
  'security-dashboard',
  'privacy-dashboard',
];

// Preset marketplace extensions — auto-installed on first launch so users get a useful starter set
const PRESET_MARKETPLACE_EXTENSIONS = [
  'calendar-widget',
  'sample-weather',
  'security-dashboard',
  'privacy-dashboard',
];

// Allowed popup URLs from extension manifests (populated on load-extensions)
const allowedPopupUrls = new Set();

// User-installed extensions directory (initialized lazily after dataDir is set)
let installedExtDir = null;
function getInstalledExtDir() {
  if (!installedExtDir) {
    installedExtDir = path.join(dataDir, 'installed-extensions');
    if (!fs.existsSync(installedExtDir)) fs.mkdirSync(installedExtDir, { recursive: true });
  }
  return installedExtDir;
}

// Marketplace config — change this URL when hosting is ready
const MARKETPLACE_URL = 'https://peru-grasshopper-236853.hostingersite.com/marketplace-packages';

// Helper: load a single extension from a directory
function loadExtFromDir(dir, extPath, savedStates) {
  const manifestPath = path.join(extPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const mainFile = path.join(extPath, manifest.main || 'App.jsx');
    let sourceCode = '';
    if (fs.existsSync(mainFile)) {
      sourceCode = fs.readFileSync(mainFile, 'utf-8');
    }
    let enabled;
    if (savedStates && dir in savedStates) {
      enabled = savedStates[dir];
    } else {
      enabled = DEFAULT_ENABLED_EXTENSIONS.includes(dir);
    }
    if (Array.isArray(manifest.allowed_navigation)) {
      manifest.allowed_navigation.forEach(u => allowedPopupUrls.add(u));
    }
    return { id: dir, manifest, sourceCode, path: extPath, enabled };
  } catch (e) {
    console.error(`Failed to load extension ${dir}:`, e);
    return null;
  }
}

// Extensions: load from bundled + user-installed directories
ipcMain.handle('load-extensions', async () => {
  const bundledDir = path.join(__dirname, '..', 'extensions');
  try {
    // Load user's saved extension toggle states
    const extStateFile = path.join(dataDir, 'extension-states.json');
    let savedStates = null;
    try {
      const loaded = encryptedRead(extStateFile, null);
      if (loaded) savedStates = loaded;
    } catch {}

    const extensions = [];
    allowedPopupUrls.clear();

    // 0. Auto-install preset marketplace extensions on first launch
    const presetFlag = path.join(dataDir, '.presets-installed');
    if (!fs.existsSync(presetFlag)) {
      console.log('[Extensions] First launch — auto-installing preset marketplace extensions');
      for (const presetId of PRESET_MARKETPLACE_EXTENSIONS) {
        const destDir = path.join(getInstalledExtDir(), presetId);
        if (fs.existsSync(destDir)) continue; // already installed
        try {
          // Try remote download from marketplace
          if (MARKETPLACE_URL) {
            const manifestResp = await fetch(`${MARKETPLACE_URL}/${presetId}/manifest.json`, { signal: AbortSignal.timeout(8000) });
            if (manifestResp.ok) {
              const manifestText = await manifestResp.text();
              const manifest = JSON.parse(manifestText);
              const mainFile = manifest.main || 'App.jsx';
              const mainResp = await fetch(`${MARKETPLACE_URL}/${presetId}/${mainFile}`, { signal: AbortSignal.timeout(8000) });
              if (mainResp.ok) {
                fs.mkdirSync(destDir, { recursive: true });
                fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
                fs.writeFileSync(path.join(destDir, mainFile), await mainResp.text());
                // Enable by default
                if (!savedStates) savedStates = {};
                savedStates[presetId] = true;
                console.log(`[Extensions] Preset installed: ${presetId}`);
              }
            }
          }
        } catch (e) {
          console.warn(`[Extensions] Failed to auto-install preset ${presetId}:`, e.message);
        }
      }
      // Save enabled states for presets
      if (savedStates) {
        const extStateFile2 = path.join(dataDir, 'extension-states.json');
        try { encryptedWrite(extStateFile2, savedStates); } catch {}
      }
      // Mark presets as installed so we don't repeat
      try { fs.writeFileSync(presetFlag, new Date().toISOString()); } catch {}
    }

    // 1. Load bundled extensions (community-chat + any that ship with the app)
    if (fs.existsSync(bundledDir)) {
      const dirs = fs.readdirSync(bundledDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name);
      for (const dir of dirs) {
        const ext = loadExtFromDir(dir, path.join(bundledDir, dir), savedStates);
        if (ext) { ext.source = 'bundled'; extensions.push(ext); }
      }
    }

    // 2. Load user-installed extensions from dataDir/installed-extensions/
    //    These default to enabled (user explicitly installed them from marketplace)
    const userExtDir = getInstalledExtDir();
    if (fs.existsSync(userExtDir)) {
      const dirs = fs.readdirSync(userExtDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name);
      for (const dir of dirs) {
        // Skip if already loaded from bundled
        if (extensions.some(e => e.id === dir)) continue;
        const ext = loadExtFromDir(dir, path.join(userExtDir, dir), savedStates);
        if (ext) {
          ext.source = 'marketplace';
          // Default user-installed extensions to enabled if no saved state exists
          if (!savedStates || !(dir in savedStates)) ext.enabled = true;
          extensions.push(ext);
        }
      }
    }

    // Sort: community-chat first, ai-chat second, dev tools last, rest alphabetical
    const DEV_EXTENSIONS = ['json-formatter', 'color-picker', 'regex-tester'];
    const TOP_ORDER = ['community-chat', 'ai-chat'];
    extensions.sort((a, b) => {
      const aTop = TOP_ORDER.indexOf(a.id);
      const bTop = TOP_ORDER.indexOf(b.id);
      if (aTop !== -1 && bTop !== -1) return aTop - bTop;
      if (aTop !== -1) return -1;
      if (bTop !== -1) return 1;
      const aDev = DEV_EXTENSIONS.includes(a.id);
      const bDev = DEV_EXTENSIONS.includes(b.id);
      if (aDev && !bDev) return 1;
      if (!aDev && bDev) return -1;
      return a.id.localeCompare(b.id);
    });

    return extensions;
  } catch (e) {
    console.error('Failed to load extensions:', e);
    return [];
  }
});


// Fetch marketplace catalog (merge local + remote so local dev extensions always appear)
ipcMain.handle('marketplace-catalog', async () => {
  let remoteExts = [];
  let localExts = [];

  // 1. Load local catalog (always checked)
  try {
    const localPath = path.join(__dirname, '..', '..', 'marketplace-packages', 'marketplace.json');
    if (fs.existsSync(localPath)) {
      const local = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
      localExts = local.extensions || [];
    }
  } catch (e) {
    console.error('[Marketplace] Failed to load local catalog:', e.message);
  }

  // 2. Load remote catalog if URL is set
  if (MARKETPLACE_URL) {
    try {
      const resp = await fetch(`${MARKETPLACE_URL}/marketplace.json`, {
        signal: AbortSignal.timeout(8000),
      });
      const remote = await resp.json();
      remoteExts = remote.extensions || [];
    } catch (e) {
      console.error('[Marketplace] Failed to fetch remote catalog:', e.message);
    }
  }

  // 3. Merge: local entries win over remote duplicates
  const merged = new Map();
  for (const ext of remoteExts) merged.set(ext.id, ext);
  for (const ext of localExts) merged.set(ext.id, ext);

  return { version: 1, extensions: Array.from(merged.values()) };
});

// Get list of all installed extension IDs (bundled + user-installed) with source info
ipcMain.handle('marketplace-get-installed', async () => {
  try {
    const bundled = [];
    const userInstalled = [];

    // 1. Bundled extensions in extensions/ folder
    const bundledDir = path.join(__dirname, '..', 'extensions');
    if (fs.existsSync(bundledDir)) {
      fs.readdirSync(bundledDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).forEach(d => bundled.push(d.name));
    }

    // 2. User-installed extensions from marketplace
    const dir = getInstalledExtDir();
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory()).forEach(d => userInstalled.push(d.name));
    }

    return { bundled, userInstalled };
  } catch { return { bundled: [], userInstalled: [] }; }
});

// Install extension from marketplace (copy from local mock or download from remote)
ipcMain.handle('marketplace-install', async (_, extId) => {
  try {
    if (!extId || !/^[a-zA-Z0-9_-]+$/.test(extId)) return { error: 'Invalid extension ID' };

    let allExts = [];
    try {
      // Check local catalog
      const localCatalog = path.join(__dirname, '..', '..', 'marketplace-packages', 'marketplace.json');
      if (fs.existsSync(localCatalog)) {
        const local = JSON.parse(fs.readFileSync(localCatalog, 'utf-8'));
        allExts.push(...(local.extensions || []));
      }
      // Check remote catalog
      if (MARKETPLACE_URL) {
        try {
          const catResp = await fetch(`${MARKETPLACE_URL}/marketplace.json`, { signal: AbortSignal.timeout(8000) });
          const remote = await catResp.json();
          allExts.push(...(remote.extensions || []));
        } catch {}
      }
      const entry = allExts.find(e => e.id === extId);
      if (!entry) return { error: 'Extension not found in marketplace catalog' };
      if (!entry.approved) {
        console.warn(`[Marketplace Security] Blocked install of unapproved extension: ${extId}`);
        return { error: 'This extension has not been reviewed and approved yet. Only approved extensions can be installed.' };
      }
    } catch (e) {
      console.error('[Marketplace Security] Could not verify approval:', e.message);
      return { error: 'Could not verify extension approval status. Try again later.' };
    }

    const destDir = path.join(getInstalledExtDir(), extId);

    // Try local marketplace-packages first, then remote
    const localSrcDir = path.join(__dirname, '..', '..', 'marketplace-packages', extId);
    if (fs.existsSync(localSrcDir)) {
      // Local: copy from marketplace-packages folder
      fs.mkdirSync(destDir, { recursive: true });
      const files = fs.readdirSync(localSrcDir);
      for (const file of files) {
        const srcFile = path.join(localSrcDir, file);
        const destFile = path.join(destDir, file);
        const stat = fs.statSync(srcFile);
        if (stat.isFile()) {
          fs.copyFileSync(srcFile, destFile);
        } else if (stat.isDirectory()) {
          fs.cpSync(srcFile, destFile, { recursive: true });
        }
      }
    } else if (MARKETPLACE_URL) {
      // Remote: download extension files from hosted URL
      const manifestResp = await fetch(`${MARKETPLACE_URL}/${extId}/manifest.json`, { signal: AbortSignal.timeout(8000) });
      if (!manifestResp.ok) return { error: `Extension not found (${manifestResp.status})` };
      const manifestText = await manifestResp.text();
      const manifest = JSON.parse(manifestText);

      const entry = allExts.find(e => e.id === extId);
      if (entry?.manifestHash && !verifyExtensionHash(manifestText, entry.manifestHash)) {
        console.error(`[Marketplace Security] REJECTED ${extId} — manifest hash mismatch`);
        return { error: 'Extension integrity check failed — manifest has been tampered with.' };
      }

      // Download main file
      const mainFile = manifest.main || 'App.jsx';
      const mainResp = await fetch(`${MARKETPLACE_URL}/${extId}/${mainFile}`, { signal: AbortSignal.timeout(8000) });
      if (!mainResp.ok) return { error: 'Failed to download extension code' };
      const mainContent = await mainResp.text();

      if (entry?.hash && !verifyExtensionHash(mainContent, entry.hash)) {
        console.error(`[Marketplace Security] REJECTED ${extId} — code hash mismatch`);
        return { error: 'Extension integrity check failed — code has been tampered with.' };
      }

      // Hashes verified — safe to write
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      fs.writeFileSync(path.join(destDir, mainFile), mainContent);

      // Download icon if specified and not a lucide icon name
      if (manifest.icon && manifest.icon.includes('.')) {
        try {
          const iconResp = await fetch(`${MARKETPLACE_URL}/${extId}/${manifest.icon}`, { signal: AbortSignal.timeout(5000) });
          if (iconResp.ok) {
            fs.writeFileSync(path.join(destDir, manifest.icon), Buffer.from(await iconResp.arrayBuffer()));
          }
        } catch {}
      }
    } else {
      return { error: 'Extension package not found' };
    }

    // Auto-enable the newly installed extension
    const extStateFile = path.join(dataDir, 'extension-states.json');
    let states = {};
    try { states = encryptedRead(extStateFile, {}) || {}; } catch {}
    states[extId] = true;
    encryptedWrite(extStateFile, states);

    console.log(`[Marketplace] Installed: ${extId}`);
    return { success: true, id: extId };
  } catch (e) {
    console.error(`[Marketplace] Install failed for ${extId}:`, e.message);
    return { error: e.message };
  }
});

// Uninstall extension (remove from installed-extensions)
ipcMain.handle('marketplace-uninstall', async (_, extId) => {
  try {
    if (!extId || !/^[a-zA-Z0-9_-]+$/.test(extId)) return { error: 'Invalid extension ID' };

    // Prevent uninstalling bundled extensions
    const bundledDir = path.join(__dirname, '..', 'extensions', extId);
    if (fs.existsSync(bundledDir)) return { error: 'Cannot uninstall bundled extensions' };

    const extDir = path.join(getInstalledExtDir(), extId);
    if (!fs.existsSync(extDir)) return { error: 'Extension not installed' };

    fs.rmSync(extDir, { recursive: true, force: true });

    // Remove from enabled states
    const extStateFile = path.join(dataDir, 'extension-states.json');
    let states = {};
    try { states = encryptedRead(extStateFile, {}) || {}; } catch {}
    delete states[extId];
    encryptedWrite(extStateFile, states);

    console.log(`[Marketplace] Uninstalled: ${extId}`);
    return { success: true, id: extId };
  } catch (e) {
    console.error(`[Marketplace] Uninstall failed for ${extId}:`, e.message);
    return { error: e.message };
  }
});

function verifyExtensionHash(content, expectedHash) {
  if (!expectedHash) return true; // No hash in catalog = legacy extension, allow
  const actual = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
  return actual === expectedHash;
}

// On startup, check marketplace for newer versions of installed extensions
// and silently update them in the background.
async function autoUpdateExtensions() {
  try {
    const userExtDir = getInstalledExtDir();
    if (!fs.existsSync(userExtDir)) return;

    const installedDirs = fs.readdirSync(userExtDir, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name);
    if (!installedDirs.length) return;

    // Fetch marketplace catalog
    let catalogExts = [];
    if (MARKETPLACE_URL) {
      try {
        const resp = await fetch(`${MARKETPLACE_URL}/marketplace.json`, { signal: AbortSignal.timeout(10000) });
        const data = await resp.json();
        catalogExts = data.extensions || [];
      } catch (e) {
        console.log('[ExtUpdate] Could not fetch marketplace catalog:', e.message);
        return;
      }
    }
    if (!catalogExts.length) return;

    let updated = 0;
    for (const extId of installedDirs) {
      try {
        const localManifestPath = path.join(userExtDir, extId, 'manifest.json');
        if (!fs.existsSync(localManifestPath)) continue;

        const localManifest = JSON.parse(fs.readFileSync(localManifestPath, 'utf-8'));
        const catalogEntry = catalogExts.find(e => e.id === extId);
        if (!catalogEntry) continue;

        // Compare versions — update if marketplace has newer
        const localVer = localManifest.version || '0.0.0';
        const remoteVer = catalogEntry.version || '0.0.0';
        if (remoteVer <= localVer) continue;

        console.log(`[ExtUpdate] Updating ${extId}: ${localVer} → ${remoteVer}`);
        const destDir = path.join(userExtDir, extId);

        // Download updated manifest
        const manifestResp = await fetch(`${MARKETPLACE_URL}/${extId}/manifest.json`, { signal: AbortSignal.timeout(8000) });
        if (!manifestResp.ok) continue;
        const newManifestText = await manifestResp.text();
        const newManifest = JSON.parse(newManifestText);

        if (catalogEntry.manifestHash && !verifyExtensionHash(newManifestText, catalogEntry.manifestHash)) {
          console.error(`[ExtUpdate] REJECTED ${extId} — manifest hash mismatch (possible tampering)`);
          continue;
        }

        // Download updated main file
        const mainFile = newManifest.main || 'App.jsx';
        const mainResp = await fetch(`${MARKETPLACE_URL}/${extId}/${mainFile}`, { signal: AbortSignal.timeout(8000) });
        if (!mainResp.ok) continue;
        const mainContent = await mainResp.text();

        if (!verifyExtensionHash(mainContent, catalogEntry.hash)) {
          console.error(`[ExtUpdate] REJECTED ${extId} — code hash mismatch (possible tampering)`);
          continue;
        }

        // Hashes verified — safe to write files
        fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(newManifest, null, 2));
        fs.writeFileSync(path.join(destDir, mainFile), mainContent);

        // Download icon if file-based
        if (newManifest.icon && newManifest.icon.includes('.')) {
          try {
            const iconResp = await fetch(`${MARKETPLACE_URL}/${extId}/${newManifest.icon}`, { signal: AbortSignal.timeout(5000) });
            if (iconResp.ok) {
              fs.writeFileSync(path.join(destDir, newManifest.icon), Buffer.from(await iconResp.arrayBuffer()));
            }
          } catch {}
        }

        console.log(`[ExtUpdate] ✓ ${extId} updated to v${remoteVer} (hash verified)`);
        updated++;
      } catch (e) {
        console.error(`[ExtUpdate] Failed to update ${extId}:`, e.message);
      }
    }

    if (updated > 0) {
      console.log(`[ExtUpdate] Updated ${updated} extension(s) — all hashes verified`);
    }
  } catch (e) {
    console.error('[ExtUpdate] Auto-update failed:', e.message);
  }
}

const os = require('os');

// Only these folders are accessible — block everything else
function getSafeFolders() {
  const home = os.homedir();
  return {
    downloads: path.join(home, 'Downloads'),
    desktop: path.join(home, 'Desktop'),
    documents: path.join(home, 'Documents'),
    temp: os.tmpdir(),
  };
}

// Verify a path is inside one of the allowed folders
function isPathSafe(targetPath) {
  const resolved = path.resolve(targetPath);
  const safe = getSafeFolders();
  return Object.values(safe).some(folder => resolved.toLowerCase().startsWith(path.resolve(folder).toLowerCase()));
}

// fs.listDir — list files in a safe directory (async, capped at 1000 entries)
const fsPromises = require('fs').promises;

ipcMain.handle('ext-fs-list-dir', async (_, dirPath) => {
  try {
    if (!dirPath || typeof dirPath !== 'string') return { error: 'Invalid path' };
    const resolved = path.resolve(dirPath);
    if (!isPathSafe(resolved)) return { error: 'Access denied: path outside allowed folders' };
    try { await fsPromises.access(resolved); } catch { return { error: 'Directory not found' }; }

    const entries = await fsPromises.readdir(resolved, { withFileTypes: true });
    const results = [];
    const cap = Math.min(entries.length, 1000);
    for (let i = 0; i < cap; i++) {
      try {
        const entry = entries[i];
        const fullPath = path.join(resolved, entry.name);
        const stat = await fsPromises.stat(fullPath);
        results.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: stat.size,
          modified: stat.mtimeMs,
          created: stat.birthtimeMs,
          ext: path.extname(entry.name).toLowerCase(),
        });
      } catch {}
    }
    return { files: results, truncated: entries.length > 1000 };
  } catch (e) {
    return { error: e.message };
  }
});

// fs.getSize — get total size of a directory (async, max depth 2, max 5000 files)
ipcMain.handle('ext-fs-get-size', async (_, dirPath) => {
  try {
    if (!dirPath || typeof dirPath !== 'string') return { error: 'Invalid path' };
    const resolved = path.resolve(dirPath);
    if (!isPathSafe(resolved)) return { error: 'Access denied' };
    try { await fsPromises.access(resolved); } catch { return { size: 0 }; }

    let total = 0;
    let count = 0;
    const MAX_FILES = 5000;
    const MAX_DEPTH = 2;

    async function walk(dir, depth) {
      if (count >= MAX_FILES || depth > MAX_DEPTH) return;
      try {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (count >= MAX_FILES) break;
          const full = path.join(dir, entry.name);
          try {
            if (entry.isDirectory()) {
              await walk(full, depth + 1);
            } else {
              const stat = await fsPromises.stat(full);
              total += stat.size;
              count++;
            }
          } catch {}
        }
      } catch {}
    }
    await walk(resolved, 0);
    return { size: total, scannedFiles: count, partial: count >= MAX_FILES };
  } catch (e) {
    return { error: e.message };
  }
});

// fs.delete — delete files (array of paths, all must be in safe folders)
ipcMain.handle('ext-fs-delete', async (_, filePaths) => {
  try {
    if (!Array.isArray(filePaths) || filePaths.length === 0) return { error: 'No files specified' };
    if (filePaths.length > 500) return { error: 'Too many files (max 500 per batch)' };

    let deleted = 0;
    let failed = 0;
    for (const fp of filePaths) {
      try {
        const resolved = path.resolve(fp);
        if (!isPathSafe(resolved)) { failed++; continue; }
        try { await fsPromises.access(resolved); } catch { continue; }
        const stat = await fsPromises.stat(resolved);
        if (stat.isDirectory()) {
          await fsPromises.rm(resolved, { recursive: true, force: true });
        } else {
          await fsPromises.unlink(resolved);
        }
        deleted++;
      } catch { failed++; }
    }
    return { deleted, failed };
  } catch (e) {
    return { error: e.message };
  }
});

// fs.getSafeFolders — return the list of allowed folders with their paths
ipcMain.handle('ext-fs-get-safe-folders', async () => {
  const folders = getSafeFolders();
  const result = {};
  for (const [key, folderPath] of Object.entries(folders)) {
    let fileCount = 0;
    try {
      const entries = await fsPromises.readdir(folderPath);
      fileCount = entries.length;
    } catch {}
    result[key] = { path: folderPath, fileCount };
  }
  return result;
});

// fs.getDiskUsage — get disk space info (async)
ipcMain.handle('ext-fs-disk-usage', async () => {
  try {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      exec('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /format:csv', { timeout: 5000 }, (err, stdout) => {
        if (err) { resolve({ total: 0, free: 0, used: 0 }); return; }
        const lines = stdout.trim().split('\n').filter(l => l.includes(','));
        if (lines.length > 0) {
          const parts = lines[lines.length - 1].split(',');
          const free = parseInt(parts[1]) || 0;
          const total = parseInt(parts[2]) || 0;
          resolve({ total, free, used: total - free });
        } else {
          resolve({ total: 0, free: 0, used: 0 });
        }
      });
    });
  } catch (e) {
    return { error: e.message };
  }
});

const { exec: execCb } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(execCb);

// security.getConnections — parse netstat output for active TCP connections
ipcMain.handle('ext-security-connections', async () => {
  try {
    const { stdout } = await execAsync('netstat -no', { timeout: 10000, maxBuffer: 1024 * 512 });
    const lines = stdout.split('\n').filter(l => l.trim().startsWith('TCP') || l.trim().startsWith('UDP'));
    const connections = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const proto = parts[0];
      const local = parts[1];
      const remote = parts[2];
      const state = proto === 'UDP' ? 'STATELESS' : parts[3];
      const pid = proto === 'UDP' ? (parts[3] || '') : (parts[4] || '');
      // Skip loopback-only
      if (remote === '0.0.0.0:0' || remote === '*:*') continue;
      connections.push({ proto, local, remote, state, pid });
    }
    // Cap at 200
    return { connections: connections.slice(0, 200) };
  } catch (e) {
    return { error: e.message };
  }
});

// security.getListeningPorts — show listening ports and owning processes
ipcMain.handle('ext-security-listening', async () => {
  try {
    const { stdout } = await execAsync('netstat -ano | findstr LISTENING', { timeout: 10000, maxBuffer: 1024 * 256 });
    const lines = stdout.split('\n').filter(l => l.trim());
    const ports = [];
    const seen = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const local = parts[1];
      const pid = parts[4] || parts[3] || '';
      const port = local.split(':').pop();
      const key = `${port}:${pid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ports.push({ local, port, pid, proto: parts[0] });
    }
    return { ports: ports.slice(0, 100) };
  } catch (e) {
    return { error: e.message };
  }
});

// security.getProcessName — resolve PID to process name
ipcMain.handle('ext-security-process-name', async (_, pid) => {
  try {
    if (!pid || isNaN(pid)) return { name: 'Unknown' };
    const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { timeout: 5000 });
    const match = stdout.match(/"([^"]+)"/);
    return { name: match ? match[1] : 'Unknown' };
  } catch {
    return { name: 'Unknown' };
  }
});

// security.getStartupItems — list Startup folder + common Run registry keys
ipcMain.handle('ext-security-startup', async () => {
  try {
    const items = [];

    // Startup folder
    const startupDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    try {
      const entries = await fsPromises.readdir(startupDir);
      for (const name of entries) {
        items.push({ name, source: 'Startup Folder', path: path.join(startupDir, name) });
      }
    } catch {}

    // Registry Run keys
    try {
      const { stdout } = await execAsync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /s', { timeout: 5000 });
      const lines = stdout.split('\n').filter(l => l.includes('REG_SZ') || l.includes('REG_EXPAND_SZ'));
      for (const line of lines) {
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length >= 3) {
          items.push({ name: parts[0], source: 'Registry (HKCU)', path: parts[2] });
        }
      }
    } catch {}

    try {
      const { stdout } = await execAsync('reg query "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /s', { timeout: 5000 });
      const lines = stdout.split('\n').filter(l => l.includes('REG_SZ') || l.includes('REG_EXPAND_SZ'));
      for (const line of lines) {
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length >= 3) {
          items.push({ name: parts[0], source: 'Registry (HKLM)', path: parts[2] });
        }
      }
    } catch {}

    return { items };
  } catch (e) {
    return { error: e.message };
  }
});

// security.scanThreats — scan safe folders for suspicious files
ipcMain.handle('ext-security-scan', async () => {
  try {
    const threats = [];
    const dangerousExts = ['.exe', '.bat', '.cmd', '.vbs', '.ps1', '.scr', '.pif', '.com', '.msi', '.reg', '.hta', '.wsf'];
    const folders = getSafeFolders();

    for (const [key, folderPath] of Object.entries(folders)) {
      try {
        const entries = await fsPromises.readdir(folderPath, { withFileTypes: true });
        const cap = Math.min(entries.length, 500);
        for (let i = 0; i < cap; i++) {
          const entry = entries[i];
          if (entry.isDirectory()) continue;
          const name = entry.name;
          const ext = path.extname(name).toLowerCase();
          const fullPath = path.join(folderPath, name);

          // Double extension check (e.g. invoice.pdf.exe)
          // Skip version-number patterns like node-v22.19.0-x64.msi
          const parts = name.split('.');
          if (parts.length > 2 && dangerousExts.includes('.' + parts[parts.length - 1].toLowerCase())) {
            // Check if the "inner" extension is a real file extension (not a number/version)
            const innerExt = parts[parts.length - 2].toLowerCase();
            const isVersionNumber = /^\d+$/.test(innerExt) || /^[a-z]?\d+/.test(innerExt);
            const realFileExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'mp3', 'mp4', 'zip', 'rar', 'csv', 'rtf', 'html', 'xml', 'svg'];
            if (!isVersionNumber && realFileExts.includes(innerExt)) {
              threats.push({ file: name, path: fullPath, folder: key, type: 'double-extension', severity: 'high', detail: `Hidden executable: appears as .${innerExt} but is actually .${parts[parts.length - 1]}` });
              continue;
            }
          }

          // Executable in Downloads/Desktop/Temp
          if (dangerousExts.includes(ext) && (key === 'downloads' || key === 'temp' || key === 'desktop')) {
            let severity = 'medium';
            if (['.scr', '.pif', '.hta', '.wsf', '.vbs', '.com'].includes(ext)) severity = 'high';
            try {
              const stat = await fsPromises.stat(fullPath);
              threats.push({ file: name, path: fullPath, folder: key, type: 'executable', severity, detail: `${ext.toUpperCase().slice(1)} file (${(stat.size / 1024).toFixed(0)} KB)`, size: stat.size });
            } catch {}
          }

          // Hidden files (starting with dot on Windows is unusual)
          if (name.startsWith('.') && name !== '.gitignore' && name !== '.env') {
            threats.push({ file: name, path: fullPath, folder: key, type: 'hidden', severity: 'low', detail: 'Hidden file — may be suspicious' });
          }
        }
      } catch {}
    }

    return { threats, scannedFolders: Object.keys(folders).length };
  } catch (e) {
    return { error: e.message };
  }
});

const PORTAL_API = 'https://flip-dev-portal-nine.vercel.app';
let cachedEntitlements = null;
let entitlementsCacheTime = 0;
const ENTITLEMENTS_CACHE_TTL = 5 * 60 * 1000; // 5 min cache

ipcMain.handle('premium-check-entitlements', async (_, email) => {
  try {
    if (!email) return { extensions: [] };
    // Return cache if fresh
    if (cachedEntitlements && Date.now() - entitlementsCacheTime < ENTITLEMENTS_CACHE_TTL) {
      return cachedEntitlements;
    }
    const resp = await fetch(`${PORTAL_API}/api/entitlements?email=${encodeURIComponent(email)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return { extensions: [] };
    const data = await resp.json();
    cachedEntitlements = data;
    entitlementsCacheTime = Date.now();
    return data;
  } catch (e) {
    console.error('[Premium] Entitlement check failed:', e.message);
    return cachedEntitlements || { extensions: [] };
  }
});

ipcMain.handle('premium-create-checkout', async (_, { email, extId, priceId, planType }) => {
  try {
    if (!email || !extId || !priceId) return { error: 'Missing parameters' };
    const resp = await fetch(`${PORTAL_API}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ext_id: extId, price_id: priceId, plan_type: planType || 'monthly', email }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return { error: err.error || 'Checkout failed' };
    }
    const data = await resp.json();
    return data; // { url, sessionId }
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('premium-cancel-subscription', async (_, { email, extId }) => {
  try {
    if (!email || !extId) return { error: 'Missing parameters' };
    const resp = await fetch(`${PORTAL_API}/api/cancel-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ext_id: extId, email }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();
    // Clear cache so next check gets fresh data
    cachedEntitlements = null;
    return data;
  } catch (e) {
    return { error: e.message };
  }
});

// Save extension toggle states when user changes them (AES-256 encrypted)
ipcMain.handle('save-extension-states', (_, states) => {
  try {
    const extStateFile = path.join(dataDir, 'extension-states.json');
    encryptedWrite(extStateFile, states);
    return true;
  } catch (e) {
    console.error('[Extensions] Failed to save states:', e);
    return false;
  }
});

// Install extension from folder — PAUSED (use marketplace instead)
ipcMain.handle('install-extension', async () => {
  return { error: 'Extension importing from folder is currently disabled. Install extensions from the Marketplace instead.' };
});

// Create extension from Developer Dashboard
ipcMain.handle('create-extension', async (_, { id, manifest, sourceCode }) => {
  try {
    // Validate extension ID (alphanumeric + hyphens only)
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return { error: 'Invalid extension ID. Use only letters, numbers, hyphens, and underscores.' };
    }
    if (!manifest || !manifest.name) {
      return { error: 'manifest.json must include a name field.' };
    }
    const extensionsDir = path.join(__dirname, '..', 'extensions');
    const destDir = path.join(extensionsDir, id);

    if (fs.existsSync(destDir)) {
      // Overwrite existing — this is an update
    } else {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Write manifest.json
    fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    // Write App.jsx
    const mainFile = manifest.main || 'App.jsx';
    fs.writeFileSync(path.join(destDir, mainFile), sourceCode || '', 'utf-8');

    return {
      id,
      manifest,
      sourceCode: sourceCode || '',
      path: destDir,
      enabled: true,
    };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('ext-fetch-url', async (_, url, options = {}) => {
  try {
    if (!url || typeof url !== 'string') return { error: 'Invalid URL' };
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return { error: 'Only HTTP/HTTPS allowed' };
    // SSRF protection: block localhost, loopback, and private/internal IPs
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' ||
        host.endsWith('.local') || host.endsWith('.internal') ||
        /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) || /^fc00:/i.test(host) || /^fe80:/i.test(host) || /^fd/i.test(host)) {
      return { error: 'Access to internal/private addresses is not allowed' };
    }
    const resp = await fetch(url, {
      headers: options.headers || { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(options.timeout || 15000),
    });
    if (!resp.ok) return { error: `HTTP ${resp.status}`, status: resp.status };
    // Support base64 response for binary data (images, etc.)
    if (options.responseType === 'base64') {
      const buf = Buffer.from(await resp.arrayBuffer());
      return { ok: true, status: resp.status, base64: buf.toString('base64'), contentType: resp.headers.get('content-type') || '' };
    }
    const text = await resp.text();
    return { ok: true, status: resp.status, body: text };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('ext-save-file', async (_, { base64, filename, source }) => {
  try {
    if (!base64 || !filename) return { error: 'Missing data or filename' };
    // Sanitize filename — strip path separators to prevent directory traversal
    const safeName = String(filename).replace(/[/\\:*?"<>|]/g, '_').slice(0, 255);
    const downloadsPath = require('path').join(require('os').homedir(), 'Downloads');
    let finalPath = require('path').join(downloadsPath, safeName);
    // Avoid overwriting — append (1), (2), etc.
    const ext = require('path').extname(safeName);
    const base = safeName.slice(0, safeName.length - ext.length);
    let counter = 1;
    while (require('fs').existsSync(finalPath)) {
      finalPath = require('path').join(downloadsPath, `${base} (${counter})${ext}`);
      counter++;
    }
    // Strip data URL prefix if present
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const buf = Buffer.from(raw, 'base64');
    require('fs').writeFileSync(finalPath, buf);
    const savedName = require('path').basename(finalPath);

    // Register in Downloads panel so it shows in the sidebar
    const dl = {
      id: Date.now(),
      filename: savedName,
      url: source || 'Extension',
      totalBytes: buf.length,
      receivedBytes: buf.length,
      state: 'completed',
      savePath: finalPath,
      startTime: Date.now(),
      source: source || 'Extension',
    };
    downloads.push(dl);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-started', dl);
      mainWindow.webContents.send('download-done', dl);
    }

    return { ok: true, path: finalPath, filename: savedName };
  } catch (e) {
    return { error: e.message };
  }
});

let proxyActive = false;

ipcMain.handle('set-proxy', async (_, { type, host, port, username, password }) => {
  try {
    const ses = session.defaultSession;
    let proxyRules = '';

    if (type === 'socks5') {
      proxyRules = `socks5://${host}:${port}`;
    } else if (type === 'socks4') {
      proxyRules = `socks4://${host}:${port}`;
    } else if (type === 'http' || type === 'https') {
      proxyRules = `http://${host}:${port}`;
    } else {
      return { error: 'Unsupported proxy type' };
    }

    await ses.setProxy({ proxyRules, proxyBypassRules: '<local>' });

    // Store proxy auth for injection in the existing onBeforeSendHeaders handler
    if (username && password) {
      global._flipProxyAuth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    } else {
      global._flipProxyAuth = null;
    }

    proxyActive = true;
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('clear-proxy', async () => {
  try {
    const ses = session.defaultSession;
    await ses.setProxy({ proxyRules: '', proxyBypassRules: '' });
    global._flipProxyAuth = null;
    proxyActive = false;
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('get-proxy-status', () => {
  return { active: proxyActive };
});

ipcMain.handle('check-ip', async () => {
  try {
    // Use Electron's net module to check IP through the current session proxy
    return new Promise((resolve) => {
      const request = net.request('https://api.ipify.org?format=json');
      let body = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => { body += chunk.toString(); });
        response.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ ip: data.ip });
          } catch {
            resolve({ ip: body.trim() });
          }
        });
      });
      request.on('error', (err) => {
        resolve({ error: err.message });
      });
      request.end();
    });
  } catch (e) {
    return { error: e.message };
  }
});

// Clear browsing data (cache, cookies, storage)
ipcMain.handle('clear-browsing-data', async (_, options = {}) => {
  try {
    const ses = session.defaultSession;
    const clearOptions = {};
    if (options.cache !== false) {
      await ses.clearCache();
    }
    if (options.storage !== false) {
      await ses.clearStorageData({
        storages: ['cachestorage', 'serviceworkers'],
      });
    }
    if (options.cookies) {
      await ses.clearStorageData({ storages: ['cookies'] });
    }
    return { success: true };
  } catch (e) {
    console.error('Failed to clear browsing data:', e);
    return { success: false, error: e.message };
  }
});

// Get blocked ads count
let blockedCount = 0;
ipcMain.handle('get-blocked-count', () => blockedCount);

// Toggle ad blocker / tracking protection from renderer
ipcMain.handle('set-ad-block', (_, enabled) => {
  adBlockEnabled = enabled;
  return adBlockEnabled;
});
ipcMain.handle('set-tracking-protection', (_, enabled) => {
  trackingProtectionEnabled = enabled;
  return trackingProtectionEnabled;
});

// Enhanced ad blocker APIs
ipcMain.handle('adblock-stats', () => adblock.getStats());
ipcMain.handle('adblock-toggle-site', (_, hostname) => adblock.toggleWhitelist(hostname));
ipcMain.handle('adblock-is-whitelisted', (_, hostname) => adblock.isWhitelisted(hostname));
ipcMain.handle('adblock-get-whitelist', () => adblock.getWhitelist());
ipcMain.handle('adblock-cosmetic-css', (_, hostname) => adblock.getCosmeticCSS(hostname));
ipcMain.handle('adblock-force-update', () => adblock.forceUpdate());

// Bookmark and history storage
const dataDir = path.join(app.getPath('userData'), 'flip-data');
wallet.setDataDir(dataDir);
adblock.setDataDir(dataDir);
// Defer adblock initialization until app is ready (net module requires it)
app.whenReady().then(() => adblock.initialize());
const bookmarksFile = path.join(dataDir, 'bookmarks.json');
const historyFile = path.join(dataDir, 'history.json');
const pinnedTabsFile = path.join(dataDir, 'pinned-tabs.json');
const settingsFile = path.join(dataDir, 'settings.json');
const passwordsFile = path.join(dataDir, 'passwords.json');
const notifFile = path.join(dataDir, 'notifications.json');
const licenseFile = path.join(dataDir, 'license.json');
const licenseBackupFile = path.join(dataDir, 'license-key.bak');

// License validation config
const LICENSE_API_URL = 'https://flipdown-silk.vercel.app/api/validate-license';

// Generate a stable machine fingerprint (uses hardware + platform for stability across updates)
function getMachineId() {
  const crypto = require('crypto');
  const os = require('os');
  // Primary: platform + arch + cpu model + username (stable across app updates)
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
  const primary = `${os.platform()}-${os.arch()}-${cpuModel}-${os.userInfo().username}`;
  return crypto.createHash('sha256').update(primary).digest('hex').slice(0, 16);
}

// Legacy machine ID for backward compat (hostname + username)
function getLegacyMachineId() {
  const crypto = require('crypto');
  const os = require('os');
  return crypto.createHash('sha256')
    .update(os.hostname() + os.userInfo().username)
    .digest('hex').slice(0, 16);
}

// Read the plaintext backup license key (survives safeStorage encryption changes)
function readLicenseBackup() {
  try {
    if (!fs.existsSync(licenseBackupFile)) return null;
    const raw = fs.readFileSync(licenseBackupFile, 'utf-8').trim();
    if (raw.length >= 10) return raw;
    return null;
  } catch { return null; }
}

// Write plaintext backup of just the license key
function writeLicenseBackup(licenseKey) {
  try { fs.writeFileSync(licenseBackupFile, licenseKey, 'utf-8'); } catch {}
}

// Read license data (encrypted via safeStorage, with backup fallback)
function readLicenseData() {
  ensureDataDir();
  if (!fs.existsSync(licenseFile)) return null;
  try {
    const raw = fs.readFileSync(licenseFile);
    if (raw.length === 0) return null;
    // Detect plaintext JSON — auto-migrate to encrypted
    const first = raw[0];
    if (first === 0x7b) { // starts with {
      const data = JSON.parse(raw.toString('utf-8'));
      writeLicenseData(data); // re-save encrypted
      return data;
    }
    if (safeStorage.isEncryptionAvailable()) {
      return JSON.parse(safeStorage.decryptString(raw));
    }
    return null;
  } catch {
    // Decryption failed (likely after browser update changed safeStorage keys)
    // Try to recover from plaintext backup
    const backupKey = readLicenseBackup();
    if (backupKey) {
      console.log('[License] Encrypted file unreadable — recovering from backup');
      return { activated: true, licenseKey: backupKey, machineId: getMachineId(), recovered: true };
    }
    return null;
  }
}

// Write license data (encrypted via safeStorage + plaintext backup)
function writeLicenseData(data) {
  ensureDataDir();
  const json = JSON.stringify(data);
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(licenseFile, safeStorage.encryptString(json));
  } else {
    fs.writeFileSync(licenseFile, json);
  }
  // Always write a plaintext backup of just the key for update recovery
  if (data.licenseKey) writeLicenseBackup(data.licenseKey);
}

// Check if browser is activated (re-validates with server on every launch)
ipcMain.handle('license-check', async () => {
  try {
    let data = readLicenseData();
    if (!data || !data.activated || !data.licenseKey) {
      // Last resort: check if backup key exists even if license.json is gone
      const backupKey = readLicenseBackup();
      if (backupKey) {
        console.log('[License] license.json missing but backup key found — attempting recovery');
        data = { activated: true, licenseKey: backupKey, machineId: getMachineId(), recovered: true };
      } else {
        return { activated: false };
      }
    }

    // Verify machineId matches this device (check both current and legacy IDs for compat)
    const machineId = getMachineId();
    const legacyId = getLegacyMachineId();
    if (data.machineId && data.machineId !== machineId && data.machineId !== legacyId) {
      // License file from a different machine — invalid
      try { fs.unlinkSync(licenseFile); } catch {}
      return { activated: false };
    }

    // Re-validate with server (catch revoked keys + stolen license files)
    try {
      const resp = await fetch(LICENSE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: data.licenseKey, machineId }),
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const result = await resp.json();
        if (!result.valid) {
          // Server rejected — key revoked or activated on another device
          try { fs.unlinkSync(licenseFile); } catch {}
          try { fs.unlinkSync(licenseBackupFile); } catch {}
          return { activated: false };
        }
      }
      // If server unreachable, allow offline grace (don't lock out)
    } catch {
      // Network error — allow offline use
    }

    // If this was a recovery or machineId migration, re-encrypt with current keys
    if (data.recovered || (data.machineId && data.machineId !== machineId)) {
      writeLicenseData({
        activated: true,
        licenseKey: data.licenseKey,
        activatedAt: data.activatedAt || new Date().toISOString(),
        machineId,
      });
      console.log('[License] Re-encrypted license data after update recovery');
    }

    return { activated: true, licenseKey: data.licenseKey };
  } catch { return { activated: false }; }
});

// Validate and activate license
ipcMain.handle('license-activate', async (_, licenseKey) => {
  try {
    if (!licenseKey || licenseKey.trim().length < 10) return { valid: false, error: 'Invalid key format' };

    const machineId = getMachineId();

    const resp = await fetch(LICENSE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: licenseKey.trim().toUpperCase(), machineId }),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return { valid: false, error: `Server error (${resp.status})` };
    const result = await resp.json();

    if (result.valid) {
      writeLicenseData({
        activated: true,
        licenseKey: licenseKey.trim().toUpperCase(),
        activatedAt: new Date().toISOString(),
        machineId,
      });
      return { valid: true };
    }

    return { valid: false, error: result.error || 'Invalid license key' };
  } catch (e) {
    return { valid: false, error: e.message };
  }
});

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// All user data is encrypted at rest. Plaintext files are auto-migrated on first read.
function encryptedWrite(filePath, data) {
  ensureDataDir();
  const json = JSON.stringify(data, null, 2);
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(filePath, safeStorage.encryptString(json));
  } else {
    fs.writeFileSync(filePath, json);
  }
}

function encryptedRead(filePath, fallback) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath);
    if (raw.length === 0) return fallback;
    // Detect plaintext JSON (starts with [ { " or n for null) — auto-migrate to encrypted
    const first = raw[0];
    if (first === 0x5b || first === 0x7b || first === 0x22 || first === 0x6e) {
      const data = JSON.parse(raw.toString('utf-8'));
      // Re-save as encrypted
      encryptedWrite(filePath, data);
      return data;
    }
    // Already encrypted binary — decrypt with AES-256
    if (safeStorage.isEncryptionAvailable()) {
      return JSON.parse(safeStorage.decryptString(raw));
    }
    return fallback;
  } catch (e) {
    console.error(`[Crypto] Failed to read ${path.basename(filePath)}:`, e.message);
    return fallback;
  }
}

ipcMain.handle('get-bookmarks', () => encryptedRead(bookmarksFile, []));

ipcMain.handle('save-bookmarks', (_, bookmarks) => {
  encryptedWrite(bookmarksFile, bookmarks);
  return true;
});

ipcMain.handle('get-history', () => encryptedRead(historyFile, []));

ipcMain.handle('add-history', (_, entry) => {
  let history = encryptedRead(historyFile, []);
  history.unshift({ ...entry, timestamp: Date.now() });
  if (history.length > 1000) history = history.slice(0, 1000);
  encryptedWrite(historyFile, history);
  return true;
});

// Pinned tabs persistence
ipcMain.handle('get-pinned-tabs', () => encryptedRead(pinnedTabsFile, []));

ipcMain.handle('save-pinned-tabs', (_, tabs) => {
  encryptedWrite(pinnedTabsFile, tabs);
  return true;
});

// Settings persistence
ipcMain.handle('get-settings', () => {
  const settings = encryptedRead(settingsFile, null);
  if (settings && settings.searchEngine && settings.searchEngine.includes('google.com')) {
    settings.searchEngine = 'https://duckduckgo.com/?q=';
    encryptedWrite(settingsFile, settings);
  }
  return settings;
});

ipcMain.handle('save-settings', (_, settings) => {
  encryptedWrite(settingsFile, settings);
  return true;
});

// Password manager (AES-256 encrypted)
ipcMain.handle('get-passwords', () => encryptedRead(passwordsFile, []));

ipcMain.handle('save-passwords', (_, passwords) => {
  encryptedWrite(passwordsFile, passwords);
  return true;
});

ipcMain.handle('wallet-has', () => wallet.hasWallet());
ipcMain.handle('wallet-create', () => wallet.createWallet());
ipcMain.handle('wallet-import', (_, mnemonicOrKey) => wallet.importWallet(mnemonicOrKey));
ipcMain.handle('wallet-info', () => wallet.getWalletInfo());
ipcMain.handle('wallet-export-mnemonic', () => wallet.exportMnemonic());
ipcMain.handle('wallet-delete', () => wallet.deleteWallet());
ipcMain.handle('wallet-balance', (_, testnet) => wallet.getBalance(testnet));
ipcMain.handle('wallet-send-usdc', (_, to, amount, testnet) => wallet.sendUsdc(to, amount, testnet));
ipcMain.handle('wallet-send-eth', (_, to, amount, testnet) => wallet.sendEth(to, amount, testnet));
ipcMain.handle('wallet-sign-x402', (_, paymentReq) => wallet.signX402Payment(paymentReq));
ipcMain.handle('wallet-tx-history', () => wallet.getTxHistory());
ipcMain.handle('wallet-add-tx', (_, entry) => wallet.addTxRecord(entry));

const autofillFile = path.join(dataDir, 'autofill.json');

ipcMain.handle('get-autofill', () => encryptedRead(autofillFile, { addresses: [], payments: [] }));

ipcMain.handle('save-autofill', (_, data) => {
  encryptedWrite(autofillFile, data);
  return true;
});

ipcMain.handle('get-notification-permissions', () => encryptedRead(notifFile, {}));

ipcMain.handle('save-notification-permissions', (_, perms) => {
  encryptedWrite(notifFile, perms);
  return true;
});

ipcMain.handle('get-app-metrics', () => {
  try {
    const metrics = app.getAppMetrics();
    return metrics.map(m => ({
      pid: m.pid,
      type: m.type,
      cpu: m.cpu,
      memory: m.memory, // workingSetSize in KB
      name: m.name || m.type,
    }));
  } catch { return []; }
});

ipcMain.handle('get-process-memory', () => {
  try {
    return process.memoryUsage();
  } catch { return {}; }
});

const musicSettingsFile = path.join(dataDir, 'music-folder.json');
let allowedMusicFolder = null;
try {
  if (fs.existsSync(musicSettingsFile)) {
    const saved = JSON.parse(fs.readFileSync(musicSettingsFile, 'utf-8'));
    if (saved && saved.folder && fs.existsSync(saved.folder)) allowedMusicFolder = saved.folder;
  }
} catch {}

ipcMain.handle('pick-music-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Music Folder',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const folder = result.filePaths[0];
  allowedMusicFolder = folder;
  try { fs.writeFileSync(musicSettingsFile, JSON.stringify({ folder })); } catch {}
  try {
    const files = fs.readdirSync(folder)
      .filter(f => /\.(mp3|wav|ogg|flac|m4a|aac|wma)$/i.test(f))
      .map(f => ({ name: f }));
    console.log('[Music] Folder selected:', folder, '— found', files.length, 'tracks');
    return { folder, files };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('import-bookmarks-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Bookmarks',
    filters: [
      { name: 'Bookmarks', extensions: ['html', 'json'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    const ext = path.extname(result.filePaths[0]).toLowerCase();
    if (ext === '.json') {
      return { type: 'json', data: JSON.parse(content) };
    }
    // Parse HTML bookmarks (Netscape format from Chrome/Firefox)
    const bookmarks = [];
    const regex = /<A HREF="([^"]*)"[^>]*>([^<]*)<\/A>/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      bookmarks.push({ url: match[1], title: match[2], id: Date.now() + bookmarks.length });
    }
    return { type: 'html', data: bookmarks };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('export-bookmarks-file', async (_, bookmarks) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Bookmarks',
    defaultPath: 'flip-bookmarks.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled) return false;
  fs.writeFileSync(result.filePath, JSON.stringify(bookmarks, null, 2));
  return true;
});

ipcMain.handle('import-passwords-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Passwords',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { data: [] };
    const header = lines[0].toLowerCase();
    const passwords = [];
    for (let i = 1; i < lines.length; i++) {
      // Handle CSV with possible quoted fields
      const cols = lines[i].match(/(".*?"|[^,]+)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || [];
      if (cols.length >= 3) {
        // Chrome CSV: name,url,username,password | Firefox CSV: url,username,password
        const hasName = cols.length >= 4;
        passwords.push({
          id: Date.now() + i,
          site: hasName ? cols[1] : cols[0],
          username: hasName ? cols[2] : cols[1],
          password: hasName ? cols[3] : cols[2],
        });
      }
    }
    return { data: passwords };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('export-passwords-file', async (_, passwords) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Passwords',
    defaultPath: 'flip-passwords.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (result.canceled) return false;
  const header = 'name,url,username,password\n';
  const rows = passwords.map(p => `"Flip","${p.site}","${p.username}","${p.password}"`).join('\n');
  fs.writeFileSync(result.filePath, header + rows);
  return true;
});

const shortcutsFile = path.join(dataDir, 'shortcuts.json');
const sessionFile = path.join(dataDir, 'session.json');
const profilesFile = path.join(dataDir, 'profiles.json');
const siteSettingsFile = path.join(dataDir, 'site-settings.json');
const readerSettingsFile = path.join(dataDir, 'reader-settings.json');

ipcMain.handle('get-shortcuts', () => encryptedRead(shortcutsFile, null));

ipcMain.handle('save-shortcuts', (_, shortcuts) => {
  encryptedWrite(shortcutsFile, shortcuts);
  return true;
});

ipcMain.handle('save-session', (_, tabs) => {
  encryptedWrite(sessionFile, tabs);
  return true;
});

ipcMain.handle('get-session', () => encryptedRead(sessionFile, []));

const namedSessionsFile = path.join(dataDir, 'named-sessions.json');
ipcMain.handle('save-named-session', (_, { name, tabs }) => {
  ensureDataDir();
  const sessions = encryptedRead(namedSessionsFile, []);
  const snapshot = { id: Date.now(), name, tabs, createdAt: new Date().toISOString() };
  sessions.push(snapshot);
  encryptedWrite(namedSessionsFile, sessions);
  return snapshot;
});
ipcMain.handle('get-named-sessions', () => encryptedRead(namedSessionsFile, []));
ipcMain.handle('load-named-session', (_, sessionId) => {
  const sessions = encryptedRead(namedSessionsFile, []);
  return sessions.find(s => s.id === sessionId) || null;
});
ipcMain.handle('delete-named-session', (_, sessionId) => {
  const sessions = encryptedRead(namedSessionsFile, []);
  const updated = sessions.filter(s => s.id !== sessionId);
  encryptedWrite(namedSessionsFile, updated);
  return true;
});

const workspacesFile = path.join(dataDir, 'workspaces.json');
ipcMain.handle('save-workspaces', (_, workspaces) => {
  ensureDataDir();
  encryptedWrite(workspacesFile, workspaces);
  return true;
});
ipcMain.handle('get-workspaces', () => encryptedRead(workspacesFile, []));

function getProfiles() {
  return encryptedRead(profilesFile, { active: 'Default', profiles: [{ name: 'Default', created: Date.now() }] });
}

function saveProfiles(data) {
  encryptedWrite(profilesFile, data);
}

ipcMain.handle('get-profiles', () => getProfiles());

ipcMain.handle('create-profile', (_, name) => {
  const data = getProfiles();
  if (data.profiles.some(p => p.name === name)) return { error: 'Profile already exists' };
  data.profiles.push({ name, created: Date.now() });
  // Create profile data directory
  const profileDir = path.join(dataDir, 'profiles', name);
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
  saveProfiles(data);
  return { success: true, profiles: data };
});

ipcMain.handle('switch-profile', (_, name) => {
  const data = getProfiles();
  if (!data.profiles.some(p => p.name === name)) return { error: 'Profile not found' };
  // Save current profile's data
  const currentDir = path.join(dataDir, 'profiles', data.active);
  if (!fs.existsSync(currentDir)) fs.mkdirSync(currentDir, { recursive: true });
  const filesToCopy = ['bookmarks.json', 'history.json', 'passwords.json', 'settings.json', 'autofill.json', 'shortcuts.json', 'notifications.json'];
  filesToCopy.forEach(f => {
    const src = path.join(dataDir, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(currentDir, f));
  });
  // Load new profile's data
  const newDir = path.join(dataDir, 'profiles', name);
  if (fs.existsSync(newDir)) {
    filesToCopy.forEach(f => {
      const src = path.join(newDir, f);
      const dest = path.join(dataDir, f);
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
      else if (fs.existsSync(dest)) fs.unlinkSync(dest);
    });
  }
  data.active = name;
  saveProfiles(data);
  return { success: true, profiles: data };
});

ipcMain.handle('delete-profile', (_, name) => {
  const data = getProfiles();
  if (name === 'Default') return { error: 'Cannot delete Default profile' };
  if (data.active === name) return { error: 'Cannot delete active profile' };
  data.profiles = data.profiles.filter(p => p.name !== name);
  const profileDir = path.join(dataDir, 'profiles', name);
  if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true });
  saveProfiles(data);
  return { success: true, profiles: data };
});

ipcMain.handle('get-site-settings', () => encryptedRead(siteSettingsFile, {}));

ipcMain.handle('save-site-settings', (_, settings) => {
  encryptedWrite(siteSettingsFile, settings);
  return true;
});

ipcMain.handle('get-reader-settings', () => encryptedRead(readerSettingsFile, { fontSize: 18, fontFamily: 'serif', bgColor: '#1a1a1a', textColor: '#e0e0e0' }));

ipcMain.handle('save-reader-settings', (_, settings) => {
  encryptedWrite(readerSettingsFile, settings);
  return true;
});

ipcMain.handle('save-pdf', async (_, data, fileName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save as PDF',
    defaultPath: `${fileName || 'page'}.pdf`,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });
  if (result.canceled) return false;
  fs.writeFileSync(result.filePath, Buffer.from(data));
  return result.filePath;
});

ipcMain.handle('save-screenshot', async (_, dataUrl) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Screenshot',
    defaultPath: `flip-screenshot-${Date.now()}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (result.canceled) return false;
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
  return result.filePath;
});

// Download tracking
let downloads = [];
ipcMain.handle('get-downloads', () => downloads);

// Global error handlers to prevent flash crashes
process.on('uncaughtException', (err) => {
  console.error('[Flip] Uncaught exception:', err);
});
// unhandledRejection is already handled at the top of the file (with ERR_ABORTED filtering)

let changelog = {};
try {
  // Try app root first (works both in dev and packaged)
  let clPath = path.join(__dirname, '..', 'changelog.json');
  if (!fs.existsSync(clPath)) {
    // Fallback: same directory as main.js
    clPath = path.join(__dirname, 'changelog.json');
  }
  if (!fs.existsSync(clPath)) {
    // Fallback: process.resourcesPath (for extraResources)
    clPath = path.join(process.resourcesPath || '', 'changelog.json');
  }
  if (fs.existsSync(clPath)) {
    changelog = JSON.parse(fs.readFileSync(clPath, 'utf-8'));
    console.log('[Changelog] Loaded', Object.keys(changelog).length, 'versions from', clPath);
  } else {
    console.warn('[Changelog] changelog.json not found');
  }
} catch (e) { console.warn('[Changelog] Failed to load:', e.message); }

function getNotesForVersion(version) {
  if (!version) return [];
  const v = version.replace(/^v/, '');
  // Exact match first, then try without patch
  return changelog[v] || changelog[version] || [];
}

// Get the latest changelog entry regardless of version match
function getLatestNotes() {
  const versions = Object.keys(changelog);
  if (versions.length === 0) return [];
  return changelog[versions[0]] || [];
}

ipcMain.handle('get-changelog', () => changelog);

const lastSeenVersionFile = path.join(dataDir, 'last-seen-version.txt');

ipcMain.handle('get-whats-new', () => {
  const currentVersion = app.getVersion();
  ensureDataDir();
  let lastSeen = null;
  try { lastSeen = fs.readFileSync(lastSeenVersionFile, 'utf-8').trim(); } catch {}
  console.log('[WhatsNew] current:', currentVersion, 'lastSeen:', lastSeen);
  if (lastSeen === currentVersion) return null;
  // Mark as seen immediately
  try { fs.writeFileSync(lastSeenVersionFile, currentVersion); } catch {}
  // Try exact version notes, fall back to latest changelog entry
  let notes = getNotesForVersion(currentVersion);
  if (!notes.length) notes = getLatestNotes();
  console.log('[WhatsNew] Returning', notes.length, 'notes for', currentVersion);
  return { version: currentVersion, notes };
});

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = { info: (...a) => console.log('[Updater]', ...a), warn: (...a) => console.warn('[Updater]', ...a), error: (...a) => console.error('[Updater]', ...a) };

function sendUpdateStatus(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', data);
  }
}

// Parse raw release notes from electron-updater (HTML/markdown) into clean string array
function parseReleaseNotes(raw) {
  if (!raw) return [];
  // Already a clean array of strings
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw;
  // electron-updater sometimes returns [{version, note}]
  if (Array.isArray(raw) && raw[0]?.note) return raw.map(r => r.note).filter(Boolean);
  if (typeof raw !== 'string') return [];
  // Strip HTML tags
  let text = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+>/g, '');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  // Split by newlines or bullet markers
  const lines = text.split(/[\n\r]+/).map(l => l.replace(/^[\s\-\*•]+/, '').trim()).filter(l => l.length > 0);
  return lines;
}

autoUpdater.on('checking-for-update', () => {
  sendUpdateStatus({ status: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  const notes = getNotesForVersion(info.version);
  sendUpdateStatus({ status: 'available', version: info.version, releaseDate: info.releaseDate, releaseNotes: notes.length ? notes : parseReleaseNotes(info.releaseNotes) });
});

autoUpdater.on('update-not-available', (info) => {
  sendUpdateStatus({ status: 'up-to-date', version: info.version });
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus({ status: 'downloading', percent: progress.percent, bytesPerSecond: progress.bytesPerSecond, transferred: progress.transferred, total: progress.total });
});

autoUpdater.on('update-downloaded', (info) => {
  const notes = getNotesForVersion(info.version);
  sendUpdateStatus({ status: 'ready', version: info.version, releaseNotes: notes.length ? notes : parseReleaseNotes(info.releaseNotes) });
});

autoUpdater.on('error', (err) => {
  sendUpdateStatus({ status: 'error', message: err?.message || 'Unknown error' });
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, version: result?.updateInfo?.version };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

function startWatcherPolling() {
  const watchersFile = path.join(dataDir, 'watchers.json');
  setInterval(async () => {
    let watchers;
    try { watchers = JSON.parse(fs.readFileSync(watchersFile, 'utf-8')) || []; } catch { return; }
    if (watchers.length === 0) return;
    let changed = false;
    for (const w of watchers) {
      const elapsed = (Date.now() - new Date(w.lastChecked).getTime()) / 60000;
      if (elapsed < w.intervalMinutes) continue;
      try {
        const resp = await fetch(w.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(10000),
        });
        let content = await resp.text();
        content = content.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        w.lastChecked = new Date().toISOString();
        if (hash !== w.lastHash) {
          w.lastHash = hash;
          w.changeDetected = true;
          changed = true;
          console.log(`[Watcher] Change detected: ${w.label} (${w.url})`);
          // Send OS notification
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            const notif = new Notification({ title: 'Page Changed — ' + w.label, body: w.url });
            notif.on('click', () => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.webContents.send('open-url-in-tab', w.url); mainWindow.focus(); } });
            notif.show();
          }
          // Also notify renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('watcher-change', { id: w.id, label: w.label, url: w.url });
          }
        }
      } catch (e) { console.error(`[Watcher] Error checking ${w.label}:`, e.message); }
    }
    if (changed) {
      try { fs.writeFileSync(watchersFile, JSON.stringify(watchers, null, 2)); } catch {}
    }
  }, 60000); // Check every 60 seconds which watchers are due
}

// App lifecycle
app.whenReady().then(() => {
  try {
    // Verify file integrity before anything else (production only)
    if (!verifyIntegrity()) return;

    // Register flip-music:// protocol handler for streaming local audio
    protocol.handle('flip-music', (request) => {
      try {
        const url = new URL(request.url);
        const filename = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
        if (!allowedMusicFolder) return new Response('No folder selected', { status: 403 });
        const filePath = path.join(allowedMusicFolder, filename);
        const resolved = path.resolve(filePath);
        if (!resolved.toLowerCase().startsWith(path.resolve(allowedMusicFolder).toLowerCase())) {
          return new Response('Access denied', { status: 403 });
        }
        if (!fs.existsSync(resolved)) return new Response('Not found', { status: 404 });
        const ext = path.extname(resolved).toLowerCase().replace('.', '');
        const mimeMap = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', wma: 'audio/x-ms-wma' };
        const mime = mimeMap[ext] || 'application/octet-stream';
        const stat = fs.statSync(resolved);
        const stream = fs.readFileSync(resolved);
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(stat.size),
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (e) {
        console.error('[Music Protocol] Error:', e.message);
        return new Response(e.message, { status: 500 });
      }
    });

    createWindow();
    startWatcherPolling();
    // Auto-update installed extensions from marketplace (10s after launch)
    setTimeout(() => autoUpdateExtensions(), 10000);
    // Check for updates 5 seconds after launch (only in production)
    if (!isDev) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((e) => console.error('[Updater] Auto-check failed:', e?.message));
      }, 5000);
      // Re-check every 30 minutes
      setInterval(() => {
        autoUpdater.checkForUpdates().catch((e) => console.error('[Updater] Auto-check failed:', e?.message));
      }, 30 * 60 * 1000);
    }
  } catch (err) {
    console.error('[Flip] Failed to create window:', err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Security: prevent new windows from being created (except extension-allowed popups)
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // Allow popup if URL matches an extension's allowed_navigation list
    for (const allowed of allowedPopupUrls) {
      if (url === allowed || url.startsWith(allowed)) {
        return { action: 'allow' };
      }
    }
    // Otherwise open as a browser tab
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('open-url-in-tab', url);
    }
    return { action: 'deny' };
  });
});

// Certificate info IPC
ipcMain.handle('get-certificate-info', async (_, url) => {
  try {
    if (!url || !url.startsWith('https://')) return { secure: false, protocol: 'http' };
    const hostname = getHostname(url);
    return { secure: true, protocol: 'https', hostname };
  } catch {
    return { secure: false, protocol: 'unknown' };
  }
});

// Security settings IPC
ipcMain.handle('set-https-only', (_, enabled) => { httpsOnlyMode = enabled; return httpsOnlyMode; });
ipcMain.handle('set-fingerprint-protection', (_, enabled) => { fingerprintProtection = enabled; return fingerprintProtection; });
ipcMain.handle('get-security-status', () => ({
  httpsOnly: httpsOnlyMode,
  fingerprintProtection,
  adBlock: adBlockEnabled,
  trackingProtection: trackingProtectionEnabled,
  dohEnabled: true, // always on via command line
}));

const AI_CONFIG_FILE = path.join(dataDir, 'ai-config.json');
const FLIP_SYSTEM_PROMPT = `You are **Flip AI**, the built-in AI assistant of **Flip Browser**.

## Who you are
- You are NOT a generic AI chatbot. You are a native feature of Flip Browser, deeply integrated into the browser itself.
- You live in the sidebar panel and can see, read, and interact with the user's browsing session.
- You were created by **CROAKWORKS** (https://croak.work), the same team that built Flip Browser.
- Flip Browser is a privacy-first, extensible web browser built on Electron + React by CROAKWORKS, first released in 2026.

## About Flip Browser
- **Privacy by default** — Built-in ad & tracker blocker at the network level, HTTPS-only mode, DNS-over-HTTPS via Cloudflare, fingerprint protection (canvas, WebGL, AudioContext, navigator spoofing).
- **React extension system** — Extensions are single-file React (JSX) apps running in sandboxed iframes. Developers build sidebar extensions using React, not traditional WebExtension APIs.
- **UI** — Dark theme with coral/orange primaries and teal accents. Sidebar on the left (tabs, bookmarks, history, downloads, passwords, crypto tracker, VPN, autofill, notifications, performance, shortcuts, settings). Address bar on top with navigation, search, reading mode, PiP, and extension toolbar actions.
- **Key features:** Tab management (pin, suspend, split view), bookmarks bar, command palette (Ctrl+K), password manager (encrypted via OS keychain), reading mode, picture-in-picture, download manager, crypto tracker (CoinGecko), VPN/proxy support, autofill manager, keyboard shortcut customization, screenshot tool, session restore, user profiles, OTA auto-updates, site-specific settings (zoom, JS, cookies per domain), WebRTC enhancements.
- **Built-in extensions:** Community Chat, AI Chat (you!), Weather Widget, Quick Notes, Music Player, JSON Formatter, Color Picker, Regex Tester, Mimo Messenger, FlipPRX Game, FlipPRX Miner.
- **Security:** Electron Fuses (no RunAsNode, no NODE_OPTIONS, no --inspect), ASAR integrity validation, runtime SHA-256 integrity checks, extension sandboxing with CSP, rate limiting, permission system.
- **Tech stack:** Electron, React 18, Zustand (state), Tailwind CSS, Vite, electron-builder.

## Your capabilities
You can perform browser actions using your tools:
- Read the current page's content, title, URL, and metadata (meta tags, headings, links, images)
- Read selected/highlighted text on the page
- Get all open tabs, create new tabs, close tabs, navigate tabs
- Pin/unpin tabs, duplicate tabs, switch between tabs, close all other tabs
- Search the web (DuckDuckGo) and fetch/read any URL's content
- Open any URL in a new tab
- Get the user's browsing history and bookmarks, add bookmarks
- Find text on the current page (like Ctrl+F)
- Extract structured data from pages: emails, phone numbers, prices, social links
- Extract HTML tables as structured JSON data
- Inject custom CSS to restyle any page (hide ads, change fonts, dark mode, etc.)
- Take a screenshot of the current page
- Toggle reading mode on the current page
- **YouTube Summarizer** — Get the transcript/captions of any YouTube video the user is watching, then summarize it with timestamps
- **Read Aloud (TTS)** — Read any text or page content aloud using text-to-speech. You can also stop reading.
- **Writing Assistant** — Rewrite, fix grammar, paraphrase, translate, or change the tone of text. You can insert the result directly back into the user's active input field on the page.
- **Page Change Monitor** — Watch any URL for content changes. The browser checks periodically and sends an OS notification when a change is detected. You can add, list, and remove watchers.

## Personality & behavior
- Be concise, helpful, and knowledgeable about Flip Browser.
- When users ask about browser features, guide them using your knowledge of Flip's UI and capabilities.
- When users ask "who made you" or "what browser is this", answer with pride about Flip Browser and CROAKWORKS.
- Use your browser tools proactively when the user asks about a page — read it first, then respond.
- Format responses with markdown when helpful (bold, lists, code blocks).
- If a user asks you to do something you can't do, be honest and suggest alternatives within Flip's capabilities.`;

const AI_DEFAULT_CONFIG = {
  provider: 'ollama', // 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'custom'
  endpoint: 'http://localhost:11434',
  apiKey: '',
  model: '',
  systemPrompt: '',
};

const PROVIDER_ENDPOINTS = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
};

function getAiConfig() {
  try {
    const loaded = encryptedRead(AI_CONFIG_FILE, null);
    if (loaded) return { ...AI_DEFAULT_CONFIG, ...loaded };
  } catch {}
  return { ...AI_DEFAULT_CONFIG };
}

function saveAiConfig(config) {
  encryptedWrite(AI_CONFIG_FILE, config);
}

ipcMain.handle('ai-get-config', () => {
  const config = getAiConfig();
  return { ...config, apiKey: config.apiKey ? '••••••••' : '' };
});

ipcMain.handle('ai-save-config', (_, config) => {
  try {
    const existing = getAiConfig();
    // Don't overwrite key with masked value
    if (config.apiKey === '••••••••') config.apiKey = existing.apiKey;
    saveAiConfig({ ...existing, ...config });
    return true;
  } catch (e) {
    return { error: e.message };
  }
});

// Check if AI backend is reachable
ipcMain.handle('ai-is-available', async () => {
  const config = getAiConfig();
  try {
    const url = config.provider === 'ollama'
      ? `${config.endpoint}/api/tags`
      : `${config.endpoint}/v1/models`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const headers = {};
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    const resp = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timeout);
    return { available: resp.ok, provider: config.provider };
  } catch {
    return { available: false, provider: config.provider };
  }
});

// List available models
ipcMain.handle('ai-list-models', async () => {
  const config = getAiConfig();
  try {
    let url, headers = {};
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

    if (config.provider === 'ollama') {
      url = `${config.endpoint}/api/tags`;
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      return (data.models || []).map(m => ({ id: m.name, name: m.name, size: m.size }));
    } else {
      url = `${config.endpoint}/v1/models`;
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      return (data.data || []).map(m => ({ id: m.id, name: m.id }));
    }
  } catch (e) {
    return [];
  }
});

// Browser tools the AI can call
const BROWSER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_page_content',
      description: 'Get the text content of the currently active web page the user is viewing',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_page_title',
      description: 'Get the title, URL, and favicon of the active page',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_page_metadata',
      description: 'Get metadata from the active page: meta tags, headings (h1-h3), links, and image sources',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_selected_text',
      description: 'Get the text the user has currently selected/highlighted on the page',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_all_tabs',
      description: 'Get a list of all open tabs with their id, title, url, and pinned status',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_tab',
      description: 'Open a new tab with the given URL',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL to open' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_tab',
      description: 'Close a tab by its tab ID',
      parameters: {
        type: 'object',
        properties: { tabId: { type: 'number', description: 'ID of the tab to close' } },
        required: ['tabId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_tab',
      description: 'Navigate the current active tab to a new URL',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL to navigate to' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the web using DuckDuckGo and return the top results with titles, URLs, and snippets. Use this to find information online.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The search query' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_url',
      description: 'Open a URL in a new browser tab',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'The URL to open' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_url_content',
      description: 'Fetch and read the text content of any URL from the web. Use this after search_web to read a specific page. Returns the first 10000 characters of text.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'The URL to fetch and read' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_browsing_history',
      description: 'Get recent browsing history (last 30 entries) with titles, URLs, and timestamps',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bookmarks',
      description: 'Get the user\'s saved bookmarks list',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_bookmark',
      description: 'Bookmark the current page the user is viewing',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggle_reading_mode',
      description: 'Toggle reading mode on the current page for a clean, distraction-free view',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'take_screenshot',
      description: 'Take a screenshot/capture of the current page',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pin_tab',
      description: 'Pin or unpin the current active tab',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'duplicate_tab',
      description: 'Duplicate the current active tab',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'switch_tab',
      description: 'Switch to a specific open tab by its tab ID (use get_all_tabs first to see IDs)',
      parameters: {
        type: 'object',
        properties: { tabId: { type: 'number', description: 'ID of the tab to switch to' } },
        required: ['tabId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_other_tabs',
      description: 'Close all tabs except the current active tab',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_in_page',
      description: 'Search for text on the current page (like Ctrl+F). Returns the number of matches found.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: 'Text to search for on the page' } },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_page_data',
      description: 'Extract structured data from the current page: emails, phone numbers, prices, dates, and social media links',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_page_tables',
      description: 'Extract all HTML tables from the current page as structured JSON data (rows and columns)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inject_page_css',
      description: 'Inject custom CSS into the current page to change its appearance. Useful for hiding elements, changing colors, font sizes, etc.',
      parameters: {
        type: 'object',
        properties: { css: { type: 'string', description: 'CSS rules to inject into the page' } },
        required: ['css'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_youtube_transcript',
      description: 'Get the transcript/captions of a YouTube video the user is currently watching. Only works on youtube.com video pages.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_aloud',
      description: 'Read text aloud using text-to-speech. Use this when the user asks you to read a page, article, or text out loud.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text to read aloud. Keep under 2000 characters for best results.' },
          rate: { type: 'number', description: 'Speech rate from 0.5 to 3.0. Default 1.0' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop_reading',
      description: 'Stop any text-to-speech audio that is currently playing',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rewrite_text',
      description: 'Rewrite or transform text and optionally insert it back into the active input field on the page. Use this for grammar fixes, paraphrasing, tone changes, translations, etc.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The rewritten/transformed text to insert' },
          insertBack: { type: 'boolean', description: 'If true, replace the selected text in the active input field on the page with this text. If false, just return the text.' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'watch_page',
      description: 'Start monitoring a URL for content changes. The browser will check periodically and notify when the page content changes.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to monitor' },
          label: { type: 'string', description: 'Short label for this watcher (e.g. "Amazon price", "Job listing")' },
          intervalMinutes: { type: 'number', description: 'Check interval in minutes. Default 30.' },
          cssSelector: { type: 'string', description: 'Optional CSS selector to watch only a specific part of the page (e.g. ".price", "#stock-status")' },
        },
        required: ['url', 'label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_watchers',
      description: 'List all active page change monitors/watchers',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_watcher',
      description: 'Remove a page change monitor by its ID',
      parameters: {
        type: 'object',
        properties: { watcherId: { type: 'number', description: 'ID of the watcher to remove' } },
        required: ['watcherId'],
      },
    },
  },
];

// Helper: get the visible webview in the renderer
async function getActiveWebview(js) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  return mainWindow.webContents.executeJavaScript(`
    (function() {
      const wvs = document.querySelectorAll('webview');
      for (const wv of wvs) {
        if (wv.offsetParent !== null || wv.style.display !== 'none') {
          return new Promise(r => wv.executeJavaScript(${JSON.stringify(js)}).then(r).catch(() => r(null)));
        }
      }
      return null;
    })()
  `);
}

// Execute a browser tool call
async function executeBrowserTool(name, args) {
  switch (name) {
    case 'get_page_content': {
      try {
        const result = await getActiveWebview('document.body.innerText.slice(0, 12000)');
        return result || 'Empty page or no active page';
      } catch { return 'Could not read page content'; }
    }
    case 'get_page_title': {
      try {
        const result = await getActiveWebview('JSON.stringify({ title: document.title, url: location.href })');
        return result || JSON.stringify({ title: 'New Tab', url: 'flip://newtab' });
      } catch { return JSON.stringify({ title: 'Unknown', url: '' }); }
    }
    case 'get_page_metadata': {
      try {
        const result = await getActiveWebview(`JSON.stringify({
          title: document.title,
          url: location.href,
          description: document.querySelector('meta[name="description"]')?.content || '',
          keywords: document.querySelector('meta[name="keywords"]')?.content || '',
          ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
          ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
          ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
          headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 20).map(h => ({ tag: h.tagName, text: h.innerText.slice(0, 120) })),
          links: [...document.querySelectorAll('a[href]')].slice(0, 30).map(a => ({ text: a.innerText.slice(0, 60), href: a.href })),
          images: [...document.querySelectorAll('img[src]')].slice(0, 15).map(i => ({ alt: i.alt?.slice(0, 60) || '', src: i.src })),
          lang: document.documentElement.lang || '',
        })`);
        return result || '{}';
      } catch { return 'Could not read metadata'; }
    }
    case 'get_selected_text': {
      try {
        const result = await getActiveWebview('window.getSelection().toString()');
        return result || 'No text selected';
      } catch { return 'Could not get selected text'; }
    }
    case 'get_all_tabs': {
      if (!mainWindow || mainWindow.isDestroyed()) return '[]';
      try {
        const result = await mainWindow.webContents.executeJavaScript(`
          (function() {
            const wvs = document.querySelectorAll('webview');
            const tabs = [];
            wvs.forEach((wv, i) => {
              tabs.push({ id: i, title: wv.getTitle() || 'New Tab', url: wv.getURL() || '', visible: wv.offsetParent !== null || wv.style.display !== 'none' });
            });
            return JSON.stringify(tabs);
          })()
        `);
        return result || '[]';
      } catch { return '[]'; }
    }
    case 'create_tab': {
      const url = args?.url || 'flip://newtab';
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('open-url-in-tab', url);
      }
      return `Opened new tab: ${url}`;
    }
    case 'close_tab': {
      const tabId = args?.tabId;
      if (mainWindow && !mainWindow.isDestroyed() && tabId !== undefined) {
        mainWindow.webContents.send('ai-close-tab', tabId);
      }
      return `Closed tab ${tabId}`;
    }
    case 'navigate_tab': {
      const url = args?.url || '';
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai-navigate-current', url);
      }
      return `Navigating current tab to: ${url}`;
    }
    case 'search_web': {
      const q = args?.query || '';
      if (!q) return 'No query provided';
      console.log('[AI Tool] search_web:', q);
      try {
        // Fetch DuckDuckGo HTML lite results with timeout
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const resp = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(8000),
        });
        const html = await resp.text();
        console.log('[AI Tool] search_web got HTML, length:', html.length);
        // Parse results: each result link has class="result__a", snippet has class="result__snippet"
        const results = [];
        const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
        const titles = [...html.matchAll(resultRegex)];
        const snippets = [...html.matchAll(snippetRegex)];
        for (let i = 0; i < Math.min(titles.length, 8); i++) {
          const rawUrl = titles[i][1] || '';
          let url = rawUrl;
          const uddg = rawUrl.match(/uddg=([^&]+)/);
          if (uddg) url = decodeURIComponent(uddg[1]);
          const title = (titles[i][2] || '').replace(/<[^>]*>/g, '').trim();
          const snippet = (snippets[i]?.[1] || '').replace(/<[^>]*>/g, '').trim();
          if (title && url) results.push({ title, url, snippet });
        }
        console.log('[AI Tool] search_web parsed results:', results.length);
        if (results.length === 0) {
          // Fallback: try DuckDuckGo instant answer API
          try {
            const iaUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
            const iaResp = await fetch(iaUrl, { signal: AbortSignal.timeout(5000) });
            const ia = await iaResp.json();
            const answer = ia.AbstractText || ia.Answer || '';
            if (answer) return JSON.stringify({ query: q, answer, source: ia.AbstractURL || '' });
          } catch {}
          return `No results found for: ${q}. Try a different search query.`;
        }
        return JSON.stringify({ query: q, results });
      } catch (e) {
        console.error('[AI Tool] search_web error:', e.message);
        return `Web search failed (${e.message}). Try rephrasing the query or ask the user to search manually.`;
      }
    }
    case 'open_url': {
      const url = args?.url || '';
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('open-url-in-tab', url);
      }
      return `Opened: ${url}`;
    }
    case 'fetch_url_content': {
      const url = args?.url || '';
      if (!url) return 'No URL provided';
      // SSRF protection: block internal/private addresses
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' ||
            host.endsWith('.local') || host.endsWith('.internal') ||
            /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^192\.168\./.test(host) ||
            /^169\.254\./.test(host) || /^fc00:/i.test(host) || /^fe80:/i.test(host) || /^fd/i.test(host)) {
          return 'Access to internal/private addresses is not allowed';
        }
      } catch { return 'Invalid URL'; }
      console.log('[AI Tool] fetch_url_content:', url);
      try {
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(8000),
        });
        const html = await resp.text();
        // Strip HTML tags to get readable text
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[\s\S]*?<\/nav>/gi, '')
          .replace(/<footer[\s\S]*?<\/footer>/gi, '')
          .replace(/<header[\s\S]*?<\/header>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 10000);
        return text || 'Page returned no readable text content';
      } catch (e) {
        return `Could not fetch URL: ${e.message}`;
      }
    }
    case 'get_browsing_history': {
      try {
        const histPath = path.join(dataDir, 'history.json');
        const hist = encryptedRead(histPath, []);
        const recent = (hist || []).slice(-30).reverse();
        return JSON.stringify(recent.map(h => ({ title: h.title, url: h.url, time: h.timestamp })));
      } catch { return '[]'; }
    }
    case 'get_bookmarks': {
      try {
        const bmPath = path.join(dataDir, 'bookmarks.json');
        const data = encryptedRead(bmPath, []);
        return JSON.stringify((data || []).map(b => ({ title: b.title, url: b.url, favicon: b.favicon })));
      } catch { return '[]'; }
    }
    case 'add_bookmark': {
      try {
        const info = await getActiveWebview('JSON.stringify({ title: document.title, url: location.href })');
        if (!info) return 'No active page to bookmark';
        const parsed = JSON.parse(info);
        const bmPath = path.join(dataDir, 'bookmarks.json');
        let bookmarks = encryptedRead(bmPath, []) || [];
        if (bookmarks.some(b => b.url === parsed.url)) return `Already bookmarked: ${parsed.title}`;
        bookmarks.push({ title: parsed.title, url: parsed.url, favicon: '', addedAt: Date.now() });
        encryptedWrite(bmPath, bookmarks);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bookmarks-updated');
        return `Bookmarked: ${parsed.title} (${parsed.url})`;
      } catch { return 'Could not bookmark this page'; }
    }
    case 'toggle_reading_mode': {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai-toggle-reading-mode');
      }
      return 'Toggled reading mode';
    }
    case 'take_screenshot': {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai-take-screenshot');
      }
      return 'Screenshot captured';
    }
    case 'pin_tab': {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai-pin-tab');
      }
      return 'Toggled pin on current tab';
    }
    case 'duplicate_tab': {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai-duplicate-tab');
      }
      return 'Duplicated current tab';
    }
    case 'switch_tab': {
      const tabId = args?.tabId;
      if (mainWindow && !mainWindow.isDestroyed() && tabId !== undefined) {
        mainWindow.webContents.send('ai-switch-tab', tabId);
      }
      return `Switched to tab ${tabId}`;
    }
    case 'close_other_tabs': {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai-close-other-tabs');
      }
      return 'Closed all other tabs';
    }
    case 'find_in_page': {
      const text = args?.text || '';
      if (!text) return 'No search text provided';
      try {
        const safeText = JSON.stringify(text);
        const safeRegex = JSON.stringify(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const result = await getActiveWebview(`
          (function() {
            var searchText = ${safeText};
            window.find(searchText);
            var sel = window.getSelection();
            var range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
            var found = range && range.toString().length > 0;
            var body = document.body.innerText;
            var regex = new RegExp(${safeRegex}, 'gi');
            var matches = body.match(regex);
            return JSON.stringify({ found: found, count: matches ? matches.length : 0 });
          })()
        `);
        return result || JSON.stringify({ found: false, count: 0 });
      } catch { return JSON.stringify({ found: false, count: 0 }); }
    }
    case 'extract_page_data': {
      try {
        const result = await getActiveWebview(`
          (function() {
            const text = document.body.innerText;
            const html = document.body.innerHTML;
            const emails = [...new Set((text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g) || []))];
            const phones = [...new Set((text.match(/(?:\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{2,4}\\)?[-.\\s]?\\d{3,4}[-.\\s]?\\d{3,4}/g) || []))];
            const prices = [...new Set((text.match(/[\\$\\€\\£]\\s?\\d[\\d,]*\\.?\\d*/g) || []))].slice(0, 20);
            const socialLinks = [...document.querySelectorAll('a[href]')]
              .map(a => a.href)
              .filter(h => /twitter\\.com|x\\.com|facebook\\.com|instagram\\.com|linkedin\\.com|youtube\\.com|github\\.com|tiktok\\.com/i.test(h))
              .filter((v, i, a) => a.indexOf(v) === i).slice(0, 15);
            return JSON.stringify({ emails: emails.slice(0, 20), phones: phones.slice(0, 15), prices, socialLinks });
          })()
        `);
        return result || '{}';
      } catch { return 'Could not extract page data'; }
    }
    case 'get_page_tables': {
      try {
        const result = await getActiveWebview(`
          (function() {
            const tables = [...document.querySelectorAll('table')].slice(0, 5);
            return JSON.stringify(tables.map((t, ti) => {
              const headers = [...t.querySelectorAll('thead th, tr:first-child th')].map(th => th.innerText.trim());
              const rows = [...t.querySelectorAll('tbody tr, tr')].slice(0, 50).map(tr =>
                [...tr.querySelectorAll('td, th')].map(td => td.innerText.trim())
              ).filter(r => r.some(c => c.length > 0));
              return { table: ti + 1, headers, rows: rows.slice(0, 30) };
            }));
          })()
        `);
        return result || '[]';
      } catch { return 'Could not extract tables'; }
    }
    case 'inject_page_css': {
      const css = args?.css || '';
      if (!css) return 'No CSS provided';
      try {
        await getActiveWebview(`
          (function() {
            const style = document.createElement('style');
            style.setAttribute('data-flip-ai', 'true');
            style.textContent = ${JSON.stringify(css)};
            document.head.appendChild(style);
            return 'injected';
          })()
        `);
        return 'CSS injected successfully';
      } catch { return 'Could not inject CSS'; }
    }

    case 'get_youtube_transcript': {
      try {
        const pageInfo = await getActiveWebview('JSON.stringify({ url: location.href, title: document.title })');
        if (!pageInfo) return 'No active page';
        const { url: pageUrl } = JSON.parse(pageInfo);
        if (!pageUrl || (!pageUrl.includes('youtube.com/watch') && !pageUrl.includes('youtu.be/'))) {
          return 'Not a YouTube video page. Navigate to a YouTube video first.';
        }
        // Extract video ID
        let videoId = '';
        try {
          const u = new URL(pageUrl);
          videoId = u.searchParams.get('v') || u.pathname.split('/').pop();
        } catch {}
        if (!videoId) return 'Could not determine YouTube video ID';
        console.log('[AI Tool] get_youtube_transcript:', videoId);
        // Try to get captions from the page's ytInitialPlayerResponse
        const transcript = await getActiveWebview(`
          (function() {
            try {
              // Method 1: get from page scripts
              var scripts = document.querySelectorAll('script');
              for (var s of scripts) {
                var t = s.textContent;
                if (t.includes('captionTracks')) {
                  var match = t.match(/"captionTracks":\\s*\\[([^\\]]+)\\]/);
                  if (match) {
                    var tracks = JSON.parse('[' + match[1] + ']');
                    var en = tracks.find(function(tr) { return tr.languageCode === 'en'; }) || tracks[0];
                    if (en && en.baseUrl) return JSON.stringify({ captionUrl: en.baseUrl, lang: en.languageCode });
                  }
                }
              }
              // Method 2: try ytInitialPlayerResponse
              if (window.ytInitialPlayerResponse) {
                var ct = window.ytInitialPlayerResponse.captions;
                if (ct && ct.playerCaptionsTracklistRenderer) {
                  var tracks = ct.playerCaptionsTracklistRenderer.captionTracks || [];
                  var en = tracks.find(function(tr) { return tr.languageCode === 'en'; }) || tracks[0];
                  if (en && en.baseUrl) return JSON.stringify({ captionUrl: en.baseUrl, lang: en.languageCode });
                }
              }
              return JSON.stringify({ error: 'No captions found for this video' });
            } catch(e) { return JSON.stringify({ error: e.message }); }
          })()
        `);
        if (!transcript) return 'Could not access YouTube page content';
        const parsed = JSON.parse(transcript);
        if (parsed.error) return parsed.error;
        // Fetch the caption XML
        const captionResp = await fetch(parsed.captionUrl, { signal: AbortSignal.timeout(8000) });
        const captionXml = await captionResp.text();
        // Parse XML captions into plain text with timestamps
        const lines = [];
        const captionRegex = /<text start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/gi;
        let cm;
        while ((cm = captionRegex.exec(captionXml)) !== null) {
          const sec = parseFloat(cm[1]);
          const min = Math.floor(sec / 60);
          const s = Math.floor(sec % 60);
          const ts = `${min}:${s.toString().padStart(2, '0')}`;
          const text = cm[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n/g, ' ').trim();
          if (text) lines.push(`[${ts}] ${text}`);
        }
        if (lines.length === 0) return 'Captions were found but could not be parsed';
        return JSON.stringify({ videoId, language: parsed.lang, transcript: lines.join('\n').slice(0, 12000) });
      } catch (e) { return `Could not get YouTube transcript: ${e.message}`; }
    }

    case 'read_aloud': {
      const text = args?.text || '';
      const rate = args?.rate || 1.0;
      if (!text) return 'No text provided';
      try {
        await getActiveWebview(`
          (function() {
            window.speechSynthesis.cancel();
            var utter = new SpeechSynthesisUtterance(${JSON.stringify(text.slice(0, 3000))});
            utter.rate = ${Math.max(0.5, Math.min(3.0, rate))};
            utter.pitch = 1;
            window.speechSynthesis.speak(utter);
            return 'speaking';
          })()
        `);
        return 'Reading aloud now. Use stop_reading to stop.';
      } catch { return 'Could not start text-to-speech'; }
    }
    case 'stop_reading': {
      try {
        await getActiveWebview('window.speechSynthesis.cancel(); "stopped"');
        return 'Stopped reading';
      } catch { return 'Could not stop speech'; }
    }

    case 'rewrite_text': {
      const text = args?.text || '';
      const insertBack = args?.insertBack || false;
      if (!text) return 'No text provided';
      if (insertBack) {
        try {
          await getActiveWebview(`
            (function() {
              var el = document.activeElement;
              if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) {
                if (el.isContentEditable) {
                  document.execCommand('selectAll', false, null);
                  document.execCommand('insertText', false, ${JSON.stringify(text)});
                } else {
                  var start = el.selectionStart;
                  var end = el.selectionEnd;
                  if (start !== undefined && end !== undefined && start !== end) {
                    el.value = el.value.slice(0, start) + ${JSON.stringify(text)} + el.value.slice(end);
                  } else {
                    el.value = ${JSON.stringify(text)};
                  }
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return 'inserted';
              }
              // Try to find the focused contenteditable or textarea
              var focused = document.querySelector(':focus');
              if (focused && focused.isContentEditable) {
                document.execCommand('insertText', false, ${JSON.stringify(text)});
                return 'inserted';
              }
              return 'no-field';
            })()
          `);
          return `Text inserted into the page input field.`;
        } catch { return 'Could not insert text into the page. Here is the rewritten text:\n\n' + text; }
      }
      return text;
    }

    case 'watch_page': {
      const url = args?.url || '';
      const label = args?.label || 'Untitled';
      const interval = Math.max(5, args?.intervalMinutes || 30);
      const selector = args?.cssSelector || '';
      if (!url) return 'No URL provided';
      try {
        const watchersFile = path.join(dataDir, 'watchers.json');
        let watchers = [];
        try { watchers = JSON.parse(fs.readFileSync(watchersFile, 'utf-8')) || []; } catch {}
        // Get initial content hash
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(8000),
        });
        let content = await resp.text();
        content = content.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (selector) {
          // We can't CSS-select from plain text, so store a content snippet around the selector hint
          content = content.slice(0, 5000);
        } else {
          content = content.slice(0, 5000);
        }
        const hash = (await import('crypto')).createHash('sha256').update(content).digest('hex');
        const watcher = { id: Date.now(), url, label, intervalMinutes: interval, cssSelector: selector, lastHash: hash, createdAt: new Date().toISOString(), lastChecked: new Date().toISOString(), changeDetected: false };
        watchers.push(watcher);
        fs.writeFileSync(watchersFile, JSON.stringify(watchers, null, 2));
        return `Now watching "${label}" (${url}) — checking every ${interval} minutes. Watcher ID: ${watcher.id}`;
      } catch (e) { return `Could not set up watcher: ${e.message}`; }
    }
    case 'list_watchers': {
      try {
        const watchersFile = path.join(dataDir, 'watchers.json');
        const watchers = JSON.parse(fs.readFileSync(watchersFile, 'utf-8')) || [];
        if (watchers.length === 0) return 'No active page watchers.';
        return JSON.stringify(watchers.map(w => ({ id: w.id, label: w.label, url: w.url, interval: w.intervalMinutes + 'min', lastChecked: w.lastChecked, changed: w.changeDetected })));
      } catch { return 'No active page watchers.'; }
    }
    case 'remove_watcher': {
      const wid = args?.watcherId;
      try {
        const watchersFile = path.join(dataDir, 'watchers.json');
        let watchers = JSON.parse(fs.readFileSync(watchersFile, 'utf-8')) || [];
        const before = watchers.length;
        watchers = watchers.filter(w => w.id !== wid);
        fs.writeFileSync(watchersFile, JSON.stringify(watchers, null, 2));
        return before > watchers.length ? `Removed watcher ${wid}` : `Watcher ${wid} not found`;
      } catch { return 'Could not remove watcher'; }
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// Main AI chat handler with streaming and multi-round tool calling
let aiChatAbort = null;
ipcMain.handle('ai-chat', async (_, { messages, useTools, rawSystem }) => {
  const config = getAiConfig();
  if (!config.endpoint || !config.model) return { error: 'AI not configured. Set a model first.' };

  // Cancel any in-flight request
  if (aiChatAbort) { try { aiChatAbort.abort(); } catch {} }
  aiChatAbort = new AbortController();

  // If rawSystem is true, use the caller's system prompt as-is (for overlay/inline AI)
  let conversationMessages;
  if (rawSystem && messages.length > 0 && messages[0].role === 'system') {
    conversationMessages = [...messages];
  } else {
    const systemContent = FLIP_SYSTEM_PROMPT + (config.systemPrompt ? '\n\n## User custom instructions\n' + config.systemPrompt : '');
    const systemMsg = { role: 'system', content: systemContent };
    conversationMessages = [systemMsg, ...messages];
  }

  try {
    const isOllama = config.provider === 'ollama';
    const chatUrl = isOllama
      ? `${config.endpoint}/api/chat`
      : `${config.endpoint}/v1/chat/completions`;

    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

    const decoder = new TextDecoder();
    let fullContent = '';
    const MAX_TOOL_ROUNDS = 10; // Prevent infinite loops

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      console.log(`[AI] Round ${round}, messages: ${conversationMessages.length}, useTools: ${useTools}`);
      const includeTools = useTools && round < MAX_TOOL_ROUNDS; // No tools on last round to force text response
      const body = {
        model: config.model,
        messages: conversationMessages,
        stream: true,
        ...(includeTools ? { tools: BROWSER_TOOLS } : {}),
      };

      const resp = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: aiChatAbort.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Unknown error');
        return { error: `AI request failed (${resp.status}): ${errText}` };
      }

      // Stream the response
      let roundContent = '';
      let toolCalls = [];
      const reader = resp.body.getReader();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          try {
            const json = isOllama ? JSON.parse(trimmed) : JSON.parse(trimmed.replace(/^data:\s*/, ''));

            if (isOllama) {
              if (json.message?.content) {
                roundContent += json.message.content;
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('ai-stream-token', json.message.content);
                }
              }
              if (json.message?.tool_calls) {
                toolCalls = json.message.tool_calls;
              }
            } else {
              const delta = json.choices?.[0]?.delta;
              if (delta?.content) {
                roundContent += delta.content;
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('ai-stream-token', delta.content);
                }
              }
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: tc.id, function: { name: '', arguments: '' } };
                  if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                  if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                }
              }
            }
          } catch {}
        }
      }

      fullContent += roundContent;

      // If no tool calls, we're done
      if (toolCalls.length === 0) break;

      // Execute tool calls and build follow-up messages
      const assistantMsg = { role: 'assistant', content: roundContent || null, tool_calls: toolCalls };
      conversationMessages.push(assistantMsg);

      for (const tc of toolCalls) {
        const fnName = tc.function?.name;
        let fnArgs = {};
        const rawArgs = tc.function?.arguments;
        if (typeof rawArgs === 'object' && rawArgs !== null) {
          fnArgs = rawArgs; // Ollama returns pre-parsed objects
        } else if (typeof rawArgs === 'string' && rawArgs.trim()) {
          try { fnArgs = JSON.parse(rawArgs); } catch {}
        }
        console.log(`[AI] Tool round ${round}: ${fnName}(${JSON.stringify(fnArgs)})`);
        const result = await executeBrowserTool(fnName, fnArgs);
        console.log(`[AI] Tool result (${fnName}):`, typeof result === 'string' ? result.slice(0, 200) : result);
        conversationMessages.push({
          role: 'tool',
          content: typeof result === 'string' ? result : JSON.stringify(result),
          ...(tc.id ? { tool_call_id: tc.id } : {}),
        });
      }
      // Loop continues — next round will send conversation with tool results
    }

    // Signal stream complete
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai-stream-done');
    }
    return { content: fullContent };
  } catch (e) {
    if (e.name === 'AbortError') return { error: 'Request cancelled' };
    return { error: e.message };
  }
});

ipcMain.handle('ai-stop', () => {
  if (aiChatAbort) { try { aiChatAbort.abort(); } catch {} aiChatAbort = null; }
  return true;
});

const STUDIO_SYSTEM_PROMPT = `You are the **Flip Extension SDK Assistant**, embedded in the Flip Browser Extension Studio.

## Your ONLY purpose
Help developers build Flip Browser extensions. Extensions are single-file React (JSX) apps that run in sandboxed iframes inside the Flip Browser sidebar.

## Flip Extension SDK Reference
Extensions communicate with the browser via \`window.parent.postMessage\`. The host injects a helper so extensions call:

### Tabs
- \`Flip.tabs.list()\` → [{id, url, title, active}]
- \`Flip.tabs.open(url)\` → opens new tab
- \`Flip.tabs.close(tabId)\` → closes tab
- \`Flip.tabs.navigate(tabId, url)\` → navigates tab
- \`Flip.tabs.getActive()\` → {id, url, title}
- \`Flip.tabs.getContent(tabId)\` → page text content
- \`Flip.tabs.getSelectedText()\` → selected text on active page

### Storage (per-extension persistent key-value)
- \`Flip.storage.get(key)\` → value
- \`Flip.storage.set(key, value)\`
- \`Flip.storage.remove(key)\`
- \`Flip.storage.keys()\` → [keys]

### Network
- \`Flip.fetch(url, options)\` → response (proxied through main process, avoids CORS)

### UI
- \`Flip.ui.showToast(message, type?)\` → shows notification toast (type: 'success'|'error'|'info')
- \`Flip.ui.setBadge(text)\` → sets badge on extension icon
- \`Flip.ui.getTheme()\` → {mode, primary, accent}

### x402 Payments (Base chain USDC)
- \`Flip.x402.pay({to, amount, reason})\` → {success, txHash} or {error}
- \`Flip.x402.balance()\` → {address, usdc, eth}
- \`Flip.x402.walletInfo()\` → {address, network}

### Bookmarks & History
- \`Flip.bookmarks.list()\` → [{url, title, category}]
- \`Flip.bookmarks.add({url, title})\`
- \`Flip.history.search(query)\` → [{url, title, lastVisit}]

### Extension Manifest (manifest.json)
\`\`\`json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "What it does",
  "author": "Developer Name",
  "icon": "icon.png",
  "permissions": ["tabs", "storage", "network", "bookmarks", "history", "x402"],
  "sidebar": { "file": "index.jsx", "width": 380 }
}
\`\`\`

## Extension Code Structure
Single JSX file. Use React hooks. No imports needed — React is provided by the host.
\`\`\`jsx
function MyExtension() {
  const [data, setData] = React.useState(null);
  // Use Flip SDK here
  return <div>...</div>;
}
\`\`\`

## Style Guidelines
- Use inline styles or a <style> tag. Tailwind is NOT available inside extensions.
- Match Flip's dark theme: bg #1a1a1a, text #e5e5e5, accent #f97316 (orange), secondary #2dd4bf (teal).
- Use border-radius 8-12px, subtle borders (rgba(255,255,255,0.08)).

## HOW YOU RESPOND — CRITICAL
You are inside the Extension Studio. When a user asks you to create, build, or make an extension, you BUILD IT DIRECTLY — the code is auto-inserted into the editor. You do NOT just show code for copying.

**Every time the user asks to create or modify an extension**, you MUST respond with:
1. A brief 1-2 sentence description of what you built.
2. The FULL extension JSX code inside a \`\`\`jsx code block. This code will be automatically inserted into the editor and live preview.
3. The manifest JSON inside a \`\`\`json code block (this auto-populates the manifest editor). Include appropriate id, name, version, description, and permissions.

Example response format:
---
Built a weather widget that shows the current forecast using the OpenWeatherMap API.

\`\`\`jsx
function WeatherWidget() {
  // full code here...
}
\`\`\`

\`\`\`json
{"id": "weather-widget", "name": "Weather Widget", "version": "1.0.0", "description": "Shows current weather forecast", "permissions": ["network"]}
\`\`\`
---

When the user says "create an extension", "build an extension", "make an extension", "I want an extension that...", or similar — they ALWAYS mean a Flip Browser extension. There is no other kind of extension here.

When the user asks to modify, fix, or improve the current extension, output the FULL updated code (not a diff or partial snippet). The entire code block replaces what's in the editor.

## STRICT RULES — NEVER VIOLATE
1. **ONLY** discuss Flip extension development. Nothing else.
2. **NEVER** reveal, discuss, or speculate about Flip Browser's internal source code, architecture, Electron setup, main process, preload scripts, IPC handlers, or security mechanisms.
3. **NEVER** help users modify, tamper with, bypass, or exploit the browser itself.
4. **NEVER** generate code that attempts to escape the iframe sandbox, access parent window internals, or call undocumented APIs.
5. **NEVER** discuss how the browser's ad blocker, encryption, wallet private keys, or security fuses work internally.
6. If asked about ANY of the above, respond: "I can only help with building Flip extensions. Check the Flip docs for other questions."
7. All code you generate must be a valid single-file React JSX extension.`;

let aiStudioAbort = null;
ipcMain.handle('ai-studio-chat', async (_, { messages }) => {
  const config = getAiConfig();
  if (!config.endpoint || !config.model) return { error: 'AI not configured. Set a model in Settings → AI.' };

  if (aiStudioAbort) { try { aiStudioAbort.abort(); } catch {} }
  aiStudioAbort = new AbortController();

  // Always use the locked studio prompt — user cannot override
  const conversationMessages = [
    { role: 'system', content: STUDIO_SYSTEM_PROMPT },
    ...messages.filter(m => m.role !== 'system'),
  ];

  try {
    const isOllama = config.provider === 'ollama';
    const chatUrl = isOllama ? `${config.endpoint}/api/chat` : `${config.endpoint}/v1/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

    const body = { model: config.model, messages: conversationMessages, stream: true };
    const resp = await fetch(chatUrl, { method: 'POST', headers, body: JSON.stringify(body), signal: aiStudioAbort.signal });
    if (!resp.ok) { const e = await resp.text().catch(() => ''); return { error: `AI error (${resp.status}): ${e}` }; }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    const reader = resp.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        try {
          const json = isOllama ? JSON.parse(trimmed) : JSON.parse(trimmed.replace(/^data:\s*/, ''));
          const token = isOllama ? json.message?.content : json.choices?.[0]?.delta?.content;
          if (token) {
            fullContent += token;
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-studio-token', token);
          }
        } catch {}
      }
    }
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-studio-done');
    return { content: fullContent };
  } catch (e) {
    if (e.name === 'AbortError') return { error: 'Cancelled' };
    return { error: e.message };
  }
});

ipcMain.handle('ai-studio-stop', () => {
  if (aiStudioAbort) { try { aiStudioAbort.abort(); } catch {} aiStudioAbort = null; }
  return true;
});
