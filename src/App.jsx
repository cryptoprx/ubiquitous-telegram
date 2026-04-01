import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Toaster } from 'sileo';
import useBrowserStore from './store/browserStore';
import Sidebar from './components/Sidebar';
import AddressBar from './components/AddressBar';
import WebContent from './components/WebContent';
import CommandPalette from './components/CommandPalette';
import NewTabPage from './components/NewTabPage';
import ExtensionDock from './components/extensions/ExtensionDock';
import DevDashboard from './components/extensions/DevDashboard';
import BookmarksBar from './components/BookmarksBar';
import Marketplace from './components/Marketplace';
import LicenseGate from './components/LicenseGate';
import X402PaymentPrompt from './components/X402PaymentPrompt';
import AiOverlay from './components/AiOverlay';
import ExtensionStudio from './pages/ExtensionStudio';
import ExtensionTabView from './components/ExtensionTabView';
import CredentialPrompt from './components/CredentialPrompt';
import PermissionPrompt from './components/PermissionPrompt';
import UpdateBanner from './components/UpdateBanner';
import SplitAddressBar from './components/SplitAddressBar';
import IncomingCallOverlay from './components/IncomingCallOverlay';
import { initCompanionSync, forwardNotification } from './lib/companionSync';

// ── Computed once at module level (never changes) ──────────────────────────
const isPrivateMode = new URLSearchParams(window.location.search).get('private') === '1';

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

  // Load persistent data (settings, bookmarks, history, tabs, profiles, etc.)
  useEffect(() => {
    if (!licenseActive) return;
    async function loadPersistentData() {
      if (!window.flipAPI) return;

      // Load persisted settings first
      const savedSettings = await window.flipAPI.getSettings();
      if (savedSettings) {
        useBrowserStore.getState().updateSettings(savedSettings);
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

      const rs = await window.flipAPI.getReaderSettings();
      if (rs) useBrowserStore.getState().setReaderSettings(rs);

      const profiles = await window.flipAPI.getProfiles();
      if (profiles) useBrowserStore.getState().setProfiles(profiles);

      const ss = await window.flipAPI.getSiteSettings();
      if (ss) useBrowserStore.getState().setSiteSettings(ss);

      const ws = await window.flipAPI.getWorkspaces();
      if (ws) useBrowserStore.getState().setWorkspaces(ws);

      // Sync ad block / tracking settings to main process
      const s = useBrowserStore.getState().settings;
      window.flipAPI.setAdBlock(s.adBlockEnabled);
      window.flipAPI.setTrackingProtection(s.trackingProtection);
    }
    loadPersistentData();
  }, [licenseActive]);

  // Register IPC / companion event listeners separately from data loading
  useEffect(() => {
    if (!licenseActive || !window.flipAPI) return;

    // Start companion app sync (if paired)
    initCompanionSync();

    // Listen for ad blocked events
    window.flipAPI.onAdBlocked(() => incrementBlocked());

    // Listen for certificate errors
    window.flipAPI.onCertificateError?.((data) => {
      try {
        const state = useBrowserStore.getState();
        const errHost = new URL(data.url).hostname;
        const tab = state.tabs.find(t => { try { return new URL(t.url).hostname === errHost; } catch { return false; } });
        if (tab) state.updateTab(tab.id, { certError: data });
      } catch {}
    });

    // Listen for webview crash events
    window.flipAPI.onWebviewCrashed?.((data) => {
      try {
        const state = useBrowserStore.getState();
        const crashHost = new URL(data.url).hostname;
        const tab = state.tabs.find(t => { try { return new URL(t.url).hostname === crashHost; } catch { return false; } });
        if (tab) state.updateTab(tab.id, { crashed: true, crashReason: data.reason });
      } catch {}
    });

    // Listen for safe browsing warnings
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
  }, [licenseActive]);

  // Persist settings when they change (skip until loaded from disk)
  useEffect(() => {
    if (window.flipAPI && settingsLoadedRef.current) {
      window.flipAPI.saveSettings(settings);
    }
  }, [settings]);

  // ── Session save: only trigger on structural changes (url, pinned) ────────
  // Avoids disk I/O on every favicon/title/loading update
  const tabFingerprint = tabs.map(t => `${t.id}:${t.url}:${t.pinned ? 1 : 0}`).join('|');

  const saveSessionSnapshot = useCallback(() => {
    if (!window.flipAPI || isPrivateMode) return;
    const state = useBrowserStore.getState();
    const pinnedTabs = state.tabs.filter((t) => t.pinned).map(({ url, title, favicon }) => ({ url, title, favicon }));
    window.flipAPI.savePinnedTabs(pinnedTabs);
    const sessionTabs = state.tabs
      .filter((t) => !t.pinned && !t.isSplitTab && t.url !== 'flip://newtab')
      .map(({ url, title, favicon }) => ({ url, title, favicon }));
    window.flipAPI.saveSession(sessionTabs);
  }, []);

  useEffect(() => {
    saveSessionSnapshot();
  }, [tabFingerprint]);

  // Auto-save session every 30s for crash recovery
  useEffect(() => {
    if (isPrivateMode) return;
    const interval = setInterval(saveSessionSnapshot, 30000);
    const handleUnload = () => saveSessionSnapshot();
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [saveSessionSnapshot]);

  // Auto-suspend inactive tabs every 60s (single timer — no duplicate)
  useEffect(() => {
    if (isPrivateMode) return;
    const suspendInterval = setInterval(() => {
      const s = useBrowserStore.getState().settings;
      if (s.autoSuspendEnabled !== false) {
        useBrowserStore.getState().autoSuspendInactiveTabs(s.autoSuspendMinutes || 30);
      }
    }, 60000);
    return () => clearInterval(suspendInterval);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === 'k') { e.preventDefault(); toggleCommandPalette(); }
      if (mod && e.key === 't') { e.preventDefault(); addTab(); }
      if (mod && e.key === 'w') { e.preventDefault(); useBrowserStore.getState().closeTab(activeTabId); }
      if (mod && e.key === 'l') { e.preventDefault(); document.getElementById('flip-address-input')?.focus(); }
      if (mod && e.key === 'p') { e.preventDefault(); window.dispatchEvent(new CustomEvent('flip-print', { detail: { tabId: activeTabId } })); }
      if (mod && e.shiftKey && e.key === 'S') { e.preventDefault(); window.dispatchEvent(new CustomEvent('flip-snip', { detail: { tabId: activeTabId } })); }
      if (mod && e.key === 'f') { e.preventDefault(); window.dispatchEvent(new CustomEvent('flip-find-in-page', { detail: { tabId: activeTabId } })); }
      if (e.key === 'F11') { e.preventDefault(); window.flipAPI?.toggleFullscreen?.(); }
      if (mod && !e.shiftKey && e.key === 'n') { e.preventDefault(); window.flipAPI?.newWindow?.(); }
      if (mod && e.shiftKey && e.key === 'N') { e.preventDefault(); window.flipAPI?.newPrivateWindow?.(); }
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

  // Per-site tab suspension timer (respects tabSuspensionEnabled setting)
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
    }, 30000);
    return () => clearInterval(interval);
  }, [settings.tabSuspensionEnabled, settings.tabSuspensionTimeout]);

  const isNewTab = activeTab?.url === 'flip://newtab';
  const isDevTools = activeTab?.url === 'flip://devtools';
  const isMarketplace = activeTab?.url === 'flip://marketplace';
  const isStudio = activeTab?.url === 'flip://studio';
  const isExtTab = activeTab?.url?.startsWith('flip://ext/');
  const extTabId = isExtTab ? activeTab.url.replace('flip://ext/', '') : null;

  // Show license gate if not activated
  if (!licenseChecked) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#0a0a0f]">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!licenseActive) {
    return <LicenseGate onActivated={() => setLicenseActive(true)} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-surface-0 select-none">
      <Toaster position="top-right" />
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
          <div className="flex flex-1 overflow-hidden relative">
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
          </div>

          {/* Extension dock — macOS-style bottom bar */}
          <ExtensionDock />
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
