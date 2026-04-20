import React, { useEffect, useRef, useCallback } from 'react';
import useBrowserStore from '../../store/browserStore';
import { forwardNotification } from '../../lib/companionSync';

// Maps API call types to the permission required in manifest.json
const PERMISSION_MAP = {
  'tabs.getAll':    'tabs',
  'tabs.getActive': 'tabs',
  'tabs.create':    'tabs',
  'tabs.navigate':  'tabs',
  'tabs.close':     'tabs',
  'storage.get':    'storage',
  'storage.set':    'storage',
  'storage.crossGet':  'cross_storage',
  'storage.crossSet':  'cross_storage_write',
  'ui.notification': null,  // always allowed
  'ui.badge':        null,  // always allowed
  'music.pickFolder':  'music',
  'ai.getConfig':      'ai',
  'ai.saveConfig':     'ai',
  'ai.isAvailable':    'ai',
  'ai.listModels':     'ai',
  'ai.chat':           'ai',
  'ai.stop':           'ai',
  'net.fetch':         'network',
  'net.saveFile':      'storage',
  'browser.executeScript': 'tabs',
  'fs.listDir':        'filesystem',
  'fs.getSize':        'filesystem',
  'fs.delete':         'filesystem',
  'fs.getSafeFolders': 'filesystem',
  'fs.getDiskUsage':   'filesystem',
  'security.getConnections':  'security',
  'security.getListening':    'security',
  'security.getProcessName':  'security',
  'security.getStartup':      'security',
  'security.scan':            'security',
  'adblock.getStats':          'adblock',
  'adblock.isWhitelisted':     'adblock',
  'adblock.getWhitelist':      'adblock',
  'adblock.getBlockedCount':   'adblock',
  'settings.get':              'settings',
  'proxy.getStatus':           'proxy',
  'proxy.checkIp':             'proxy',
  'browser.getSecurityStatus':  'settings',
};

// These extensions are built by CROAKWORKS and are implicitly trusted
const TRUSTED_EXTENSION_IDS = [
  'ai-chat', 'community-chat', 'flipprx-miner', 'flipprx-game',
  'mimo-messenger', 'music-player', 'sample-weather', 'sample-notes',
  'color-picker', 'json-formatter', 'regex-tester', 'xrpl-wallet',
  'flip-call', 'file-cleaner', 'security-dashboard', 'privacy-dashboard',
];

const rateLimiters = {};
function checkRateLimit(extensionId, type) {
  const key = `${extensionId}:${type}`;
  const now = Date.now();
  if (!rateLimiters[key]) rateLimiters[key] = [];
  // Keep only calls within the last second
  rateLimiters[key] = rateLimiters[key].filter((t) => now - t < 1000);
  if (rateLimiters[key].length >= 30) return false; // 30 calls/sec max
  rateLimiters[key].push(now);
  return true;
}

function isUrlSafe(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const blocked = ['file:', 'javascript:', 'data:', 'blob:', 'vbscript:'];
    return !blocked.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeSourceCode(code) {
  if (!code || typeof code !== 'string') return '';
  // Escape </script> to prevent breaking out of the script context
  return code.replace(/<\/script/gi, '<\\/script');
}

function sanitizeString(val, maxLen = 2048) {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen);
}

/**
 * ExtensionHost renders a sandboxed React extension inside an iframe.
 * 
 * The extension source code (JSX) is transpiled at a basic level and injected
 * into an iframe with its own React instance. Communication between the
 * extension and the browser happens via postMessage (the Flip Extension API).
 */
/**
 * Reads the current resolved theme CSS variables from the browser document
 * so they can be injected into extension iframes. This ensures extensions
 * automatically match whatever theme the user has selected.
 */
function getThemeTokens() {
  const s = getComputedStyle(document.documentElement);
  const r = (v) => s.getPropertyValue(v).trim();
  return {
    flip400:  r('--flip-400')  || '255 122 77',
    flip500:  r('--flip-500')  || '255 98 52',
    accent400: r('--accent-400') || '45 212 168',
    surface0: r('--surface-0') || '16 16 16',
    surface1: r('--surface-1') || '24 24 24',
    surface2: r('--surface-2') || '32 32 32',
  };
}

