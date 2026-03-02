import React, { useEffect, useCallback, useState, useRef } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import useBrowserStore from './store/browserStore';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import AddressBar from './components/AddressBar';
import WebContent from './components/WebContent';
import CommandPalette from './components/CommandPalette';
import NewTabPage from './components/NewTabPage';
import ExtensionPanel from './components/extensions/ExtensionPanel';
import ExtensionHost from './components/extensions/ExtensionHost';
import DevDashboard from './components/extensions/DevDashboard';
import BookmarksBar from './components/BookmarksBar';
import Marketplace from './components/Marketplace';
import LicenseGate from './components/LicenseGate';
import X402PaymentPrompt from './components/X402PaymentPrompt';
import AiOverlay from './components/AiOverlay';
import ExtensionStudio from './pages/ExtensionStudio';
import { initCompanionSync, forwardNotification, acceptCall, rejectCall } from './lib/companionSync';

export default function App() {
  const {
    tabs,
    activeTabId,
    sidebarOpen,
    sidebarWidth,
    sidebarView,
    commandPaletteOpen,
    splitView,
    splitTabId,
    settings,
    addTab,
    setBookmarks,
    setHistory,
    incrementBlocked,
    toggleCommandPalette,
  } = useBrowserStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const settingsLoadedRef = useRef(false);

  // License gate state
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [licenseActive, setLicenseActive] = useState(false);

  // Check license on mount
  useEffect(() => {
    async function checkLicense() {
      try {
        const result = await window.flipAPI?.licenseCheck?.();
        if (result?.activated) setLicenseActive(true);
      } catch {}
      setLicenseChecked(true);
    }
    checkLicense();
  }, []);

  // Load extensions, bookmarks, history, settings, pinned tabs on mount
  useEffect(() => {
    if (!licenseActive) return;
    async function init() {
      if (window.flipAPI) {
        // Load persisted settings first
        const savedSettings = await window.flipAPI.getSettings();
        if (savedSettings) {
          useBrowserStore.getState().updateSettings(savedSettings);
          // Apply saved theme
          if (savedSettings.theme) {
            document.documentElement.setAttribute('data-theme', savedSettings.theme);
          } else {
            document.documentElement.removeAttribute('data-theme');
          }
        }

        const bm = await window.flipAPI.getBookmarks();
        if (bm) setBookmarks(bm);

        const hist = await window.flipAPI.getHistory();
        if (hist) setHistory(hist);

        // Restore session tabs (non-pinned tabs from last session)
        const sessionTabs = await window.flipAPI.getSession();
        if (sessionTabs && sessionTabs.length > 0) {
          sessionTabs.forEach((st) => {
            if (st.url && st.url !== 'flip://newtab') {
              useBrowserStore.getState().addTab(st.url);
            }
          });
        }

        // Restore pinned tabs
        const pinned = await window.flipAPI.getPinnedTabs();
        if (pinned && pinned.length > 0) {
          pinned.forEach((pt) => {
            const state = useBrowserStore.getState();
            state.addTab(pt.url);
            const newTab = state.tabs[state.tabs.length - 1];
            if (newTab) state.pinTab(newTab.id);
          });
        }

        settingsLoadedRef.current = true;

        // Load reader settings
        const rs = await window.flipAPI.getReaderSettings();
        if (rs) useBrowserStore.getState().setReaderSettings(rs);

        // Load profiles
        const profiles = await window.flipAPI.getProfiles();
        if (profiles) useBrowserStore.getState().setProfiles(profiles);

        // Load site settings
        const ss = await window.flipAPI.getSiteSettings();
        if (ss) useBrowserStore.getState().setSiteSettings(ss);

        // Load workspaces
        const ws = await window.flipAPI.getWorkspaces();
        if (ws) useBrowserStore.getState().setWorkspaces(ws);

        // Sync ad block / tracking settings to main process
        const s = useBrowserStore.getState().settings;
        window.flipAPI.setAdBlock(s.adBlockEnabled);
        window.flipAPI.setTrackingProtection(s.trackingProtection);

        // Start companion app sync (if paired)
        initCompanionSync();

        // Listen for ad blocked events
        window.flipAPI.onAdBlocked(() => incrementBlocked());

        // Listen for certificate errors — show interstitial on the matching tab
        window.flipAPI.onCertificateError?.((data) => {
          try {
            const state = useBrowserStore.getState();
            const errHost = new URL(data.url).hostname;
            const tab = state.tabs.find(t => { try { return new URL(t.url).hostname === errHost; } catch { return false; } });
            if (tab) state.updateTab(tab.id, { certError: data });
          } catch {}
        });

        // Listen for webview crash events — show crash recovery UI
        window.flipAPI.onWebviewCrashed?.((data) => {
          try {
            const state = useBrowserStore.getState();
            const crashHost = new URL(data.url).hostname;
            const tab = state.tabs.find(t => { try { return new URL(t.url).hostname === crashHost; } catch { return false; } });
            if (tab) state.updateTab(tab.id, { crashed: true, crashReason: data.reason });
          } catch {}
        });

        // Listen for safe browsing warnings — show danger page
        window.flipAPI.onSafeBrowsingWarning?.((data) => {
          try {
            const state = useBrowserStore.getState();
            const warnHost = new URL(data.url).hostname;
            const tab = state.tabs.find(t => { try { return new URL(t.url).hostname === warnHost; } catch { return false; } })
              || state.tabs.find(t => t.id === state.activeTabId);
            if (tab) state.updateTab(tab.id, { safeBrowsingWarning: data });
          } catch {}
        });

        // Listen for open-url-in-tab events
        window.flipAPI.onOpenUrl((url) => addTab(url));

        // Listen for permission request prompts from main process
        window.flipAPI.onPermissionRequest((data) => {
          useBrowserStore.getState().setPermissionRequest(data);
        });

        // AI browser action events
        window.flipAPI.onAiCloseTab?.((tabId) => {
          const state = useBrowserStore.getState();
          const tab = state.tabs[tabId];
          if (tab) state.closeTab(tab.id);
        });
        window.flipAPI.onAiNavigateCurrent?.((url) => {
          const state = useBrowserStore.getState();
          const tab = state.tabs.find(t => t.id === state.activeTabId);
          if (tab) state.updateTab(tab.id, { url, loading: true });
        });
        window.flipAPI.onAiToggleReadingMode?.(() => {
          useBrowserStore.getState().toggleReadingMode();
        });
        window.flipAPI.onAiTakeScreenshot?.(() => {
          const state = useBrowserStore.getState();
          window.dispatchEvent(new CustomEvent('flip-screenshot', { detail: { tabId: state.activeTabId } }));
        });
        window.flipAPI.onAiPinTab?.(() => {
          const state = useBrowserStore.getState();
          if (state.activeTabId) state.pinTab(state.activeTabId);
        });
        window.flipAPI.onAiDuplicateTab?.(() => {
          const state = useBrowserStore.getState();
          if (state.activeTabId) state.duplicateTab(state.activeTabId);
        });
        window.flipAPI.onAiSwitchTab?.((tabId) => {
          const state = useBrowserStore.getState();
          const tab = state.tabs[tabId];
          if (tab) state.setActiveTab(tab.id);
        });
        window.flipAPI.onAiCloseOtherTabs?.(() => {
          const state = useBrowserStore.getState();
          const keep = state.activeTabId;
          state.tabs.forEach(t => { if (t.id !== keep) state.closeTab(t.id); });
        });
        // Page change watcher → forward to companion
        window.flipAPI.onWatcherChange?.((data) => {
          forwardNotification({ type: 'security', title: 'Page Changed: ' + (data.label || ''), body: data.url || '' });
        });

        window.flipAPI.onBookmarksUpdated?.(async () => {
          const bm = await window.flipAPI.getBookmarks();
          if (bm) useBrowserStore.getState().setBookmarks(bm);
        });
      }
    }
    init();
  }, [licenseActive]);

  // Persist settings when they change (skip until loaded from disk)
  useEffect(() => {
    if (window.flipAPI && settingsLoadedRef.current) {
      window.flipAPI.saveSettings(settings);
    }
  }, [settings]);

  // Persist pinned tabs and session when tabs change (skip in private mode)
  const isPrivateMode = new URLSearchParams(window.location.search).get('private') === '1';
  const saveSessionSnapshot = useCallback(() => {
    if (!window.flipAPI || isPrivateMode) return;
    const state = useBrowserStore.getState();
    const pinned = state.tabs.filter((t) => t.pinned).map(({ url, title, favicon }) => ({ url, title, favicon }));
    window.flipAPI.savePinnedTabs(pinned);
    const sessionTabs = state.tabs
      .filter((t) => !t.pinned && !t.isSplitTab && t.url !== 'flip://newtab')
      .map(({ url, title, favicon }) => ({ url, title, favicon }));
    window.flipAPI.saveSession(sessionTabs);
  }, [isPrivateMode]);

  useEffect(() => {
    saveSessionSnapshot();
  }, [tabs]);

  // Auto-save session every 30s for crash recovery + auto-suspend inactive tabs every 60s
  useEffect(() => {
    if (isPrivateMode) return;
    const interval = setInterval(saveSessionSnapshot, 30000);
    const suspendInterval = setInterval(() => {
      const s = useBrowserStore.getState().settings;
      if (s.autoSuspendEnabled !== false) {
        useBrowserStore.getState().autoSuspendInactiveTabs(s.autoSuspendMinutes || 30);
      }
    }, 60000);
    const handleUnload = () => saveSessionSnapshot();
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      clearInterval(interval);
      clearInterval(suspendInterval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [saveSessionSnapshot]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      if (mod && e.key === 't') {
        e.preventDefault();
        addTab();
      }
      if (mod && e.key === 'w') {
        e.preventDefault();
        useBrowserStore.getState().closeTab(activeTabId);
      }
      if (mod && e.key === 'l') {
        e.preventDefault();
        document.getElementById('flip-address-input')?.focus();
      }
      if (mod && e.key === 'p') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('flip-print', { detail: { tabId: activeTabId } }));
      }
      if (mod && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('flip-snip', { detail: { tabId: activeTabId } }));
      }
      // Ctrl+F — Find in Page
      if (mod && e.key === 'f') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('flip-find-in-page', { detail: { tabId: activeTabId } }));
      }
      // F11 — Toggle Fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        window.flipAPI?.toggleFullscreen?.();
      }
      // Ctrl+N — New Window
      if (mod && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        window.flipAPI?.newWindow?.();
      }
      // Ctrl+Shift+N — New Private Window
      if (mod && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        window.flipAPI?.newPrivateWindow?.();
      }
      // Ctrl+Alt+1-9 — Switch workspace
      if (e.ctrlKey && e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        const ws = useBrowserStore.getState().workspaces;
        if (ws[idx]) useBrowserStore.getState().switchWorkspace(ws[idx].id);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId]);

  const isNewTab = activeTab?.url === 'flip://newtab';
  const isDevTools = activeTab?.url === 'flip://devtools';
  const isMarketplace = activeTab?.url === 'flip://marketplace';
  const isStudio = activeTab?.url === 'flip://studio';
  const isExtTab = activeTab?.url?.startsWith('flip://ext/');
  const extTabId = isExtTab ? activeTab.url.replace('flip://ext/', '') : null;
  const showExtensionPanel = sidebarView === 'extensions';


  // Tab suspension: auto-suspend inactive tabs after timeout
  useEffect(() => {
    if (!settings.tabSuspensionEnabled) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const state = useBrowserStore.getState();
      state.tabs.forEach((tab) => {
        if (
          tab.id !== state.activeTabId &&
          !tab.suspended &&
          !tab.pinned &&
          !tab.url?.startsWith('flip://') &&
          tab.lastActive &&
          now - tab.lastActive > state.settings.tabSuspensionTimeout
        ) {
          state.suspendTab(tab.id);
        }
      });
    }, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [settings.tabSuspensionEnabled, settings.tabSuspensionTimeout]);

  // Show license gate if not activated
  if (!licenseChecked) {
    return <div className="flex items-center justify-center h-screen w-screen bg-[#0a0a0f]">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  if (!licenseActive) {
    return <LicenseGate onActivated={() => setLicenseActive(true)} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-surface-0 select-none">
      {/* Title bar with window controls */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Flip Rail — always visible */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Address bar */}
          <AddressBar />

          {/* Bookmarks bar */}
          <BookmarksBar />

          {/* Credential save prompt */}
          <CredentialPrompt />

          {/* Web content / New tab page */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-col flex-1 min-w-0 relative">
              {isDevTools ? (
                <DevDashboard />
              ) : isStudio ? (
                <ExtensionStudio />
              ) : isMarketplace ? (
                <Marketplace />
              ) : isNewTab ? (
                <NewTabPage />
              ) : isExtTab ? (
                <ExtensionTabView extensionId={extTabId} />
              ) : (
                <WebContent />
              )}
            </div>

            {/* Split view */}
            {splitView && splitTabId && (
              <>
                <div className="split-divider" />
                <div className="flex flex-col flex-1 min-w-0">
                  <SplitAddressBar />
                  {tabs.find((t) => t.id === splitTabId)?.url === 'flip://newtab' ? (
                    <NewTabPage isSplit />
                  ) : (
                    <WebContent tabId={splitTabId} />
                  )}
                </div>
              </>
            )}

            {/* Extension side panel */}
            {showExtensionPanel && (
              <ExtensionPanel />
            )}
          </div>
        </div>
      </div>

      {/* Command Palette overlay */}
      {commandPaletteOpen && <CommandPalette />}

      {/* Permission request prompt — floating overlay */}
      <PermissionPrompt />

      {/* Auto-update banner */}
      <UpdateBanner />

      {/* Incoming call overlay */}
      <IncomingCallOverlay />

      {/* x402 Payment prompt overlay */}
      <X402PaymentPrompt />

      {/* AI floating overlay for context menu actions */}
      <AiOverlay />
    </div>
  );
}

/** Full-tab extension view — renders an extension in the main content area */
function ExtensionTabView({ extensionId }) {
  const [extension, setExtension] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExt() {
      setLoading(true);
      if (window.flipAPI) {
        const exts = await window.flipAPI.loadExtensions();
        if (exts) {
          const ext = exts.find((e) => e.id === extensionId);
          if (ext) setExtension({ ...ext, enabled: true });
        }
      }
      setLoading(false);
    }
    loadExt();
  }, [extensionId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-6 h-6 border-2 border-flip-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!extension) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <p className="text-white/40 text-sm font-medium">Extension not found</p>
          <p className="text-white/20 text-xs mt-1">"{extensionId}" is not installed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0f] overflow-hidden">
      <ExtensionHost extension={extension} width="100%" height="100%" />
    </div>
  );
}

