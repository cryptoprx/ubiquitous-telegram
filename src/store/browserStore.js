import { create } from 'zustand';

const DEFAULT_SETTINGS = {
  adBlockEnabled: true,
  trackingProtection: true,
  theme: 'dark',
  httpsOnly: true,
  fingerprintProtection: true,
  tabSuspensionEnabled: true,
  tabSuspensionTimeout: 300000, // 5 min
  verticalTabs: true,
  searchEngine: 'https://duckduckgo.com/?q=',
  homepage: 'flip://newtab',
  showBookmarksBar: false,
  wallpaper: null, // null = default gradient, or URL string
  language: 'en', // 'en' | 'es'
};

const useBrowserStore = create((set, get) => ({
  // ── Tabs ──────────────────────────────────────
  tabs: [
    {
      id: 1,
      url: 'flip://newtab',
      title: 'New Tab',
      favicon: null,
      loading: false,
      canGoBack: false,
      canGoForward: false,
      suspended: false,
      lastActive: Date.now(),
    },
  ],
  activeTabId: 1,
  nextTabId: 2,

  addTab: (url = 'flip://newtab') =>
    set((state) => {
      const id = state.nextTabId;
      return {
        tabs: [
          ...state.tabs,
          {
            id,
            url,
            title: url === 'flip://newtab' ? 'New Tab' : url,
            favicon: null,
            loading: url !== 'flip://newtab',
            canGoBack: false,
            canGoForward: false,
            suspended: false,
            lastActive: Date.now(),
          },
        ],
        activeTabId: id,
        nextTabId: id + 1,
      };
    }),

  closeTab: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id);
      if (tabs.length === 0) {
        return {
          tabs: [
            {
              id: state.nextTabId,
              url: 'flip://newtab',
              title: 'New Tab',
              favicon: null,
              loading: false,
              canGoBack: false,
              canGoForward: false,
              suspended: false,
              lastActive: Date.now(),
            },
          ],
          activeTabId: state.nextTabId,
          nextTabId: state.nextTabId + 1,
        };
      }
      const newActiveId =
        state.activeTabId === id
          ? tabs[Math.min(tabs.findIndex((t) => t.id > id), tabs.length - 1) === -1 ? tabs.length - 1 : Math.min(tabs.findIndex((t) => t.id > id), tabs.length - 1)].id
          : state.activeTabId;
      return { tabs, activeTabId: newActiveId };
    }),

  setActiveTab: (id) =>
    set((state) => ({
      activeTabId: id,
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, lastActive: Date.now(), suspended: false } : t
      ),
    })),

  updateTab: (id, data) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...data } : t)),
    })),

  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      const tabs = [...state.tabs];
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      return { tabs };
    }),

  duplicateTab: (id) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === id);
    if (tab) {
      get().addTab(tab.url);
    }
  },

  pinTab: (id) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, pinned: !t.pinned } : t
      ),
    })),

  suspendTab: (id) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, suspended: true } : t
      ),
    })),

  // ── Tab Stacks (auto-group by domain) ────────
  tabStacks: {},  // { [stackId]: { name, color, collapsed } }
  nextStackColor: 0,

  getStackColors: () => [
    '#ff6234', '#2dd4a8', '#a78bfa', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  ],

  // Toggle collapse on a domain stack
  toggleStack: (domain) =>
    set((state) => ({
      tabStacks: {
        ...state.tabStacks,
        [domain]: {
          ...(state.tabStacks[domain] || { name: domain, color: null, collapsed: false }),
          collapsed: !(state.tabStacks[domain]?.collapsed),
        },
      },
    })),

  // Rename a stack
  renameStack: (domain, name) =>
    set((state) => ({
      tabStacks: {
        ...state.tabStacks,
        [domain]: { ...(state.tabStacks[domain] || {}), name },
      },
    })),

  // ── Tab Groups (manual named groups) ────────
  tabGroups: {},  // { [groupId]: { name, color, collapsed } }
  nextGroupId: 1,

  createTabGroup: (name, color) =>
    set((state) => {
      const id = `g${state.nextGroupId}`;
      return {
        tabGroups: { ...state.tabGroups, [id]: { name, color, collapsed: false } },
        nextGroupId: state.nextGroupId + 1,
      };
    }),

  deleteTabGroup: (groupId) =>
    set((state) => {
      const { [groupId]: _, ...rest } = state.tabGroups;
      return {
        tabGroups: rest,
        tabs: state.tabs.map((t) => t.group === groupId ? { ...t, group: null } : t),
      };
    }),

  renameTabGroup: (groupId, name) =>
    set((state) => ({
      tabGroups: {
        ...state.tabGroups,
        [groupId]: { ...state.tabGroups[groupId], name },
      },
    })),

  toggleTabGroup: (groupId) =>
    set((state) => ({
      tabGroups: {
        ...state.tabGroups,
        [groupId]: { ...state.tabGroups[groupId], collapsed: !state.tabGroups[groupId]?.collapsed },
      },
    })),

  assignTabToGroup: (tabId, groupId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => t.id === tabId ? { ...t, group: groupId } : t),
    })),

  // ── Workspaces (save/restore tab sets) ────────
  workspaces: [],  // [{ id, name, tabs: [{ url, title, favicon }], createdAt }]
  setWorkspaces: (workspaces) => set({ workspaces }),

  saveWorkspace: (name) =>
    set((state) => {
      const snapshot = state.tabs
        .filter((t) => t.url !== 'flip://newtab' && !t.suspended)
        .map(({ url, title, favicon }) => ({ url, title, favicon }));
      const ws = {
        id: Date.now(),
        name,
        tabs: snapshot,
        createdAt: new Date().toISOString(),
      };
      const updated = [...state.workspaces, ws];
      window.flipAPI?.saveWorkspaces?.(updated);
      return { workspaces: updated };
    }),

  loadWorkspace: (wsId) => {
    const state = get();
    const ws = state.workspaces.find((w) => w.id === wsId);
    if (!ws || ws.tabs.length === 0) return;
    // Close all current tabs, open workspace tabs
    let nextId = state.nextTabId;
    const newTabs = ws.tabs.map((t) => ({
      id: nextId++,
      url: t.url,
      title: t.title || t.url,
      favicon: t.favicon || null,
      loading: true,
      canGoBack: false,
      canGoForward: false,
      lastActive: Date.now(),
      pinned: false,
      suspended: false,
      group: null,
    }));
    set({
      tabs: newTabs,
      activeTabId: newTabs[0].id,
      nextTabId: nextId,
    });
  },

  deleteWorkspace: (wsId) =>
    set((state) => {
      const updated = state.workspaces.filter((w) => w.id !== wsId);
      window.flipAPI?.saveWorkspaces?.(updated);
      return { workspaces: updated };
    }),

  // ── Sidebar ───────────────────────────────────
  sidebarOpen: true,
  sidebarWidth: 260,
  sidebarView: 'tabs', // 'tabs' | 'bookmarks' | 'history' | 'extensions' | 'settings'

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarView: (view) => set({ sidebarView: view, sidebarOpen: true }),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(500, width)) }),

  // ── Command Palette ───────────────────────────
  commandPaletteOpen: false,
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  // ── Split View ────────────────────────────────
  splitView: false,
  splitTabId: null,

  toggleSplitView: () =>
    set((state) => {
      if (state.splitView) {
        return { splitView: false, splitTabId: null };
      }
      // Create a new independent tab for the split pane
      const id = state.nextTabId;
      return {
        splitView: true,
        splitTabId: id,
        nextTabId: id + 1,
        tabs: [
          ...state.tabs,
          {
            id,
            url: 'flip://newtab',
            title: 'New Tab',
            favicon: null,
            loading: false,
            canGoBack: false,
            canGoForward: false,
            suspended: false,
            lastActive: Date.now(),
            isSplitTab: true,
          },
        ],
      };
    }),

  closeSplitView: () =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== state.splitTabId);
      return { splitView: false, splitTabId: null, tabs: newTabs };
    }),

  navigateSplitTab: (url) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === state.splitTabId ? { ...t, url, title: url, loading: true } : t
      ),
    })),

  // ── Settings ──────────────────────────────────
  settings: { ...DEFAULT_SETTINGS },

  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  // ── Bookmarks ─────────────────────────────────
  bookmarks: [],
  setBookmarks: (bookmarks) => set({ bookmarks }),

  addBookmark: (bookmark) =>
    set((state) => {
      const bookmarks = [...state.bookmarks, { ...bookmark, id: Date.now() }];
      window.flipAPI?.saveBookmarks(bookmarks);
      return { bookmarks };
    }),

  removeBookmark: (id) =>
    set((state) => {
      const bookmarks = state.bookmarks.filter((b) => b.id !== id);
      window.flipAPI?.saveBookmarks(bookmarks);
      return { bookmarks };
    }),

  isBookmarked: (url) => get().bookmarks.some((b) => b.url === url),

  // ── History ───────────────────────────────────
  history: [],
  setHistory: (history) => set({ history }),

  // ── Extensions ────────────────────────────────
  extensions: [],
  setExtensions: (extensions) => set({ extensions }),

  toggleExtension: (id) =>
    set((state) => {
      const updated = state.extensions.map((e) =>
        e.id === id ? { ...e, enabled: !e.enabled } : e
      );
      // Persist toggle states to disk
      const states = {};
      updated.forEach((e) => { states[e.id] = e.enabled; });
      window.flipAPI?.saveExtensionStates?.(states);
      return { extensions: updated };
    }),

  addExtension: (ext) =>
    set((state) => ({
      extensions: [...state.extensions, ext],
    })),

  // ── VPN / Proxy ─────────────────────────────────
  vpn: {
    active: false,
    type: 'socks5',
    host: '',
    port: '',
    username: '',
    password: '',
    currentIp: null,
    connecting: false,
    error: null,
  },
  setVpn: (partial) =>
    set((state) => ({
      vpn: { ...state.vpn, ...partial },
    })),

  // ── Ad Blocker Stats ──────────────────────────
  blockedCount: 0,
  incrementBlocked: () => set((s) => ({ blockedCount: s.blockedCount + 1 })),

  // ── Reading Mode ────────────────────────────
  readingMode: false,
  toggleReadingMode: () => set((s) => ({ readingMode: !s.readingMode })),

  // ── Autofill ───────────────────────────────────
  autofill: { addresses: [], payments: [] },
  setAutofill: (data) => set({ autofill: data }),

  // ── Notification Permissions ───────────────────
  notificationPerms: {}, // { 'example.com': 'allow' | 'block' }
  setNotificationPerms: (perms) => set({ notificationPerms: perms }),

  // ── Keyboard Shortcuts ─────────────────────────
  shortcuts: {
    newTab: 'Ctrl+T',
    closeTab: 'Ctrl+W',
    reopenTab: 'Ctrl+Shift+T',
    commandPalette: 'Ctrl+K',
    focusAddress: 'Ctrl+L',
    toggleSidebar: 'Ctrl+B',
    splitView: 'Ctrl+Shift+S',
    devTools: 'F12',
    reload: 'Ctrl+R',
    zoomIn: 'Ctrl+=',
    zoomOut: 'Ctrl+-',
    zoomReset: 'Ctrl+0',
    pip: 'Ctrl+Shift+P',
  },
  setShortcuts: (shortcuts) => set({ shortcuts }),

  // ── Picture-in-Picture ─────────────────────────────────────
  pipActive: false,
  setPipActive: (active) => set({ pipActive: active }),

  // ── Reader Settings ──────────────────────────────────────
  readerSettings: { fontSize: 18, fontFamily: 'serif', bgColor: '#1a1a1a', textColor: '#e0e0e0' },
  setReaderSettings: (s) => set({ readerSettings: s }),

  // ── User Profiles ────────────────────────────────────────
  profiles: { active: 'Default', profiles: [{ name: 'Default', created: Date.now() }] },
  setProfiles: (p) => set({ profiles: p }),

  // ── Site-Specific Settings ───────────────────────────────
  // { 'example.com': { zoom: 100, jsEnabled: true, cookiesEnabled: true } }
  siteSettings: {},
  setSiteSettings: (s) => set({ siteSettings: s }),
  updateSiteSetting: (domain, partial) =>
    set((state) => ({
      siteSettings: {
        ...state.siteSettings,
        [domain]: { ...(state.siteSettings[domain] || {}), ...partial },
      },
    })),

  // ── Pending credential prompt (auto-detected from login forms) ──
  pendingCredential: null, // { site, username, password, tabId }
  setPendingCredential: (cred) => set({ pendingCredential: cred }),

  // ── Permission request prompt (notifications, camera, mic, etc.) ──
  permissionRequest: null, // { id, origin, permission, type }
  setPermissionRequest: (req) => set({ permissionRequest: req }),

  // ── Downloads (placeholder) ───────────────────
  downloads: [],
}));

export default useBrowserStore;
