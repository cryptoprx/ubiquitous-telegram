import React, { useEffect, useRef, useCallback, useState } from 'react';
import useBrowserStore from '../store/browserStore';

const FONT_FAMILIES = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

function buildReadingCSS(rs) {
  const ff = FONT_FAMILIES[rs?.fontFamily] || FONT_FAMILIES.serif;
  const fs = rs?.fontSize || 18;
  const bg = rs?.bgColor || '#1a1a1a';
  const tc = rs?.textColor || '#e0e0e0';
  return `
  nav, header, footer, aside, .sidebar, .ad, .ads, .advertisement,
  .social-share, .comments, .comment-section, .related-posts,
  .cookie-banner, .popup, .modal, .overlay, .newsletter,
  [role="banner"], [role="navigation"], [role="complementary"],
  [role="contentinfo"], .share-buttons, .breadcrumbs { display: none !important; }
  body {
    max-width: 680px !important; margin: 0 auto !important;
    padding: 40px 24px !important; background: ${bg} !important;
    color: ${tc} !important; font-family: ${ff} !important;
    font-size: ${fs}px !important; line-height: 1.8 !important;
  }
  img { max-width: 100% !important; height: auto !important; border-radius: 8px !important; margin: 16px 0 !important; }
  a { color: #ff7a4d !important; }
  h1, h2, h3, h4, h5, h6 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; color: #ffffff !important; line-height: 1.3 !important; margin-top: 1.5em !important; }
  pre, code { background: rgba(255,255,255,0.05) !important; color: ${tc} !important; border-radius: 6px !important; padding: 2px 6px !important; font-size: 14px !important; }
  pre { padding: 16px !important; overflow-x: auto !important; }
  blockquote { border-left: 3px solid #ff7a4d !important; margin-left: 0 !important; padding-left: 20px !important; color: #aaa !important; }
  table { border-collapse: collapse !important; } th, td { border: 1px solid #333 !important; padding: 8px 12px !important; }
`;
}

const isPrivateWindow = new URLSearchParams(window.location.search).get('private') === '1';

function autoTranslateIfNeeded(webview, tabId) {
  const userLang = useBrowserStore.getState().settings?.language || 'en';
  // Only auto-translate if user language is NOT English (English pages are the majority)
  if (userLang === 'en') return;
  // Skip internal pages
  try {
    const tab = useBrowserStore.getState().tabs.find(t => t.id === tabId);
    if (!tab || !tab.url || tab.url.startsWith('flip://') || tab.url.startsWith('about:')) return;
  } catch { return; }

  const tl = userLang.replace(/[^a-z]/gi, '').slice(0, 5);
  webview.executeJavaScript(`
    (function() {
      if (window.__flipAutoTranslated) return 'skip';
      var pageLang = (document.documentElement.lang || '').toLowerCase().split('-')[0];
      // If page has no lang attr, try to detect from meta or default to unknown
      if (!pageLang) {
        var meta = document.querySelector('meta[http-equiv="content-language"]');
        if (meta) pageLang = (meta.content || '').toLowerCase().split('-')[0];
      }
      // If page is already in user's language, skip
      if (pageLang === '${tl}') return 'same';
      // If we can't detect and page is likely English, translate
      return pageLang || 'unknown';
    })()
  `).then(result => {
    if (result === 'skip' || result === 'same') return;
    // Page language differs — auto-translate silently
    webview.executeJavaScript(`
      (function() {
        if (window.__flipAutoTranslated) return;
        window.__flipAutoTranslated = true;
        window.__flipTranslateOriginal = new Map();

        function getTextNodes(el) {
          var nodes = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
            acceptNode: function(n) {
              if (!n.textContent.trim()) return NodeFilter.FILTER_REJECT;
              var p = n.parentElement;
              if (!p) return NodeFilter.FILTER_REJECT;
              var tag = p.tagName;
              if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'CODE' || tag === 'PRE') return NodeFilter.FILTER_REJECT;
              if (p.isContentEditable || p.closest('input,textarea,select,[contenteditable]')) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          });
          while (walker.nextNode()) nodes.push(walker.currentNode);
          return nodes;
        }

        async function translateBatch(texts, tl) {
          var query = texts.map(function(t) { return 'q=' + encodeURIComponent(t); }).join('&');
          var url = 'https://translate.googleapis.com/translate_a/t?client=gtx&sl=auto&tl=' + tl + '&' + query;
          try {
            var resp = await fetch(url);
            var data = await resp.json();
            if (Array.isArray(data) && Array.isArray(data[0])) return data.map(function(d) { return d[0]; });
            if (Array.isArray(data)) return data.map(function(d) { return typeof d === 'string' ? d : (d[0] || ''); });
            return texts;
          } catch(e) {
            try {
              var results = [];
              for (var i = 0; i < texts.length; i++) {
                var u2 = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + tl + '&dt=t&q=' + encodeURIComponent(texts[i]);
                var r2 = await fetch(u2);
                var d2 = await r2.json();
                results.push(d2[0].map(function(s){return s[0];}).join(''));
              }
              return results;
            } catch(e2) { return texts; }
          }
        }

        async function doAutoTranslate(tl) {
          try {
            var nodes = getTextNodes(document.body);
            var banner = document.getElementById('flip-auto-tl-banner');
            nodes = nodes.filter(function(n) { return !banner || !banner.contains(n); });
            var BATCH = 40, MAX_CHARS = 4500, i = 0;
            while (i < nodes.length) {
              var batch = [], batchNodes = [], chars = 0;
              while (i < nodes.length && batch.length < BATCH && chars < MAX_CHARS) {
                var txt = nodes[i].textContent.trim();
                if (txt.length > 0 && txt.length < 2000) {
                  batch.push(txt);
                  batchNodes.push(nodes[i]);
                  chars += txt.length;
                }
                i++;
              }
              if (batch.length === 0) continue;
              var results = await translateBatch(batch, tl);
              for (var j = 0; j < batchNodes.length; j++) {
                if (results[j] && results[j] !== batch[j]) {
                  window.__flipTranslateOriginal.set(batchNodes[j], batchNodes[j].textContent);
                  batchNodes[j].textContent = results[j];
                }
              }
            }
          } catch(err) { console.error('[Flip Translate]', err); }
        }

        // Small auto-translate banner
        var banner = document.createElement('div');
        banner.id = 'flip-auto-tl-banner';
        banner.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:999999;background:#1c1917;border:1px solid #ff623440;border-radius:10px;padding:6px 14px;display:flex;align-items:center;gap:8px;font-family:system-ui,sans-serif;font-size:11px;color:#bbb;box-shadow:0 4px 20px rgba(0,0,0,0.5);transition:opacity 0.3s;';
        banner.innerHTML = '<span style="color:#ff7a4d;font-weight:600;">Translated</span>'
          + '<button id="flip-atl-restore" style="background:#2a2a2a;color:#aaa;border:1px solid #444;border-radius:5px;padding:2px 8px;cursor:pointer;font-size:10px;">Show Original</button>'
          + '<button id="flip-atl-close" style="background:transparent;color:#666;border:none;cursor:pointer;font-size:14px;padding:0 2px;">✕</button>';
        document.body.appendChild(banner);

        document.getElementById('flip-atl-restore').onclick = function() {
          var btn = this;
          if (btn.textContent === 'Show Original') {
            window.__flipTranslateOriginal.forEach(function(orig, node) { try { node.textContent = orig; } catch(e) {} });
            btn.textContent = 'Translate';
            btn.previousElementSibling.textContent = 'Original';
          } else {
            // Re-translate
            window.__flipTranslateOriginal.forEach(function(orig, node) { try { node.textContent = orig; } catch(e) {} });
            window.__flipTranslateOriginal.clear();
            doAutoTranslate('${tl}');
            btn.textContent = 'Show Original';
            btn.previousElementSibling.textContent = 'Translated';
          }
        };
        document.getElementById('flip-atl-close').onclick = function() {
          banner.style.opacity = '0';
          setTimeout(function() { banner.remove(); }, 300);
        };

        // Auto-fade banner after 5 seconds
        setTimeout(function() {
          if (banner.parentNode) {
            banner.style.opacity = '0.4';
            banner.onmouseenter = function() { banner.style.opacity = '1'; };
            banner.onmouseleave = function() { banner.style.opacity = '0.4'; };
          }
        }, 5000);

        doAutoTranslate('${tl}');
      })();
    `).catch(() => {});
  }).catch(() => {});
}