/** "Save password?" prompt bar — shown when a login form submission is detected */
function CredentialPrompt() {
  const { pendingCredential, setPendingCredential } = useBrowserStore();

  if (!pendingCredential) return null;

  async function handleSave() {
    const passwords = (await window.flipAPI?.getPasswords()) || [];
    const entry = {
      id: Date.now(),
      site: pendingCredential.site,
      username: pendingCredential.username,
      password: pendingCredential.password,
      createdAt: Date.now(),
    };
    await window.flipAPI?.savePasswords([entry, ...passwords]);
    setPendingCredential(null);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface-2 border-b border-white/5 animate-fade-in">
      <KeyRound size={14} className="text-flip-400 shrink-0" />
      <span className="text-xs text-white/70 truncate">
        Save password for <strong className="text-white/90">{pendingCredential.site}</strong> ({pendingCredential.username})?
      </span>
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        <button
          onClick={handleSave}
          className="px-3 py-1 rounded-lg bg-flip-500/20 text-flip-400 text-[11px] font-medium hover:bg-flip-500/30 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => setPendingCredential(null)}
          className="px-3 py-1 rounded-lg bg-white/5 text-white/40 text-[11px] font-medium hover:bg-white/10 hover:text-white/60 transition-colors"
        >
          Never
        </button>
      </div>
    </div>
  );
}

