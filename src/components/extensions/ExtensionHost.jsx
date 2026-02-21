import React, { useEffect, useRef, useCallback } from 'react';
import useBrowserStore from '../../store/browserStore';

// ── Security: Permission mapping ─────────────────────────────────
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
};

// ── Security: Trusted first-party extension IDs ─────────────────
// These extensions are built by CROAKWORKS and are implicitly trusted
const TRUSTED_EXTENSION_IDS = [
  'ai-chat', 'community-chat', 'flipprx-miner', 'flipprx-game',
  'mimo-messenger', 'music-player', 'sample-weather', 'sample-notes',
  'color-picker', 'json-formatter', 'regex-tester', 'xrpl-wallet',
  'flip-call', 'file-cleaner', 'security-dashboard',
];

// ── Security: Rate limiter ───────────────────────────────────────
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

// ── Security: URL validator ──────────────────────────────────────
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

// ── Security: Sanitize source code ───────────────────────────────
function sanitizeSourceCode(code) {
  if (!code || typeof code !== 'string') return '';
  // Escape </script> to prevent breaking out of the script context
  return code.replace(/<\/script/gi, '<\\/script');
}

// ── Security: Validate payload values ────────────────────────────
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

        browser: {
          getInfo() {
            return { name: 'Flip Browser', version: '1.0.0' };
          },
          executeScript(script) { return Flip._postMessage('browser.executeScript', { script }); },
        },
      };

      // ── Media device polyfill for extension iframes ──
      // srcDoc iframes may not have direct media device access even without sandbox.
      // Polyfill getUserMedia to use the parent window's navigator as fallback.
      (function() {
        try {
          const parentMedia = window.parent?.navigator?.mediaDevices;
          if (parentMedia && parentMedia.getUserMedia) {
            const origGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
            if (navigator.mediaDevices) {
              navigator.mediaDevices.getUserMedia = async function(constraints) {
                try {
                  if (origGetUserMedia) return await origGetUserMedia(constraints);
                } catch(e) {
                  console.log('[FlipSDK] iframe getUserMedia failed, trying parent:', e.name);
                }
                return parentMedia.getUserMedia(constraints);
              };
              navigator.mediaDevices.enumerateDevices = function() {
                return parentMedia.enumerateDevices();
              };
            } else {
              Object.defineProperty(navigator, 'mediaDevices', { value: parentMedia, writable: false });
            }
          }
        } catch(e) { console.warn('[FlipSDK] Media polyfill skipped:', e.message); }
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

    // ── Security: Dynamic CSP based on permissions ──
    // Only grant network access if extension declares 'network' permission
    const hasNetwork = permissions.includes('network');
    const connectSrc = hasNetwork ? 'connect-src https: http: wss: ws:;' : 'connect-src \'none\';';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'unsafe-inline'; ${connectSrc} img-src https: http: data:; font-src https: data:; media-src https: http: data: blob:;">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: transparent;
      color: rgba(255,255,255,0.8);
      font-size: 13px;
      padding: 12px;
      overflow-x: hidden;
    }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,122,77,0.2); border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,122,77,0.35); }
    button {
      cursor: pointer;
      border: none;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.7);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      transition: all 0.15s;
    }
    button:hover { background: rgba(255,255,255,0.12); color: white; }
    input, textarea {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: white;
      padding: 6px 10px;
      font-size: 12px;
      outline: none;
      width: 100%;
    }
    input:focus, textarea:focus { border-color: rgba(255,98,52,0.5); }
    h1, h2, h3 { font-weight: 600; }
    h1 { font-size: 16px; }
    h2 { font-size: 14px; }
    h3 { font-size: 12px; }
    .card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 8px;
    }
    a { color: rgba(255,122,77,0.8); text-decoration: none; }
    a:hover { color: rgba(255,122,77,1); }
    .badge {
      display: inline-block;
      background: rgba(255,98,52,0.15);
      color: rgba(255,98,52,0.9);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
    }
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

      // ── Security: Check permission ──
      const requiredPerm = PERMISSION_MAP[type];
      if (requiredPerm !== undefined && requiredPerm !== null && !permissions.includes(requiredPerm)) {
        console.warn(`[Flip Security] Extension "${extension.id}" blocked: requires "${requiredPerm}" permission for ${type}`);
        iframeRef.current?.contentWindow?.postMessage({
          source: 'flip-host', callbackId,
          result: null, error: `Permission denied: "${requiredPerm}" not granted`,
        }, '*');
        return;
      }

      // ── Security: Rate limit ──
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
              // ── Security: Mask API key — never expose raw key to extensions ──
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
    let streamTokenHandler, streamDoneHandler;
    if (permissions.includes('ai') && window.flipAPI) {
      streamTokenHandler = (token) => {
        iframeRef.current?.contentWindow?.postMessage({ type: 'ai-stream-token', token }, '*');
      };
      streamDoneHandler = () => {
        iframeRef.current?.contentWindow?.postMessage({ type: 'ai-stream-done' }, '*');
      };
      window.flipAPI.onAiStreamToken(streamTokenHandler);
      window.flipAPI.onAiStreamDone(streamDoneHandler);
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
    };
  }, [extension.id, permissions]);

  if (!extension.enabled) return null;

  // Webview-type extensions embed a URL directly using Electron's <webview> tag
  // which bypasses X-Frame-Options restrictions unlike iframes
  if (extension.manifest.content_type === 'webview' && extension.manifest.url) {
    // ── Security: Validate webview URL ──
    if (!isUrlSafe(extension.manifest.url)) {
      return (
        <div style={{ padding: 20, color: 'rgba(255,100,100,0.8)', fontSize: 12 }}>
          ⚠ Extension "{extension.manifest.name}" blocked: unsafe URL protocol.
        </div>
      );
    }
    // ── Security: Only allow popups for extensions that declare 'popups' permission ──
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

  // ── Security: Build allow attribute based on permissions ──
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