export default function ExtensionHost({ extension, width = '100%', height = '100%' }) {
  const iframeRef = useRef(null);
  const permissions = extension.manifest.permissions || [];

  const buildExtensionHTML = useCallback(() => {
    const { manifest, sourceCode } = extension;

    // Build the Flip Extension SDK that's available inside the iframe
    const flipSDK = `
      window.Flip = {
        _pendingCallbacks: {},
        _callbackId: 0,

        _postMessage(type, payload) {
          return new Promise((resolve) => {
            const id = ++this._callbackId;
            this._pendingCallbacks[id] = resolve;
            window.parent.postMessage({ 
              source: 'flip-extension', 
              extensionId: '${extension.id}',
              type, 
              payload, 
              callbackId: id 
            }, '*');
          });
        },

        tabs: {
          getAll() { return Flip._postMessage('tabs.getAll'); },
          getActive() { return Flip._postMessage('tabs.getActive'); },
          create(url) { return Flip._postMessage('tabs.create', { url }); },
          navigate(tabId, url) { return Flip._postMessage('tabs.navigate', { tabId, url }); },
          close(tabId) { return Flip._postMessage('tabs.close', { tabId }); },
        },

        storage: {
          get(key) { return Flip._postMessage('storage.get', { key }); },
          set(key, value) { return Flip._postMessage('storage.set', { key, value }); },
          crossGet(targetExtId, key) { return Flip._postMessage('storage.crossGet', { targetExtId, key }); },
          crossSet(targetExtId, key, value) { return Flip._postMessage('storage.crossSet', { targetExtId, key, value }); },
        },

        ui: {
          showNotification(message, type = 'info') {
            return Flip._postMessage('ui.notification', { message, type });
          },
          setBadge(text) {
            return Flip._postMessage('ui.badge', { text });
          },
        },

        music: {
          pickFolder() { return Flip._postMessage('music.pickFolder'); },
        },

        ai: {
          getConfig() { return Flip._postMessage('ai.getConfig'); },
          saveConfig(config) { return Flip._postMessage('ai.saveConfig', config); },
          isAvailable() { return Flip._postMessage('ai.isAvailable'); },
          listModels() { return Flip._postMessage('ai.listModels'); },
          chat(data) { return Flip._postMessage('ai.chat', data); },
          stop() { return Flip._postMessage('ai.stop'); },
        },

        net: {
          fetch(url, options) { return Flip._postMessage('net.fetch', { url, options }); },
          saveFile(base64, filename, source) { return Flip._postMessage('net.saveFile', { base64, filename, source }); },
        },

        fs: {
          listDir(dirPath) { return Flip._postMessage('fs.listDir', { dirPath }); },
          getSize(dirPath) { return Flip._postMessage('fs.getSize', { dirPath }); },
          delete(filePaths) { return Flip._postMessage('fs.delete', { filePaths }); },
          getSafeFolders() { return Flip._postMessage('fs.getSafeFolders'); },
          getDiskUsage() { return Flip._postMessage('fs.getDiskUsage'); },
        },

        security: {
          getConnections() { return Flip._postMessage('security.getConnections'); },
          getListening() { return Flip._postMessage('security.getListening'); },
          getProcessName(pid) { return Flip._postMessage('security.getProcessName', { pid }); },
          getStartup() { return Flip._postMessage('security.getStartup'); },
          scan() { return Flip._postMessage('security.scan'); },
        },

        adblock: {
          getStats() { return Flip._postMessage('adblock.getStats'); },
          isWhitelisted(hostname) { return Flip._postMessage('adblock.isWhitelisted', { hostname }); },
          getWhitelist() { return Flip._postMessage('adblock.getWhitelist'); },
          getBlockedCount() { return Flip._postMessage('adblock.getBlockedCount'); },
        },

        settings: {
          get() { return Flip._postMessage('settings.get'); },
        },

        proxy: {
          getStatus() { return Flip._postMessage('proxy.getStatus'); },
          checkIp() { return Flip._postMessage('proxy.checkIp'); },
        },

        browser: {
          getInfo() {
            return { name: 'Flip Browser', version: '${typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown"}' };
          },
          getSecurityStatus() { return Flip._postMessage('browser.getSecurityStatus'); },
          executeScript(script) { return Flip._postMessage('browser.executeScript', { script }); },
        },
      };


      // srcDoc iframes may not have direct media device access even without sandbox.
      // Polyfill getUserMedia to use the parent window's navigator as fallback.
      (function() {
        try {
          // Access window.parent.navigator in a separate try — it throws
          // a DOMException in cross-origin / sandboxed srcdoc frames.
          var parentMedia;
          try { parentMedia = window.parent && window.parent.navigator && window.parent.navigator.mediaDevices; } catch(_) { return; }
          if (parentMedia && parentMedia.getUserMedia) {
            var origGetUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            if (navigator.mediaDevices) {
              navigator.mediaDevices.getUserMedia = async function(constraints) {
                try {
                  if (origGetUserMedia) return await origGetUserMedia(constraints);
                } catch(e) { /* fall through to parent */ }
                return parentMedia.getUserMedia(constraints);
              };
              navigator.mediaDevices.enumerateDevices = function() {
                return parentMedia.enumerateDevices();
              };
            } else {
              Object.defineProperty(navigator, 'mediaDevices', { value: parentMedia, writable: false });
            }
          }
        } catch(e) { /* silently skip — polyfill not critical */ }
      })();

      // Handle responses from parent
      window.addEventListener('message', (e) => {
        if (e.data?.source === 'flip-host' && e.data.callbackId) {
          const cb = Flip._pendingCallbacks[e.data.callbackId];
          if (cb) {
            cb(e.data.result);
            delete Flip._pendingCallbacks[e.data.callbackId];
          }
        }
      });
    `;

    // Simple JSX-to-JS transpiler for basic React extensions
    // In production, you'd use Babel or SWC here
    let transpiledCode = sourceCode;
    try {
      // Basic JSX transpilation: convert <Component> to React.createElement
      // This handles simple cases. For complex extensions, pre-bundle them.
      transpiledCode = basicJSXTranspile(sourceCode);
    } catch (e) {
      console.warn('JSX transpilation warning:', e);
      transpiledCode = sourceCode;
    }

    const safeSource = sanitizeSourceCode(sourceCode);

    // Only grant network access if extension declares 'network' permission
    const hasNetwork = permissions.includes('network');
    const connectSrc = hasNetwork ? "connect-src https: http: wss: ws:;" : "connect-src 'none';";

    // Resolve the active theme tokens from the browser document at render time.
    // Values are RGB triplets (e.g. "255 98 52") matching Tailwind's opacity syntax.
    const tok = getThemeTokens();
    // Convert to usable CSS color strings
    const flip    = `rgb(${tok.flip500})`;
    const flipLt  = `rgb(${tok.flip400})`;
    const accent  = `rgb(${tok.accent400})`;
    const bg0     = `rgb(${tok.surface0})`;
    const bg1     = `rgb(${tok.surface1})`;
    const bg2     = `rgb(${tok.surface2})`;
    // RGB triplets for rgba() usage
    const flipRgb   = tok.flip500;
    const accentRgb = tok.accent400;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'unsafe-inline'; ${connectSrc} img-src https: http: data:; font-src https: data:; media-src https: http: data: blob:;">
  <style>
    /* ── Flip Design Tokens (resolved from user's active theme) ── */
    :root {
      --flip:        ${flip};
      --flip-light:  ${flipLt};
      --accent:      ${accent};
      --bg:          ${bg0};
      --bg-1:        ${bg1};
      --bg-2:        ${bg2};
      --text:        rgba(255,255,255,0.82);
      --text-muted:  rgba(255,255,255,0.45);
      --text-faint:  rgba(255,255,255,0.22);
      --border:      rgba(255,255,255,0.07);
      --border-hover:rgba(255,255,255,0.13);
      --radius-sm:   8px;
      --radius:      10px;
      --radius-lg:   14px;
    }

    /* ── Reset ── */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    /* ── Base ── */
    body {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      background: transparent;
      color: var(--text);
      font-size: 13px;
      line-height: 1.5;
      padding: 12px;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }

    /* ── Typography ── */
    h1, h2, h3, h4 { font-weight: 600; line-height: 1.3; color: rgba(255,255,255,0.9); }
    h1 { font-size: 18px; margin-bottom: 4px; }
    h2 { font-size: 15px; margin-bottom: 4px; }
    h3 { font-size: 13px; margin-bottom: 2px; }
    h4 { font-size: 11px; }
    p  { color: var(--text-muted); line-height: 1.6; }
    small { font-size: 10px; color: var(--text-faint); }
    code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 11px;
      background: rgba(255,255,255,0.06);
      border-radius: 4px;
      padding: 1px 5px;
      color: var(--flip-light);
    }
    pre {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 11px;
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px;
      overflow-x: auto;
      line-height: 1.7;
      color: rgba(255,255,255,0.6);
      margin-bottom: 8px;
    }
    a { color: var(--flip-light); text-decoration: none; }
    a:hover { color: var(--flip); text-decoration: underline; text-underline-offset: 2px; }
    hr { border: none; border-top: 1px solid var(--border); margin: 12px 0; }

    /* ── Buttons ── */
    button, .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.7);
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-family: inherit;
      font-weight: 500;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    button:hover, .btn:hover {
      background: rgba(${flipRgb},0.12);
      border-color: rgba(${flipRgb},0.25);
      color: rgba(255,255,255,0.9);
    }
    button:active, .btn:active { opacity: 0.8; transform: scale(0.98); }
    button:disabled, .btn:disabled { opacity: 0.35; cursor: not-allowed; pointer-events: none; }

    .btn-primary {
      background: rgba(${flipRgb},0.18);
      border-color: rgba(${flipRgb},0.30);
      color: var(--flip-light);
      font-weight: 600;
    }
    .btn-primary:hover {
      background: rgba(${flipRgb},0.28);
      border-color: rgba(${flipRgb},0.45);
      color: #fff;
    }
    .btn-ghost {
      background: transparent;
      border-color: transparent;
      color: var(--text-muted);
    }
    .btn-ghost:hover {
      background: rgba(255,255,255,0.06);
      border-color: var(--border);
      color: var(--text);
    }
    .btn-sm { padding: 4px 8px; font-size: 11px; border-radius: 6px; }
    .btn-lg { padding: 9px 18px; font-size: 13px; border-radius: var(--radius); }

    /* ── Inputs ── */
    input, textarea, select {
      display: block;
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: var(--radius);
      color: rgba(255,255,255,0.9);
      padding: 7px 11px;
      font-size: 12px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
      -webkit-appearance: none;
    }
    input:focus, textarea:focus, select:focus {
      border-color: rgba(${flipRgb},0.45);
      box-shadow: 0 0 0 3px rgba(${flipRgb},0.08);
    }
    input::placeholder, textarea::placeholder { color: var(--text-faint); }
    textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
    label {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 5px;
      font-weight: 500;
    }

    /* ── Cards ── */
    .card {
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px;
      margin-bottom: 8px;
      transition: border-color 0.15s;
    }
    .card:hover { border-color: var(--border-hover); }
    .card-flat { background: rgba(0,0,0,0.2); }

    /* ── Badges ── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(${flipRgb},0.12);
      color: var(--flip-light);
      border: 1px solid rgba(${flipRgb},0.20);
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .badge-success {
      background: rgba(34,197,94,0.12);
      color: #4ade80;
      border-color: rgba(34,197,94,0.20);
    }
    .badge-warning {
      background: rgba(245,158,11,0.12);
      color: #fbbf24;
      border-color: rgba(245,158,11,0.20);
    }
    .badge-error {
      background: rgba(239,68,68,0.12);
      color: #f87171;
      border-color: rgba(239,68,68,0.20);
    }
    .badge-accent {
      background: rgba(${accentRgb},0.12);
      color: var(--accent);
      border-color: rgba(${accentRgb},0.20);
    }

    /* ── Alert boxes ── */
    .alert {
      padding: 10px 12px;
      border-radius: var(--radius);
      font-size: 12px;
      border: 1px solid;
      margin-bottom: 8px;
      line-height: 1.5;
    }
    .alert-info    { background: rgba(${flipRgb},0.08);  border-color: rgba(${flipRgb},0.18);  color: var(--flip-light); }
    .alert-success { background: rgba(34,197,94,0.08);  border-color: rgba(34,197,94,0.18);  color: #4ade80; }
    .alert-warning { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.18); color: #fbbf24; }
    .alert-error   { background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.18);  color: #f87171; }

    /* ── Divider ── */
    .divider {
      height: 1px;
      background: var(--border);
      margin: 12px 0;
    }

    /* ── Loading spinner ── */
    @keyframes flip-spin { to { transform: rotate(360deg); } }
    .flip-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(${flipRgb},0.2);
      border-top-color: var(--flip-light);
      border-radius: 50%;
      animation: flip-spin 0.7s linear infinite;
    }
    .flip-spinner-sm { width: 12px; height: 12px; border-width: 1.5px; }
    .flip-spinner-lg { width: 22px; height: 22px; border-width: 2.5px; }

    /* ── Utility ── */
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .flex     { display: flex; }
    .flex-col { display: flex; flex-direction: column; }
    .flex-1   { flex: 1; min-width: 0; }
    .gap-1    { gap: 4px;  }
    .gap-2    { gap: 8px;  }
    .gap-3    { gap: 12px; }
    .items-center  { align-items: center; }
    .justify-between { justify-content: space-between; }
    .w-full   { width: 100%; }
    .mt-1 { margin-top: 4px; } .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; } .mt-4 { margin-top: 16px; }
    .mb-1 { margin-bottom: 4px; } .mb-2 { margin-bottom: 8px; } .mb-3 { margin-bottom: 12px; } .mb-4 { margin-bottom: 16px; }
    .p-1  { padding: 4px;  } .p-2  { padding: 8px;  } .p-3  { padding: 12px; } .p-4  { padding: 16px; }
    .text-sm  { font-size: 12px; }
    .text-xs  { font-size: 11px; }
    .text-xxs { font-size: 10px; }
    .text-muted { color: var(--text-muted); }
    .text-faint { color: var(--text-faint); }
    .text-flip  { color: var(--flip-light); }
    .text-accent { color: var(--accent); }
    .text-success { color: #4ade80; }
    .text-warning { color: #fbbf24; }
    .text-error   { color: #f87171; }
    .scroll-y { overflow-y: auto; }
    .nowrap   { white-space: nowrap; }
  </style>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head>
<body>
  <div id="extension-root"></div>
  <script>${flipSDK}<\/script>
  <script type="text/babel" data-presets="react">
    ${safeSource}

    const rootEl = document.getElementById('extension-root');
    const root = ReactDOM.createRoot(rootEl);
    root.render(React.createElement(App));
  <\/script>
</body>
</html>`;
  }, [extension]);

  // Handle messages from extension iframe (with permission enforcement)
  useEffect(() => {
    function handleMessage(e) {
      if (e.data?.source !== 'flip-extension') return;
      if (e.data.extensionId !== extension.id) return;

      const { type, payload, callbackId } = e.data;
      let result = null;

      const requiredPerm = PERMISSION_MAP[type];
      if (requiredPerm !== undefined && requiredPerm !== null && !permissions.includes(requiredPerm)) {
        console.warn(`[Flip Security] Extension "${extension.id}" blocked: requires "${requiredPerm}" permission for ${type}`);
        iframeRef.current?.contentWindow?.postMessage({
          source: 'flip-host', callbackId,
          result: null, error: `Permission denied: "${requiredPerm}" not granted`,
        }, '*');
        return;
      }

      if (!checkRateLimit(extension.id, type)) {
        console.warn(`[Flip Security] Extension "${extension.id}" rate limited on ${type}`);
        iframeRef.current?.contentWindow?.postMessage({
          source: 'flip-host', callbackId,
          result: null, error: 'Rate limited: too many requests',
        }, '*');
        return;
      }

      const state = useBrowserStore.getState();

      switch (type) {
        case 'tabs.getAll':
          // Only expose safe fields, never internal state
          result = state.tabs
            .filter((t) => !t.isSplitTab)
            .map(({ id, url, title, favicon }) => ({ id, url, title, favicon }));
          break;
        case 'tabs.getActive':
          result = state.tabs.find((t) => t.id === state.activeTabId);
          if (result) result = { id: result.id, url: result.url, title: result.title };
          break;
        case 'tabs.create': {
          const createUrl = sanitizeString(payload?.url, 4096);
          if (!isUrlSafe(createUrl)) {
            result = { error: 'Invalid or blocked URL' };
            break;
          }
          state.addTab(createUrl);
          result = true;
          break;
        }
        case 'tabs.close': {
          const tabId = typeof payload?.tabId === 'number' ? payload.tabId : null;
          if (tabId !== null) state.closeTab(tabId);
          result = tabId !== null;
          break;
        }
        case 'tabs.navigate': {
          const navUrl = sanitizeString(payload?.url, 4096);
          const navTabId = typeof payload?.tabId === 'number' ? payload.tabId : null;
          if (!isUrlSafe(navUrl) || navTabId === null) {
            result = { error: 'Invalid URL or tab ID' };
            break;
          }
          state.updateTab(navTabId, { url: navUrl, loading: true });
          window.dispatchEvent(new CustomEvent('flip-navigate', { detail: { tabId: navTabId, url: navUrl } }));
          result = true;
          break;
        }
        case 'storage.get': {
          const key = sanitizeString(payload?.key, 256);
          if (!key) { result = null; break; }
          result = localStorage.getItem(`flip-ext-${extension.id}-${key}`);
          try { result = JSON.parse(result); } catch {}
          break;
        }
        case 'storage.set': {
          const key = sanitizeString(payload?.key, 256);
          if (!key) { result = false; break; }
          // Limit storage value size to 1MB per key
          const val = JSON.stringify(payload?.value);
          if (val && val.length > 1048576) {
            result = { error: 'Storage value too large (max 1MB)' };
            break;
          }
          localStorage.setItem(`flip-ext-${extension.id}-${key}`, val);
          result = true;
          break;
        }
        case 'storage.crossGet': {
          // Validate target extension ID format (alphanumeric + hyphens only)
          const targetId = sanitizeString(payload?.targetExtId, 128);
          const key = sanitizeString(payload?.key, 256);
          if (!targetId || !key || !/^[a-zA-Z0-9_-]+$/.test(targetId)) { result = null; break; }
          result = localStorage.getItem(`flip-ext-${targetId}-${key}`);
          try { result = JSON.parse(result); } catch {}
          break;
        }
        case 'storage.crossSet': {
          const targetId = sanitizeString(payload?.targetExtId, 128);
          const key = sanitizeString(payload?.key, 256);
          if (!targetId || !key || !/^[a-zA-Z0-9_-]+$/.test(targetId)) { result = false; break; }
          const val = JSON.stringify(payload?.value);
          if (val && val.length > 1048576) {
            result = { error: 'Storage value too large (max 1MB)' };
            break;
          }
          localStorage.setItem(`flip-ext-${targetId}-${key}`, val);
          result = true;
          break;
        }
        case 'ui.notification':
          console.log(`[Extension ${extension.id}] ${sanitizeString(payload?.message, 500)}`);
          forwardNotification({ type: 'general', title: extension.name || 'Extension', body: sanitizeString(payload?.message, 500) });
          result = true;
          break;
        case 'ui.badge':
          result = true;
          break;
        case 'music.pickFolder': {
          if (window.flipAPI?.pickMusicFolder) {
            window.flipAPI.pickMusicFolder().then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            }).catch(err => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: { error: err.message } }, '*');
            });
            return;
          }
          result = { error: 'Music API not available' };
          break;
        }
        case 'ai.getConfig': {
          if (window.flipAPI?.aiGetConfig) {
            window.flipAPI.aiGetConfig().then(r => {
              if (r && typeof r === 'object') {
                const masked = { ...r };
                if (masked.apiKey) {
                  masked.apiKey = masked.apiKey.length > 8
                    ? masked.apiKey.slice(0, 4) + '****' + masked.apiKey.slice(-4)
                    : '********';
                }
                iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: masked }, '*');
              } else {
                iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
              }
            });
            return;
          }
          result = null;
          break;
        }
        case 'ai.saveConfig': {
          if (window.flipAPI?.aiSaveConfig) {
            window.flipAPI.aiSaveConfig(payload).then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            });
            return;
          }
          result = null;
          break;
        }
        case 'ai.isAvailable': {
          if (window.flipAPI?.aiIsAvailable) {
            window.flipAPI.aiIsAvailable().then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            });
            return;
          }
          result = null;
          break;
        }
        case 'ai.listModels': {
          if (window.flipAPI?.aiListModels) {
            window.flipAPI.aiListModels().then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            });
            return;
          }
          result = null;
          break;
        }
        case 'ai.chat': {
          if (window.flipAPI?.aiChat) {
            window.flipAPI.aiChat(payload).then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            });
            return;
          }
          result = null;
          break;
        }
        case 'ai.stop': {
          if (window.flipAPI?.aiStop) {
            window.flipAPI.aiStop().then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            });
            return;
          }
          result = null;
          break;
        }
        case 'net.fetch': {
          const fetchUrl = sanitizeString(payload?.url, 4096);
          if (!fetchUrl || !isUrlSafe(fetchUrl)) {
            result = { error: 'Invalid or blocked URL' };
            break;
          }
          if (window.flipAPI?.extFetchUrl) {
            window.flipAPI.extFetchUrl(fetchUrl, payload?.options).then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            }).catch(err => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: { error: err.message } }, '*');
            });
            return;
          }
          result = { error: 'Fetch API not available' };
          break;
        }
        case 'browser.executeScript': {
          const script = payload?.script;
          if (!script || typeof script !== 'string') {
            result = { error: 'Missing or invalid script' };
            break;
          }
          // Only allow trusted first-party extensions to execute scripts in tabs
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) {
            result = { error: 'Only trusted extensions can execute scripts in tabs' };
            break;
          }
          const execId = 'exec-' + Date.now() + '-' + Math.random().toString(36).slice(2);
          const execPromise = new Promise((resolve) => {
            function onResult(ev) {
              if (ev.detail?.execId === execId) {
                window.removeEventListener('flip-execute-script-result', onResult);
                resolve(ev.detail.result);
              }
            }
            window.addEventListener('flip-execute-script-result', onResult);
            // Timeout after 30s
            setTimeout(() => {
              window.removeEventListener('flip-execute-script-result', onResult);
              resolve({ error: 'Script execution timed out' });
            }, 30000);
          });
          window.dispatchEvent(new CustomEvent('flip-execute-script', { detail: { execId, script } }));
          execPromise.then(r => {
            iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
          });
          return;
        }
        case 'security.getConnections': {
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) { result = { error: 'Only trusted extensions can access security APIs' }; break; }
          if (window.flipAPI?.extSecurityConnections) {
            window.flipAPI.extSecurityConnections().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = { error: 'Security API not available' }; break;
        }
        case 'security.getListening': {
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) { result = { error: 'Only trusted extensions can access security APIs' }; break; }
          if (window.flipAPI?.extSecurityListening) {
            window.flipAPI.extSecurityListening().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = { error: 'Security API not available' }; break;
        }
        case 'security.getProcessName': {
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) { result = { error: 'Only trusted extensions can access security APIs' }; break; }
          const secPid = payload?.pid;
          if (window.flipAPI?.extSecurityProcessName) {
            window.flipAPI.extSecurityProcessName(secPid).then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = { error: 'Security API not available' }; break;
        }
        case 'security.getStartup': {
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) { result = { error: 'Only trusted extensions can access security APIs' }; break; }
          if (window.flipAPI?.extSecurityStartup) {
            window.flipAPI.extSecurityStartup().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = { error: 'Security API not available' }; break;
        }
        case 'security.scan': {
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) { result = { error: 'Only trusted extensions can access security APIs' }; break; }
          if (window.flipAPI?.extSecurityScan) {
            window.flipAPI.extSecurityScan().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = { error: 'Security API not available' }; break;
        }
        case 'adblock.getStats': {
          if (window.flipAPI?.adblockStats) {
            window.flipAPI.adblockStats().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = null; break;
        }
        case 'adblock.isWhitelisted': {
          const abHost = sanitizeString(payload?.hostname, 256);
          if (window.flipAPI?.adblockIsWhitelisted) {
            window.flipAPI.adblockIsWhitelisted(abHost).then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = null; break;
        }
        case 'adblock.getWhitelist': {
          if (window.flipAPI?.adblockGetWhitelist) {
            window.flipAPI.adblockGetWhitelist().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = null; break;
        }
        case 'adblock.getBlockedCount': {
          if (window.flipAPI?.getBlockedCount) {
            window.flipAPI.getBlockedCount().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = null; break;
        }
        case 'settings.get': {
          if (window.flipAPI?.getSettings) {
            window.flipAPI.getSettings().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = null; break;
        }
        case 'proxy.getStatus': {
          if (window.flipAPI?.getProxyStatus) {
            window.flipAPI.getProxyStatus().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = null; break;
        }
        case 'proxy.checkIp': {
          if (window.flipAPI?.checkIp) {
            window.flipAPI.checkIp().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = null; break;
        }
        case 'browser.getSecurityStatus': {
          if (window.flipAPI?.getSecurityStatus) {
            window.flipAPI.getSecurityStatus().then(r => { iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*'); });
            return;
          }
          result = null; break;
        }
        case 'fs.listDir': {
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) {
            result = { error: 'Only trusted extensions can access the filesystem' };
            break;
          }
          const listPath = sanitizeString(payload?.dirPath, 1024);
          if (!listPath) { result = { error: 'Invalid path' }; break; }
          if (window.flipAPI?.extFsListDir) {
            window.flipAPI.extFsListDir(listPath).then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            });
            return;
          }
          result = { error: 'Filesystem API not available' };
          break;
        }
        case 'fs.getSize': {
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) {
            result = { error: 'Only trusted extensions can access the filesystem' };
            break;
          }
          const sizePath = sanitizeString(payload?.dirPath, 1024);
          if (!sizePath) { result = { error: 'Invalid path' }; break; }
          if (window.flipAPI?.extFsGetSize) {
            window.flipAPI.extFsGetSize(sizePath).then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            });
            return;
          }
          result = { error: 'Filesystem API not available' };
          break;
        }
        case 'fs.delete': {
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) {
            result = { error: 'Only trusted extensions can access the filesystem' };
            break;
          }
          const delPaths = payload?.filePaths;
          if (!Array.isArray(delPaths)) { result = { error: 'Invalid file paths' }; break; }
          if (window.flipAPI?.extFsDelete) {
            window.flipAPI.extFsDelete(delPaths).then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            });
            return;
          }
          result = { error: 'Filesystem API not available' };
          break;
        }
        case 'fs.getSafeFolders': {
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) {
            result = { error: 'Only trusted extensions can access the filesystem' };
            break;
          }
          if (window.flipAPI?.extFsGetSafeFolders) {
            window.flipAPI.extFsGetSafeFolders().then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            });
            return;
          }
          result = { error: 'Filesystem API not available' };
          break;
        }
        case 'fs.getDiskUsage': {
          if (!TRUSTED_EXTENSION_IDS.includes(extension.id)) {
            result = { error: 'Only trusted extensions can access the filesystem' };
            break;
          }
          if (window.flipAPI?.extFsDiskUsage) {
            window.flipAPI.extFsDiskUsage().then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            });
            return;
          }
          result = { error: 'Filesystem API not available' };
          break;
        }
        case 'net.saveFile': {
          const b64 = payload?.base64;
          const fname = sanitizeString(payload?.filename, 255);
          const srcLabel = sanitizeString(payload?.source, 100) || extension.manifest?.name || extension.id;
          if (!b64 || !fname) {
            result = { error: 'Missing base64 data or filename' };
            break;
          }
          if (window.flipAPI?.extSaveFile) {
            window.flipAPI.extSaveFile(b64, fname, srcLabel).then(r => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: r }, '*');
            }).catch(err => {
              iframeRef.current?.contentWindow?.postMessage({ source: 'flip-host', callbackId, result: { error: err.message } }, '*');
            });
            return;
          }
          result = { error: 'Save API not available' };
          break;
        }
        default:
          console.warn(`[Flip Security] Unknown API call "${type}" from extension "${extension.id}"`);
          result = null;
      }

      // Send response back to iframe
      iframeRef.current?.contentWindow?.postMessage({
        source: 'flip-host',
        callbackId,
        result,
      }, '*');
    }

    window.addEventListener('message', handleMessage);

    // Forward AI streaming events from main process to extension iframe
    let unsubStreamToken, unsubStreamDone;
    if (permissions.includes('ai') && window.flipAPI) {
      const streamTokenHandler = (token) => {
        iframeRef.current?.contentWindow?.postMessage({ type: 'ai-stream-token', token }, '*');
      };
      const streamDoneHandler = () => {
        iframeRef.current?.contentWindow?.postMessage({ type: 'ai-stream-done' }, '*');
      };
      unsubStreamToken = window.flipAPI.onAiStreamToken(streamTokenHandler);
      unsubStreamDone = window.flipAPI.onAiStreamDone(streamDoneHandler);
    }

    // Forward AI prompt events (from context menu, address bar, etc.) to ai-chat extension
    let aiPromptHandler;
    if (extension.id === 'ai-chat') {
      aiPromptHandler = (e) => {
        const { prompt } = e.detail || {};
        if (prompt) {
          iframeRef.current?.contentWindow?.postMessage({ type: 'ai-prompt', prompt }, '*');
        }
      };
      window.addEventListener('flip-ai-prompt', aiPromptHandler);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (aiPromptHandler) window.removeEventListener('flip-ai-prompt', aiPromptHandler);
      if (unsubStreamToken) unsubStreamToken();
      if (unsubStreamDone) unsubStreamDone();
    };
  }, [extension.id, permissions]);

  if (!extension.enabled) return null;

  // Webview-type extensions embed a URL directly using Electron's <webview> tag
  // which bypasses X-Frame-Options restrictions unlike iframes
  if (extension.manifest.content_type === 'webview' && extension.manifest.url) {
    if (!isUrlSafe(extension.manifest.url)) {
      return (
        <div style={{ padding: 20, color: 'rgba(255,100,100,0.8)', fontSize: 12 }}>
          ⚠ Extension "{extension.manifest.name}" blocked: unsafe URL protocol.
        </div>
      );
    }
    const webviewAllowPopups = permissions.includes('popups');
    return (
      <webview
        ref={iframeRef}
        src={extension.manifest.url}
        className="extension-frame"
        style={{ width, height, border: 'none', background: 'transparent', display: 'flex' }}
        {...(webviewAllowPopups ? { allowpopups: 'true' } : {})}
        webpreferences="nodeIntegration=no, contextIsolation=yes"
        useragent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        title={extension.manifest.name}
      />
    );
  }

  const html = buildExtensionHTML();
  const needsWebRTC = permissions.includes('webrtc');

  const allowParts = ['autoplay'];
  if (needsWebRTC) {
    allowParts.push('camera', 'microphone', 'display-capture');
  }

  // WebRTC extensions skip sandbox entirely — getUserMedia requires same-origin
  // access which defeats sandbox protections anyway. Non-WebRTC extensions
  // remain sandboxed for security.
  let sandboxFlags = null;
  if (!needsWebRTC) {
    sandboxFlags = 'allow-scripts allow-forms';
    if (permissions.includes('popups')) sandboxFlags += ' allow-popups';
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      className="extension-frame"
      style={{ width, height, border: 'none', background: 'transparent' }}
      {...(sandboxFlags ? { sandbox: sandboxFlags } : {})}
      allow={allowParts.join('; ')}
      title={extension.manifest.name}
    />
  );
}

// Basic JSX transpilation helper (fallback when Babel isn't used)
function basicJSXTranspile(code) {
  // The iframe uses Babel standalone for proper JSX transpilation
  // This function is a fallback for simple cases
  return code;
}