/** Permission request prompt — floating overlay card */
function PermissionPrompt() {
  const { permissionRequest, setPermissionRequest } = useBrowserStore();

  if (!permissionRequest) return null;

  function handleAllow() {
    window.flipAPI?.respondPermission(permissionRequest.id, true);
    setPermissionRequest(null);
  }

  function handleDeny() {
    window.flipAPI?.respondPermission(permissionRequest.id, false);
    setPermissionRequest(null);
  }

  const permLabel = {
    notifications: 'send notifications',
    media: 'use your camera and microphone',
    camera: 'use your camera',
    microphone: 'use your microphone',
    'display-capture': 'share your screen',
    geolocation: 'access your location',
    midi: 'use MIDI devices',
    pointerLock: 'lock your pointer',
    fullscreen: 'enter fullscreen',
    openExternal: 'open an external app',
  }[permissionRequest.permission] || permissionRequest.permission;

  const permIcon = {
    notifications: '🔔',
    media: '📹',
    camera: '📷',
    microphone: '🎙️',
    'display-capture': '🖥️',
    geolocation: '📍',
  }[permissionRequest.permission] || '🔒';

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-20 animate-fade-in" onClick={handleDeny}>
      <div
        className="w-[340px] bg-surface-3 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-lg">
              {permIcon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/90 leading-tight">Permission Request</p>
              <p className="text-[11px] text-white/40 truncate mt-0.5">{permissionRequest.origin}</p>
            </div>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            This site wants to <strong className="text-white/90">{permLabel}</strong>
          </p>
        </div>
        <div className="flex border-t border-white/[0.06]">
          <button
            onClick={handleDeny}
            className="flex-1 py-3 text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors border-r border-white/[0.06]"
          >
            Block
          </button>
          <button
            onClick={handleAllow}
            className="flex-1 py-3 text-xs font-semibold text-flip-400 hover:bg-flip-500/10 transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

/** Release notes list — reusable */
function ReleaseNotes({ notes }) {
  const [expanded, setExpanded] = useState(false);
  if (!notes || !notes.length) return null;
  const items = Array.isArray(notes) ? notes : [notes];
  const visible = expanded ? items : items.slice(0, 2);

  return (
    <div className="mb-3">
      <ul className="space-y-0.5">
        {visible.map((note, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[10px] text-white/40 leading-tight">
            <span className="text-flip-400 mt-px shrink-0">•</span>
            <span>{note}</span>
          </li>
        ))}
      </ul>
      {items.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[9px] text-flip-400/60 hover:text-flip-400 mt-1 transition-colors"
        >
          {expanded ? 'Show less' : `+${items.length - 2} more`}
        </button>
      )}
    </div>
  );
}

/** Auto-update notification banner */
function UpdateBanner() {
  const [update, setUpdate] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.flipAPI?.onUpdateStatus) {
      window.flipAPI.onUpdateStatus((data) => {
        setUpdate(data);
        if (data.status === 'available' || data.status === 'ready') {
          setDismissed(false);
        }
      });
    }
  }, []);

  if (dismissed || !update) return null;
  if (update.status !== 'available' && update.status !== 'downloading' && update.status !== 'ready') return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-fade-in">
      <div className="bg-surface-3 border border-white/10 rounded-xl shadow-2xl shadow-black/40 p-4">
        {update.status === 'available' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-flip-500 animate-pulse" />
              <span className="text-xs font-semibold text-white/90">Update Available</span>
              <span className="text-[9px] text-white/30 font-mono ml-auto">v{update.version}</span>
            </div>
            <ReleaseNotes notes={update.releaseNotes} />
            <div className="flex gap-2">
              <button
                onClick={() => setDismissed(true)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-white/40 hover:text-white/60 transition-colors"
              >
                Later
              </button>
              <button
                onClick={() => window.flipAPI?.downloadUpdate?.()}
                className="flex-1 px-3 py-1.5 rounded-lg bg-flip-500/20 border border-flip-500/25 text-[10px] text-flip-400 font-medium hover:bg-flip-500/30 transition-colors"
              >
                Download
              </button>
            </div>
          </>
        )}

        {update.status === 'downloading' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 border-2 border-flip-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-white/90">Downloading Update...</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-flip-500 to-accent-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(update.percent || 0)}%` }}
              />
            </div>
            <p className="text-[9px] text-white/25 text-right">{Math.round(update.percent || 0)}%</p>
          </>
        )}

        {update.status === 'ready' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-accent-400" />
              <span className="text-xs font-semibold text-white/90">Update Ready</span>
              <span className="text-[9px] text-white/30 font-mono ml-auto">v{update.version}</span>
            </div>
            <ReleaseNotes notes={update.releaseNotes} />
            <div className="flex gap-2">
              <button
                onClick={() => setDismissed(true)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-white/40 hover:text-white/60 transition-colors"
              >
                Later
              </button>
              <button
                onClick={() => window.flipAPI?.installUpdate?.()}
                className="flex-1 px-3 py-1.5 rounded-lg bg-accent-400/20 border border-accent-400/25 text-[10px] text-accent-400 font-medium hover:bg-accent-400/30 transition-colors"
              >
                Restart Now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Mini address bar for the split view pane */
function SplitAddressBar() {
  const { splitTabId, tabs, closeSplitView, navigateSplitTab, settings } = useBrowserStore();
  const splitTab = tabs.find((t) => t.id === splitTabId);
  const [input, setInput] = useState(splitTab?.url === 'flip://newtab' ? '' : (splitTab?.url || ''));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    let url = input.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith('flip://')) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = (settings.searchEngine || 'https://duckduckgo.com/?q=') + encodeURIComponent(url);
      }
    }
    navigateSplitTab(url);
    // Dispatch navigate event for the split tab's webview
    window.dispatchEvent(new CustomEvent('flip-navigate', { detail: { tabId: splitTabId, url } }));
  };

  // Sync input when split tab URL changes externally (e.g. link clicks inside the webview)
  const currentUrl = splitTab?.url || '';
  React.useEffect(() => {
    if (currentUrl && currentUrl !== 'flip://newtab') {
      setInput(currentUrl);
    }
  }, [currentUrl]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-1 border-b border-white/5">
      <form onSubmit={handleSubmit} className="flex-1 flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="Search or enter URL..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-white/90 outline-none focus:border-flip-500/50 placeholder:text-white/20"
        />
      </form>
      <button
        onClick={closeSplitView}
        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
        title="Close split view"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

/** Incoming call overlay — shown when companion calls the browser */
function IncomingCallOverlay() {
  const [call, setCall] = useState(null);
  const [status, setStatus] = useState('ringing');
  const [callSession, setCallSession] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    function handleIncomingCall(e) {
      const { code, type, from } = e.detail || {};
      if (code) {
        setCall({ code, type, from });
        setStatus('ringing');
      }
    }
    window.addEventListener('flip-incoming-call', handleIncomingCall);
    return () => window.removeEventListener('flip-incoming-call', handleIncomingCall);
  }, []);

  async function handleAccept() {
    if (!call) return;
    setStatus('connecting');
    const session = await acceptCall(call.code, call.type);
    if (session) {
      setCallSession(session);
      if (localVideoRef.current) localVideoRef.current.srcObject = session.localStream;
      session.pc.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        setStatus('connected');
      };
      setTimeout(() => setStatus((s) => s === 'connecting' ? 'connected' : s), 15000);
    } else {
      setStatus('ended');
      setTimeout(() => { setCall(null); setStatus('ringing'); }, 2000);
    }
  }

  function handleReject() {
    rejectCall();
    setCall(null);
    setStatus('ringing');
  }

  function handleEnd() {
    if (callSession) {
      callSession.pc?.close();
      callSession.localStream?.getTracks().forEach((t) => t.stop());
    }
    setCallSession(null);
    setCall(null);
    setStatus('ringing');
  }

  if (!call) return null;

  if (status === 'ringing') {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
        <div className="bg-surface-1 rounded-2xl p-8 max-w-xs w-full text-center border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ShieldCheck size={28} className="text-green-400" />
          </div>
          <p className="text-white/90 text-sm font-semibold mb-1">Incoming {call.type === 'video' ? 'Video' : 'Voice'} Call</p>
          <p className="text-white/40 text-xs mb-6">from {call.from}</p>
          <div className="flex gap-3">
            <button onClick={handleReject} className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors">
              Decline
            </button>
            <button onClick={handleAccept} className="flex-1 py-2.5 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors">
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      <div className="flex-1 relative">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        {status !== 'connected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
            <div className="w-12 h-12 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/60 text-sm">{status === 'connecting' ? 'Connecting...' : 'Call ended'}</p>
          </div>
        )}
        {call.type === 'video' && (
          <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-28 h-36 rounded-xl object-cover border-2 border-white/10 shadow-xl" />
        )}
      </div>
      <div className="flex items-center justify-center gap-6 py-4 bg-surface-1 border-t border-white/5">
        <button onClick={handleEnd} className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="23" y1="1" x2="1" y2="23"/><path d="M16.92 11.07A10 10 0 0 0 12 9.5a10 10 0 0 0-4.92 1.57"/></svg>
        </button>
      </div>
    </div>
  );
}