export default function WebContent({ tabId: overrideTabId }) {
  const { tabs, activeTabId, updateTab } = useBrowserStore();
  const webviewRefs = useRef({});

  const targetTabId = overrideTabId || activeTabId;

  const [findBarOpen, setFindBarOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findResult, setFindResult] = useState(null); // { activeMatchOrdinal, matches }
  const findInputRef = useRef(null);

  // Set up webview event listeners
  const setupWebview = useCallback((webview, tabId) => {
    if (!webview || webview._flipSetup) return;
    webview._flipSetup = true;

    webview.addEventListener('did-start-loading', () => {
      useBrowserStore.getState().updateTab(tabId, { loading: true });
    });

    webview.addEventListener('did-stop-loading', () => {
      useBrowserStore.getState().updateTab(tabId, { loading: false });
      autoTranslateIfNeeded(webview, tabId);
    });

    webview.addEventListener('media-started-playing', () => {
      useBrowserStore.getState().updateTab(tabId, { isAudible: true });
    });
    webview.addEventListener('media-paused', () => {
      useBrowserStore.getState().updateTab(tabId, { isAudible: false });
    });

    webview.addEventListener('found-in-page', (e) => {
      if (e.result) {
        const ev = new CustomEvent('flip-find-result', { detail: { activeMatchOrdinal: e.result.activeMatchOrdinal, matches: e.result.matches } });
        window.dispatchEvent(ev);
      }
    });

    webview.addEventListener('page-title-updated', (e) => {
      useBrowserStore.getState().updateTab(tabId, { title: e.title });
      // Add to history (skip in private mode)
      if (!isPrivateWindow) {
        const tab = useBrowserStore.getState().tabs.find((t) => t.id === tabId);
        if (tab && tab.url && !tab.url.startsWith('flip://')) {
          window.flipAPI?.addHistory({ url: tab.url, title: e.title });
        }
      }
    });

    webview.addEventListener('page-favicon-updated', (e) => {
      if (e.favicons && e.favicons.length > 0) {
        useBrowserStore.getState().updateTab(tabId, { favicon: e.favicons[0] });
      }
    });

    webview.addEventListener('did-navigate', (e) => {
      useBrowserStore.getState().updateTab(tabId, {
        url: e.url,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward(),
      });
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
      useBrowserStore.getState().updateTab(tabId, {
        url: e.url,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward(),
      });
    });

    webview.addEventListener('new-window', (e) => {
      e.preventDefault();
      useBrowserStore.getState().addTab(e.url);
    });

    webview.addEventListener('did-fail-load', (e) => {
      if (e.errorCode === -3) return; // Aborted
      useBrowserStore.getState().updateTab(tabId, { loading: false });
    });

    // Custom context menu
    webview.addEventListener('context-menu', (e) => {
      const params = e.params || {};
      window.dispatchEvent(new CustomEvent('flip-context-menu', {
        detail: {
          x: params.x,
          y: params.y,
          linkURL: params.linkURL || '',
          selectionText: params.selectionText || '',
          isEditable: params.isEditable || false,
          pageURL: webview.getURL(),
          tabId,
        },
      }));
    });

    webview.addEventListener('dom-ready', () => {
      // Inject credential autofill from saved passwords
      const url = webview.getURL();
      try {
        const domain = new URL(url).hostname;
        window.flipAPI?.getPasswords().then((passwords) => {
          if (!passwords || !passwords.length) return;
          const match = passwords.find((p) => domain.includes(p.site) || p.site.includes(domain));
          if (match) {
            webview.executeJavaScript(`
              (function() {
                var forms = document.querySelectorAll('form');
                forms.forEach(function(form) {
                  var passInput = form.querySelector('input[type="password"]');
                  if (!passInput) return;
                  var userInput = form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="login"], input[name*="email"], input[autocomplete="username"]');
                  if (userInput && !userInput.value) {
                    userInput.value = ${JSON.stringify(match.username)};
                    userInput.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                  if (!passInput.value) {
                    passInput.value = ${JSON.stringify(match.password)};
                    passInput.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                });
              })();
            `).catch(() => {});
          }
        });
      } catch {}

      // PWA detection — check for web app manifest
      webview.executeJavaScript(`
        (function() {
          var link = document.querySelector('link[rel="manifest"]');
          if (link) {
            var href = link.href;
            fetch(href).then(function(r) { return r.json(); }).then(function(m) {
              console.log('FLIP_PWA:' + JSON.stringify({
                name: m.name || m.short_name || '',
                icon: (m.icons && m.icons.length) ? new URL(m.icons[m.icons.length - 1].src, location.origin).href : '',
                start_url: m.start_url ? new URL(m.start_url, location.origin).href : location.origin,
              }));
            }).catch(function(){});
          }
        })();
      `).catch(() => {});

      // Inject form submission detector
      webview.executeJavaScript(`
        (function() {
          if (window.__flipCredWatcher) return;
          window.__flipCredWatcher = true;
          document.addEventListener('submit', function(e) {
            var form = e.target;
            var passInput = form.querySelector('input[type="password"]');
            if (!passInput || !passInput.value) return;
            var userInput = form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="login"], input[name*="email"], input[autocomplete="username"]');
            var username = userInput ? userInput.value : '';
            if (!username) return;
            console.log('FLIP_CRED:' + JSON.stringify({
              site: location.hostname,
              username: username,
              password: passInput.value
            }));
          }, true);
        })();
      `).catch(() => {});
    });

    // Listen for credential capture and PWA detection from injected scripts
    webview.addEventListener('console-message', (e) => {
      if (e.message && e.message.startsWith('FLIP_CRED:') && !isPrivateWindow) {
        try {
          const cred = JSON.parse(e.message.slice(10));
          window.flipAPI?.getPasswords().then((passwords) => {
            const exists = passwords?.some((p) => p.site === cred.site && p.username === cred.username);
            if (!exists) {
              useBrowserStore.getState().setPendingCredential({ ...cred, tabId });
            }
          });
        } catch {}
      }
      if (e.message && e.message.startsWith('FLIP_PWA:')) {
        try {
          const pwa = JSON.parse(e.message.slice(9));
          useBrowserStore.getState().updateTab(tabId, { pwa });
        } catch {}
      }
    });
  }, []);

  // Listen for navigation events from AddressBar
  useEffect(() => {
    function handleNavigate(e) {
      const { tabId, url } = e.detail;
      const webview = webviewRefs.current[tabId];
      if (webview && url && !url.startsWith('flip://')) {
        webview.loadURL(url, {
          extraHeaders: 'Cache-Control: no-cache\nPragma: no-cache\n',
        });
      }
    }

    function handleGoBack(e) {
      const { tabId } = e.detail;
      const webview = webviewRefs.current[tabId];
      if (webview?.canGoBack()) webview.goBack();
    }

    function handleGoForward(e) {
      const { tabId } = e.detail;
      const webview = webviewRefs.current[tabId];
      if (webview?.canGoForward()) webview.goForward();
    }

    function handleReload(e) {
      const { tabId } = e.detail;
      const webview = webviewRefs.current[tabId];
      webview?.reloadIgnoringCache();
    }

    function handleHardReload(e) {
      const { tabId } = e.detail;
      const webview = webviewRefs.current[tabId];
      if (webview) {
        webview.reloadIgnoringCache();
      }
    }

    function handlePip(e) {
      const { tabId } = e.detail;
      const webview = webviewRefs.current[tabId];
      if (webview) {
        webview.executeJavaScript(`
          (function() {
            const video = document.querySelector('video');
            if (video) {
              if (document.pictureInPictureElement) {
                document.exitPictureInPicture();
              } else {
                video.requestPictureInPicture().catch(() => {});
              }
            }
          })();
        `).catch(() => {});
      }
    }

    // Execute script in active webview (from extensions via Flip.browser.executeScript)
    function handleExecuteScript(e) {
      const { execId, script } = e.detail || {};
      if (!execId || !script) return;
      const activeId = useBrowserStore.getState().activeTabId;
      const webview = webviewRefs.current[activeId];
      if (!webview) {
        window.dispatchEvent(new CustomEvent('flip-execute-script-result', { detail: { execId, result: { error: 'No active webview' } } }));
        return;
      }
      webview.executeJavaScript(script)
        .then(r => {
          window.dispatchEvent(new CustomEvent('flip-execute-script-result', { detail: { execId, result: r } }));
        })
        .catch(err => {
          window.dispatchEvent(new CustomEvent('flip-execute-script-result', { detail: { execId, result: { error: err.message } } }));
        });
    }

    // Extract page text content for AI Tab Assistant
    function handleExtractContent(e) {
      const { tabId } = e.detail || {};
      const tid = tabId || useBrowserStore.getState().activeTabId;
      const webview = webviewRefs.current[tid];
      if (!webview) {
        window.dispatchEvent(new CustomEvent('flip-page-content-result', { detail: { text: '', error: 'No webview' } }));
        return;
      }
      webview.executeJavaScript(`
        (function() {
          // Extract meaningful text content from the page
          var sel = ['article', 'main', '[role="main"]', '.post-content', '.entry-content', '.content', '#content'];
          var container = null;
          for (var i = 0; i < sel.length; i++) {
            container = document.querySelector(sel[i]);
            if (container) break;
          }
          if (!container) container = document.body;
          // Remove script/style/nav/footer noise
          var clone = container.cloneNode(true);
          var remove = clone.querySelectorAll('script, style, nav, footer, header, aside, .sidebar, .ad, .ads, .cookie-banner, .popup, noscript, svg, iframe');
          remove.forEach(function(el) { el.remove(); });
          var text = clone.innerText || clone.textContent || '';
          // Clean up whitespace
          text = text.replace(/\\n{3,}/g, '\\n\\n').replace(/[ \\t]+/g, ' ').trim();
          return { text: text, title: document.title, url: window.location.href };
        })();
      `).then(result => {
        window.dispatchEvent(new CustomEvent('flip-page-content-result', { detail: result }));
      }).catch(err => {
        window.dispatchEvent(new CustomEvent('flip-page-content-result', { detail: { text: '', error: err.message } }));
      });
    }

    window.addEventListener('flip-navigate', handleNavigate);
    window.addEventListener('flip-go-back', handleGoBack);
    window.addEventListener('flip-go-forward', handleGoForward);
    window.addEventListener('flip-reload', handleReload);
    window.addEventListener('flip-hard-reload', handleHardReload);
    window.addEventListener('flip-pip', handlePip);
    window.addEventListener('flip-execute-script', handleExecuteScript);
    window.addEventListener('flip-extract-page-content', handleExtractContent);

    return () => {
      window.removeEventListener('flip-navigate', handleNavigate);
      window.removeEventListener('flip-go-back', handleGoBack);
      window.removeEventListener('flip-go-forward', handleGoForward);
      window.removeEventListener('flip-reload', handleReload);
      window.removeEventListener('flip-hard-reload', handleHardReload);
      window.removeEventListener('flip-pip', handlePip);
      window.removeEventListener('flip-execute-script', handleExecuteScript);
      window.removeEventListener('flip-extract-page-content', handleExtractContent);
    };
  }, []);

  // Reading mode: inject/remove CSS when toggled (uses dynamic reader settings)
  useEffect(() => {
    let prevRM = useBrowserStore.getState().readingMode;
    let prevRS = JSON.stringify(useBrowserStore.getState().readerSettings);
    const unsub = useBrowserStore.subscribe((state) => {
      const rm = state.readingMode;
      const rsStr = JSON.stringify(state.readerSettings);
      const rmChanged = rm !== prevRM;
      const rsChanged = rsStr !== prevRS;
      prevRM = rm;
      prevRS = rsStr;
      const webview = webviewRefs.current[state.activeTabId];
      if (!webview) return;
      if (rm && (rmChanged || rsChanged)) {
        // Remove old CSS first
        if (webview._readingCSSKey) {
          webview.removeInsertedCSS(webview._readingCSSKey).catch(() => {});
        }
        const css = buildReadingCSS(state.readerSettings);
        webview.insertCSS(css).then((key) => {
          webview._readingCSSKey = key;
        }).catch(() => {});
      } else if (!rm && rmChanged && webview._readingCSSKey) {
        webview.removeInsertedCSS(webview._readingCSSKey).catch(() => {});
        webview._readingCSSKey = null;
      }
    });
    return unsub;
  }, []);

  // Screenshot handler
  useEffect(() => {
    function handleScreenshot(e) {
      const { tabId } = e.detail;
      const webview = webviewRefs.current[tabId];
      if (webview) {
        webview.capturePage().then((image) => {
          const dataUrl = image.toDataURL();
          window.flipAPI?.saveScreenshot(dataUrl);
        }).catch(() => {});
      }
    }
    // Translation handler — in-place DOM translation via Google Translate API
    function handleTranslate(e) {
      const { tabId, targetLang } = e.detail;
      const webview = webviewRefs.current[tabId];
      if (webview) {
        const lang = (targetLang || 'en').replace(/[^a-z]/gi, '').slice(0, 5);
        webview.executeJavaScript(`
          (function() {
            if (document.getElementById('flip-translate-bar')) return;
            if (window.__flipTranslateOriginal) return;
            window.__flipTranslateOriginal = new Map();
            var translating = false;

            // Collect visible text nodes
            function getTextNodes(el) {
              var nodes = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
                acceptNode: function(n) {
                  if (!n.textContent.trim()) return NodeFilter.FILTER_REJECT;
                  var p = n.parentElement;
                  if (!p) return NodeFilter.FILTER_REJECT;
                  var tag = p.tagName;
                  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'CODE' || tag === 'PRE') return NodeFilter.FILTER_REJECT;
                  if (p.isContentEditable || p.closest('input,textarea,select,[contenteditable]')) return NodeFilter.FILTER_REJECT;
                  return NodeFilter.FILTER_ACCEPT;
                }
              });
              while (walker.nextNode()) nodes.push(walker.currentNode);
              return nodes;
            }

            // Translate a batch of strings
            async function translateBatch(texts, tl) {
              var query = texts.map(function(t) { return 'q=' + encodeURIComponent(t); }).join('&');
              var url = 'https://translate.googleapis.com/translate_a/t?client=gtx&sl=auto&tl=' + tl + '&' + query;
              try {
                var resp = await fetch(url);
                var data = await resp.json();
                if (Array.isArray(data) && Array.isArray(data[0])) return data.map(function(d) { return d[0]; });
                if (Array.isArray(data)) return data.map(function(d) { return typeof d === 'string' ? d : (d[0] || ''); });
                return texts;
              } catch(e) {
                // Fallback: single-text endpoint
                try {
                  var results = [];
                  for (var i = 0; i < texts.length; i++) {
                    var u2 = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + tl + '&dt=t&q=' + encodeURIComponent(texts[i]);
                    var r2 = await fetch(u2);
                    var d2 = await r2.json();
                    results.push(d2[0].map(function(s){return s[0];}).join(''));
                  }
                  return results;
                } catch(e2) { return texts; }
              }
            }

            async function doTranslate(tl) {
              if (translating) return;
              translating = true;
              var status = document.getElementById('flip-tl-status');
              if (status) status.textContent = 'Translating...';
              var btn = document.getElementById('flip-tl-go');
              if (btn) btn.disabled = true;
              try {
                // Restore originals first if re-translating
                window.__flipTranslateOriginal.forEach(function(orig, node) {
                  try { node.textContent = orig; } catch(e) {}
                });
                window.__flipTranslateOriginal.clear();

                var nodes = getTextNodes(document.body);
                // Filter out bar's own text
                var bar = document.getElementById('flip-translate-bar');
                nodes = nodes.filter(function(n) { return !bar || !bar.contains(n); });

                // Batch translate (max 50 texts per request, max 5000 chars per batch)
                var BATCH = 40, MAX_CHARS = 4500;
                var i = 0, translated = 0;
                while (i < nodes.length) {
                  var batch = [], batchNodes = [], chars = 0;
                  while (i < nodes.length && batch.length < BATCH && chars < MAX_CHARS) {
                    var txt = nodes[i].textContent.trim();
                    if (txt.length > 0 && txt.length < 2000) {
                      batch.push(txt);
                      batchNodes.push(nodes[i]);
                      chars += txt.length;
                    }
                    i++;
                  }
                  if (batch.length === 0) continue;
                  var results = await translateBatch(batch, tl);
                  for (var j = 0; j < batchNodes.length; j++) {
                    if (results[j] && results[j] !== batch[j]) {
                      window.__flipTranslateOriginal.set(batchNodes[j], batchNodes[j].textContent);
                      batchNodes[j].textContent = results[j];
                    }
                  }
                  translated += batch.length;
                  if (status) status.textContent = 'Translated ' + translated + '/' + nodes.length + ' elements...';
                }
                if (status) status.textContent = 'Done — ' + translated + ' elements translated';
              } catch(err) {
                if (status) status.textContent = 'Error: ' + err.message;
              }
              translating = false;
              if (btn) btn.disabled = false;
            }

            function restoreOriginal() {
              window.__flipTranslateOriginal.forEach(function(orig, node) {
                try { node.textContent = orig; } catch(e) {}
              });
              window.__flipTranslateOriginal.clear();
            }

            // Build toolbar
            var bar = document.createElement('div');
            bar.id = 'flip-translate-bar';
            bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#1c1917;border-bottom:2px solid #ff6234;padding:8px 16px;display:flex;align-items:center;gap:10px;font-family:system-ui,sans-serif;font-size:13px;color:#e0e0e0;';
            bar.innerHTML = '<span style="color:#ff7a4d;font-weight:600;">Flip Translate</span>'
              + '<select id="flip-tl" style="background:#2a2a2a;color:#e0e0e0;border:1px solid #444;border-radius:6px;padding:4px 8px;font-size:12px;">'
              + '<option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option>'
              + '<option value="de">German</option><option value="pt">Portuguese</option><option value="zh-CN">Chinese</option>'
              + '<option value="ja">Japanese</option><option value="ko">Korean</option><option value="ar">Arabic</option>'
              + '<option value="hi">Hindi</option><option value="ru">Russian</option><option value="it">Italian</option>'
              + '<option value="nl">Dutch</option><option value="tr">Turkish</option><option value="pl">Polish</option>'
              + '<option value="vi">Vietnamese</option><option value="th">Thai</option><option value="sv">Swedish</option>'
              + '</select>'
              + '<button id="flip-tl-go" style="background:#ff6234;color:white;border:none;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:600;">Translate</button>'
              + '<button id="flip-tl-restore" style="background:#2a2a2a;color:#aaa;border:1px solid #444;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px;">Restore</button>'
              + '<span id="flip-tl-status" style="color:#888;font-size:11px;margin-left:4px;"></span>'
              + '<button id="flip-tl-close" style="background:transparent;color:#888;border:none;cursor:pointer;margin-left:auto;font-size:16px;">✕</button>';
            document.body.prepend(bar);
            document.body.style.marginTop = (bar.offsetHeight) + 'px';
            document.getElementById('flip-tl').value = '${lang}';

            document.getElementById('flip-tl-go').onclick = function() {
              doTranslate(document.getElementById('flip-tl').value);
            };
            document.getElementById('flip-tl-restore').onclick = function() {
              restoreOriginal();
              var s = document.getElementById('flip-tl-status');
              if (s) s.textContent = 'Original restored';
            };
            document.getElementById('flip-tl-close').onclick = function() {
              restoreOriginal();
              bar.remove();
              document.body.style.marginTop = '';
              delete window.__flipTranslateOriginal;
            };

            // Auto-translate on open
            doTranslate('${lang}');
          })();
        `).catch(() => {});
      }
    }
    // Print handler — opens system print dialog
    function handlePrint(e) {
      const { tabId } = e.detail;
      const webview = webviewRefs.current[tabId];
      if (webview) {
        webview.print({ silent: false, printBackground: true });
      }
    }
    // Print to PDF handler — saves page as PDF file
    function handlePrintPdf(e) {
      const { tabId } = e.detail;
      const webview = webviewRefs.current[tabId];
      if (webview) {
        webview.printToPDF({ printBackground: true, landscape: false }).then((data) => {
          const title = webview.getTitle() || 'page';
          const safeName = title.replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 60) || 'page';
          window.flipAPI?.savePdf(data, safeName);
        }).catch(() => {});
      }
    }

    window.addEventListener('flip-screenshot', handleScreenshot);
    window.addEventListener('flip-translate', handleTranslate);
    window.addEventListener('flip-print', handlePrint);
    window.addEventListener('flip-print-pdf', handlePrintPdf);
    return () => {
      window.removeEventListener('flip-screenshot', handleScreenshot);
      window.removeEventListener('flip-translate', handleTranslate);
      window.removeEventListener('flip-print', handlePrint);
      window.removeEventListener('flip-print-pdf', handlePrintPdf);
    };
  }, []);

  useEffect(() => {
    function handleOpenFind() {
      setFindBarOpen(true);
      setTimeout(() => findInputRef.current?.focus(), 50);
    }
    function handleFindResult(e) {
      setFindResult(e.detail);
    }
    window.addEventListener('flip-find-in-page', handleOpenFind);
    window.addEventListener('flip-find-result', handleFindResult);
    return () => {
      window.removeEventListener('flip-find-in-page', handleOpenFind);
      window.removeEventListener('flip-find-result', handleFindResult);
    };
  }, []);

  function findInPage(query, opts = {}) {
    const webview = webviewRefs.current[targetTabId];
    if (webview && query) {
      webview.findInPage(query, opts);
    }
  }
  function stopFind() {
    const webview = webviewRefs.current[targetTabId];
    if (webview) webview.stopFindInPage('clearSelection');
    setFindBarOpen(false);
    setFindQuery('');
    setFindResult(null);
  }
  function findNext() { if (findQuery) findInPage(findQuery, { forward: true, findNext: true }); }
  function findPrev() { if (findQuery) findInPage(findQuery, { forward: false, findNext: true }); }

  useEffect(() => {
    function handleMuteTab(e) {
      const { tabId } = e.detail;
      const webview = webviewRefs.current[tabId];
      if (webview) {
        const current = webview.isAudioMuted();
        webview.setAudioMuted(!current);
        useBrowserStore.getState().updateTab(tabId, { isMuted: !current });
      }
    }
    window.addEventListener('flip-mute-tab', handleMuteTab);
    return () => window.removeEventListener('flip-mute-tab', handleMuteTab);
  }, []);

  const [ctxMenu, setCtxMenu] = useState(null);

  useEffect(() => {
    function handleCtx(e) {
      const d = e.detail;
      if (!d) return;
      // Get the webview element's bounding rect so we can offset the menu position
      const webview = webviewRefs.current[d.tabId];
      const rect = webview?.getBoundingClientRect() || { left: 0, top: 0 };
      setCtxMenu({
        x: (d.x || 0) + rect.left,
        y: (d.y || 0) + rect.top,
        linkURL: d.linkURL,
        selectionText: d.selectionText,
        isEditable: d.isEditable,
        pageURL: d.pageURL,
        tabId: d.tabId,
      });
    }
    function closeCtx() { setCtxMenu(null); }
    window.addEventListener('flip-context-menu', handleCtx);
    window.addEventListener('click', closeCtx);
    window.addEventListener('keydown', closeCtx);
    return () => {
      window.removeEventListener('flip-context-menu', handleCtx);
      window.removeEventListener('click', closeCtx);
      window.removeEventListener('keydown', closeCtx);
    };
  }, []);

  function ctxAction(fn) {
    fn();
    setCtxMenu(null);
  }

  // AI context menu submenu state
  const [aiSubMenu, setAiSubMenu] = useState(null); // 'rewrite' | 'translate' | null

  function sendAiPrompt(prompt, mode, pos) {
    // Show inline AI overlay instead of routing to sidebar
    window.dispatchEvent(new CustomEvent('flip-ai-overlay', {
      detail: { prompt, mode: mode || '', x: pos?.x || 300, y: pos?.y || 200 },
    }));
  }

  const toolbarExts = useBrowserStore((s) => s.extensions).filter(
    (e) => e.enabled && e.manifest?.toolbar_action
  );

  const [snipping, setSnipping] = useState(false);
  const [snipStart, setSnipStart] = useState(null);
  const [snipEnd, setSnipEnd] = useState(null);
  const snipContainerRef = useRef(null);

  useEffect(() => {
    function handleSnip(e) {
      const tabId = e.detail?.tabId || activeTabId;
      const webview = webviewRefs.current[tabId];
      if (!webview) return;
      setSnipping(true);
      setSnipStart(null);
      setSnipEnd(null);
    }
    function handleSnipCancel(e) {
      if (snipping && e.key === 'Escape') {
        setSnipping(false);
        setSnipStart(null);
        setSnipEnd(null);
      }
    }
    window.addEventListener('flip-snip', handleSnip);
    window.addEventListener('keydown', handleSnipCancel);
    return () => {
      window.removeEventListener('flip-snip', handleSnip);
      window.removeEventListener('keydown', handleSnipCancel);
    };
  }, [snipping, activeTabId]);

  function snipMouseDown(e) {
    const rect = snipContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSnipStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setSnipEnd(null);
  }

  function snipMouseMove(e) {
    if (!snipStart) return;
    const rect = snipContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSnipEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function snipMouseUp() {
    if (!snipStart || !snipEnd) {
      setSnipStart(null);
      setSnipEnd(null);
      return;
    }
    const rect = snipContainerRef.current?.getBoundingClientRect();
    if (!rect) { setSnipping(false); return; }

    // Calculate selection box in overlay coordinates
    const sx = Math.min(snipStart.x, snipEnd.x);
    const sy = Math.min(snipStart.y, snipEnd.y);
    const sw = Math.abs(snipEnd.x - snipStart.x);
    const sh = Math.abs(snipEnd.y - snipStart.y);

    if (sw < 5 || sh < 5) {
      setSnipStart(null);
      setSnipEnd(null);
      return;
    }

    // Capture full page then crop
    const webview = webviewRefs.current[activeTabId];
    if (!webview) { setSnipping(false); return; }

    webview.capturePage().then((image) => {
      const fullDataUrl = image.toDataURL();
      const img = new Image();
      img.onload = () => {
        // Scale factor: image may be larger than display due to devicePixelRatio
        const scaleX = img.width / rect.width;
        const scaleY = img.height / rect.height;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(sw * scaleX);
        canvas.height = Math.round(sh * scaleY);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          Math.round(sx * scaleX), Math.round(sy * scaleY),
          Math.round(sw * scaleX), Math.round(sh * scaleY),
          0, 0, canvas.width, canvas.height
        );
        const croppedDataUrl = canvas.toDataURL('image/png');
        window.flipAPI?.saveScreenshot(croppedDataUrl);
      };
      img.src = fullDataUrl;
    }).catch(() => {});

    setSnipping(false);
    setSnipStart(null);
    setSnipEnd(null);
  }

  // Build snip selection rect
  const snipRect = snipStart && snipEnd ? {
    x: Math.min(snipStart.x, snipEnd.x),
    y: Math.min(snipStart.y, snipEnd.y),
    w: Math.abs(snipEnd.x - snipStart.x),
    h: Math.abs(snipEnd.y - snipStart.y),
  } : null;

  return (
    <div className="flex-1 relative overflow-hidden bg-surface-0" ref={snipContainerRef}>
      {/* Find in Page bar */}
      {findBarOpen && (
        <div className="absolute top-0 right-0 z-[9997] flex items-center gap-2 m-3 px-3 py-2 rounded-xl bg-[#1c1917]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/60 animate-fade-in">
          <input
            ref={findInputRef}
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              if (e.target.value) findInPage(e.target.value);
              else { const wv = webviewRefs.current[targetTabId]; if (wv) wv.stopFindInPage('clearSelection'); setFindResult(null); }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.shiftKey ? findPrev() : findNext(); }
              if (e.key === 'Escape') stopFind();
            }}
            placeholder="Find in page..."
            className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/90 placeholder-white/30 outline-none focus:border-flip-500/50 w-52"
            autoFocus
          />
          {findResult && findQuery && (
            <span className="text-[10px] text-white/40 whitespace-nowrap min-w-[50px] text-center">
              {findResult.matches > 0 ? `${findResult.activeMatchOrdinal}/${findResult.matches}` : 'No matches'}
            </span>
          )}
          <button onClick={findPrev} className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors" title="Previous (Shift+Enter)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button onClick={findNext} className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors" title="Next (Enter)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button onClick={stopFind} className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors" title="Close (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Snipping tool overlay */}
      {snipping && (
        <div
          className="absolute inset-0 z-[9998]"
          style={{ cursor: 'crosshair' }}
          onMouseDown={snipMouseDown}
          onMouseMove={snipMouseMove}
          onMouseUp={snipMouseUp}
        >
          {/* Dimmed background */}
          <div className="absolute inset-0 bg-black/40" />
          {/* Selection rectangle */}
          {snipRect && snipRect.w > 0 && snipRect.h > 0 && (
            <>
              {/* Clear selected area by overlaying a bright border box */}
              <div
                className="absolute border-2 border-flip-400 bg-transparent"
                style={{
                  left: snipRect.x,
                  top: snipRect.y,
                  width: snipRect.w,
                  height: snipRect.h,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                }}
              />
              {/* Size indicator */}
              <div
                className="absolute text-[10px] text-white/80 bg-black/70 px-1.5 py-0.5 rounded"
                style={{
                  left: snipRect.x,
                  top: snipRect.y + snipRect.h + 4,
                }}
              >
                {Math.round(snipRect.w)} × {Math.round(snipRect.h)}
              </div>
            </>
          )}
          {/* Instructions bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-surface-3/90 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3 shadow-2xl shadow-black/50">
            <span className="text-[11px] text-white/70">Click and drag to select an area</span>
            <span className="text-[10px] text-white/30">ESC to cancel</span>
          </div>
        </div>
      )}

      {/* Custom context menu */}
      {ctxMenu && (
        <div
          className="fixed z-[9999] min-w-[180px] py-1.5 rounded-xl bg-[#1c1917]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/60 animate-fade-in"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.linkURL && (
            <>
              <CtxItem label="Open Link in New Tab" onClick={() => ctxAction(() => useBrowserStore.getState().addTab(ctxMenu.linkURL))} />
              <CtxItem label="Copy Link" onClick={() => ctxAction(() => navigator.clipboard?.writeText(ctxMenu.linkURL))} />
              <CtxDivider />
            </>
          )}
          {ctxMenu.selectionText && (
            <>
              <CtxItem label="Copy" onClick={() => ctxAction(() => {
                const wv = webviewRefs.current[ctxMenu.tabId];
                wv?.copy();
              })} />
              <CtxItem label={'Search "' + ctxMenu.selectionText.slice(0, 20) + (ctxMenu.selectionText.length > 20 ? '...' : '') + '"'} onClick={() => ctxAction(() => {
                const engine = useBrowserStore.getState().settings.searchEngine || 'https://duckduckgo.com/?q=';
                useBrowserStore.getState().addTab(engine + encodeURIComponent(ctxMenu.selectionText));
              })} />
              <CtxDivider />
              {/* ── AI Actions ── */}
              <CtxItem label="✦ Explain this" accent onClick={() => ctxAction(() => {
                sendAiPrompt(`Explain the following text clearly and concisely:\n\n"${ctxMenu.selectionText}"`, 'explain', { x: ctxMenu.x, y: ctxMenu.y });
              })} />
              <CtxItem label="✦ Define this" accent onClick={() => ctxAction(() => {
                sendAiPrompt(`Define this term or phrase. Give a clear, short definition:\n\n"${ctxMenu.selectionText}"`, 'define', { x: ctxMenu.x, y: ctxMenu.y });
              })} />
              <CtxItem label="✦ Explain code" accent onClick={() => ctxAction(() => {
                sendAiPrompt(`Explain this code step by step. What does it do and how does it work?\n\n\`\`\`\n${ctxMenu.selectionText}\n\`\`\``, 'code', { x: ctxMenu.x, y: ctxMenu.y });
              })} />
              <div className="relative" onMouseEnter={() => setAiSubMenu('translate')} onMouseLeave={() => setAiSubMenu(null)}>
                <CtxItem label="✦ Translate ▸" accent onClick={() => setAiSubMenu(aiSubMenu === 'translate' ? null : 'translate')} />
                {aiSubMenu === 'translate' && (
                  <div className="absolute left-full top-0 ml-0.5 min-w-[120px] py-1.5 rounded-xl bg-[#1c1917]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/60">
                    {['English', 'Spanish', 'French', 'German', 'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Russian', 'Italian'].map(lang => (
                      <CtxItem key={lang} label={lang} onClick={() => ctxAction(() => {
                        sendAiPrompt(`Translate the following text to ${lang}. Only output the translation, nothing else:\n\n"${ctxMenu.selectionText}"`, 'translate', { x: ctxMenu.x, y: ctxMenu.y });
                      })} />
                    ))}
                  </div>
                )}
              </div>
              {ctxMenu.isEditable && (
                <div className="relative" onMouseEnter={() => setAiSubMenu('rewrite')} onMouseLeave={() => setAiSubMenu(null)}>
                  <CtxItem label="✦ Rewrite ▸" accent onClick={() => setAiSubMenu(aiSubMenu === 'rewrite' ? null : 'rewrite')} />
                  {aiSubMenu === 'rewrite' && (
                    <div className="absolute left-full top-0 ml-0.5 min-w-[140px] py-1.5 rounded-xl bg-[#1c1917]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/60">
                      <CtxItem label="Fix grammar" onClick={() => ctxAction(() => {
                        sendAiPrompt(`Fix the grammar and spelling in this text. Only output the corrected text:\n\n"${ctxMenu.selectionText}"`, 'rewrite', { x: ctxMenu.x, y: ctxMenu.y });
                      })} />
                      <CtxItem label="Make shorter" onClick={() => ctxAction(() => {
                        sendAiPrompt(`Rewrite this text to be shorter and more concise. Only output the rewritten text:\n\n"${ctxMenu.selectionText}"`, 'rewrite', { x: ctxMenu.x, y: ctxMenu.y });
                      })} />
                      <CtxItem label="Make longer" onClick={() => ctxAction(() => {
                        sendAiPrompt(`Expand this text with more detail. Only output the rewritten text:\n\n"${ctxMenu.selectionText}"`, 'rewrite', { x: ctxMenu.x, y: ctxMenu.y });
                      })} />
                      <CtxItem label="More formal" onClick={() => ctxAction(() => {
                        sendAiPrompt(`Rewrite this text in a more formal, professional tone. Only output the rewritten text:\n\n"${ctxMenu.selectionText}"`, 'rewrite', { x: ctxMenu.x, y: ctxMenu.y });
                      })} />
                      <CtxItem label="More casual" onClick={() => ctxAction(() => {
                        sendAiPrompt(`Rewrite this text in a more casual, friendly tone. Only output the rewritten text:\n\n"${ctxMenu.selectionText}"`, 'rewrite', { x: ctxMenu.x, y: ctxMenu.y });
                      })} />
                    </div>
                  )}
                </div>
              )}
              <CtxDivider />
            </>
          )}
          <CtxItem label="Back" onClick={() => ctxAction(() => {
            const wv = webviewRefs.current[ctxMenu.tabId];
            if (wv?.canGoBack()) wv.goBack();
          })} />
          <CtxItem label="Forward" onClick={() => ctxAction(() => {
            const wv = webviewRefs.current[ctxMenu.tabId];
            if (wv?.canGoForward()) wv.goForward();
          })} />
          <CtxItem label="Reload" onClick={() => ctxAction(() => {
            const wv = webviewRefs.current[ctxMenu.tabId];
            wv?.reload();
          })} />
          <CtxDivider />
          <CtxItem label="Select All" onClick={() => ctxAction(() => {
            const wv = webviewRefs.current[ctxMenu.tabId];
            wv?.selectAll();
          })} />
          <CtxItem label="View Page Source" onClick={() => ctxAction(() => {
            if (ctxMenu.pageURL) useBrowserStore.getState().addTab('view-source:' + ctxMenu.pageURL);
          })} />
          <CtxItem label="Inspect" onClick={() => ctxAction(() => {
            const wv = webviewRefs.current[ctxMenu.tabId];
            wv?.openDevTools();
          })} />
          {toolbarExts.length > 0 && (
            <>
              <CtxDivider />
              {toolbarExts.map((ext) => (
                <CtxItem
                  key={ext.id}
                  label={ext.manifest.toolbar_action.label || ext.manifest.name}
                  accent
                  onClick={() => ctxAction(() => {
                    const store = useBrowserStore.getState();
                    if (store.sidebarView !== 'extensions') store.setSidebarView('extensions');
                    window.dispatchEvent(new CustomEvent('flip-open-extension', { detail: { extensionId: ext.id } }));
                  })}
                />
              ))}
            </>
          )}
        </div>
      )}

      {tabs.map((tab) => {
        if (tab.url?.startsWith('flip://')) return null;

        const isVisible = tab.id === targetTabId;

        return (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{ display: isVisible ? 'flex' : 'none' }}
          >
            {tab.suspended ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-surface-0">
                <div className="text-white/30 text-sm">This tab has been suspended to save memory</div>
                <button
                  onClick={() => {
                    useBrowserStore.getState().updateTab(tab.id, { suspended: false });
                  }}
                  className="btn-primary"
                >
                  Restore Tab
                </button>
              </div>
            ) : (
              <webview
                ref={(el) => {
                  if (el) {
                    webviewRefs.current[tab.id] = el;
                    setupWebview(el, tab.id);
                  }
                }}
                src={tab.url}
                style={{ flex: 1, width: '100%', height: '100%' }}
                allowpopups="true"
                webpreferences="contextIsolation=yes"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CtxItem({ label, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors duration-75 hover:bg-white/[0.06] ${accent ? 'text-flip-400/80 hover:text-flip-400' : 'text-white/60 hover:text-white/90'}`}
    >
      {label}
    </button>
  );
}

function CtxDivider() {
  return <div className="my-1 mx-2 h-px bg-white/[0.06]" />;
}
