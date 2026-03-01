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

  // Auto-suspend tabs inactive longer than threshold (minutes)
  autoSuspendInactiveTabs: (thresholdMinutes = 30) => {
    const state = get();
    const now = Date.now();
    const threshold = thresholdMinutes * 60 * 1000;
    const updated = state.tabs.map(t => {
      if (t.suspended || t.pinned || t.id === state.activeTabId || t.url === 'flip://newtab' || t.url?.startsWith('flip://')) return t;
      if (now - (t.lastActive || 0) > threshold) return { ...t, suspended: true };
      return t;
    });
    const suspendedCount = updated.filter(t => t.suspended).length - state.tabs.filter(t => t.suspended).length;
    if (suspendedCount > 0) set({ tabs: updated });
    return suspendedCount;
  },

  // Unsuspend all tabs
  unsuspendAll: () =>
    set((state) => ({
      tabs: state.tabs.map(t => ({ ...t, suspended: false })),
    })),

  // Get suspend stats
  getSuspendStats: () => {
    const state = get();
    const total = state.tabs.length;
    const suspended = state.tabs.filter(t => t.suspended).length;
    const active = total - suspended;
    // Rough estimate: ~50MB per active tab, ~5MB per suspended tab
    const estimatedSaved = suspended * 45; // MB saved
    return { total, suspended, active, estimatedSavedMB: estimatedSaved };
  },

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

  // Auto-group all tabs by their domain
  autoGroupByDomain: () => {
    const state = get();
    const domainColors = ['#f97316', '#8b5cf6', '#06b6d4', '#22c55e', '#ef4444', '#eab308', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];
    const domainMap = {}; // domain -> groupId
    let nextGrpId = state.nextGroupId;
    const newGroups = { ...state.tabGroups };
    const newTabs = state.tabs.map(t => {
      if (t.pinned || !t.url || t.url === 'flip://newtab') return t;
      try {
        const hostname = new URL(t.url).hostname.replace(/^www\./, '');
        const domain = hostname.split('.').slice(-2).join('.');
        if (!domainMap[domain]) {
          // Check if group already exists for this domain
          const existing = Object.entries(newGroups).find(([, g]) => g.name === domain);
          if (existing) {
            domainMap[domain] = existing[0];
          } else {
            const gid = `g${nextGrpId++}`;
            newGroups[gid] = { name: domain, color: domainColors[Object.keys(domainMap).length % domainColors.length], collapsed: false };
            domainMap[domain] = gid;
          }
        }
        return { ...t, group: domainMap[domain] };
      } catch { return t; }
    });
    // Only keep groups that have tabs
    const usedGroups = new Set(newTabs.map(t => t.group).filter(Boolean));
    const finalGroups = {};
    for (const [gid, g] of Object.entries(newGroups)) {
      if (usedGroups.has(gid)) finalGroups[gid] = g;
    }
    set({ tabs: newTabs, tabGroups: finalGroups, nextGroupId: nextGrpId });
  },

  // Ungroup all tabs
  ungroupAll: () =>
    set((state) => ({
      tabs: state.tabs.map(t => ({ ...t, group: null })),
      tabGroups: {},
    })),

  workspaces: [],  // [{ id, name, tabs: [...], createdAt, color, template }]
  activeWorkspaceId: null, // currently active workspace id
  setWorkspaces: (workspaces) => set({ workspaces }),

  saveWorkspace: (name, template) =>
    set((state) => {
      const snapshot = state.tabs
        .filter((t) => t.url !== 'flip://newtab' && !t.suspended)
        .map(({ url, title, favicon, pinned }) => ({ url, title, favicon, pinned }));
      const colors = ['#f97316', '#8b5cf6', '#06b6d4', '#22c55e', '#ef4444', '#eab308', '#ec4899', '#6366f1'];
      const ws = {
        id: Date.now(),
        name,
        tabs: snapshot,
        createdAt: new Date().toISOString(),
        color: colors[state.workspaces.length % colors.length],
        template: template || null,
      };
      const updated = [...state.workspaces, ws];
      window.flipAPI?.saveWorkspaces?.(updated);
      return { workspaces: updated };
    }),

  switchWorkspace: (wsId) => {
    const state = get();
    if (state.activeWorkspaceId === wsId) return;

    // Save current tabs into the active workspace before switching
    const currentWsId = state.activeWorkspaceId;
    let updatedWorkspaces = [...state.workspaces];
    if (currentWsId) {
      const idx = updatedWorkspaces.findIndex(w => w.id === currentWsId);
      if (idx >= 0) {
        updatedWorkspaces[idx] = {
          ...updatedWorkspaces[idx],
          tabs: state.tabs
            .filter(t => t.url !== 'flip://newtab' && !t.suspended)
            .map(({ url, title, favicon, pinned }) => ({ url, title, favicon, pinned })),
        };
      }
    }

    // Load target workspace tabs
    const ws = updatedWorkspaces.find(w => w.id === wsId);
    if (!ws) return;

    let nextId = state.nextTabId;
    const newTabs = ws.tabs.length > 0 ? ws.tabs.map(t => ({
      id: nextId++,
      url: t.url,
      title: t.title || t.url,
      favicon: t.favicon || null,
      loading: true,
      canGoBack: false,
      canGoForward: false,
      lastActive: Date.now(),
      pinned: t.pinned || false,
      suspended: false,
      group: null,
    })) : [{
      id: nextId++,
      url: 'flip://newtab',
      title: 'New Tab',
      loading: false,
      canGoBack: false,
      canGoForward: false,
      lastActive: Date.now(),
      pinned: false,
      suspended: false,
      group: null,
    }];

    window.flipAPI?.saveWorkspaces?.(updatedWorkspaces);
    set({
      workspaces: updatedWorkspaces,
      activeWorkspaceId: wsId,
      tabs: newTabs,
      activeTabId: newTabs[0].id,
      nextTabId: nextId,
    });
  },

  loadWorkspace: (wsId) => {
    const state = get();
    const ws = state.workspaces.find((w) => w.id === wsId);
    if (!ws || ws.tabs.length === 0) return;
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
      pinned: t.pinned || false,
      suspended: false,
      group: null,
    }));
    set({
      tabs: newTabs,
      activeTabId: newTabs[0].id,
      nextTabId: nextId,
      activeWorkspaceId: wsId,
    });
  },

  createWorkspaceFromTemplate: (template) => {
    const templates = {
      development: { name: 'Development', tabs: [
        { url: 'https://github.com', title: 'GitHub' },
        { url: 'https://stackoverflow.com', title: 'Stack Overflow' },
        { url: 'https://developer.mozilla.org', title: 'MDN Web Docs' },
      ]},
      research: { name: 'Research', tabs: [
        { url: 'https://scholar.google.com', title: 'Google Scholar' },
        { url: 'https://en.wikipedia.org', title: 'Wikipedia' },
      ]},
      shopping: { name: 'Shopping', tabs: [
        { url: 'https://amazon.com', title: 'Amazon' },
      ]},
      social: { name: 'Social', tabs: [
        { url: 'https://twitter.com', title: 'X (Twitter)' },
        { url: 'https://reddit.com', title: 'Reddit' },
      ]},
    };
    const tpl = templates[template];
    if (!tpl) return;
    const state = get();
    const colors = ['#f97316', '#8b5cf6', '#06b6d4', '#22c55e', '#ef4444', '#eab308', '#ec4899', '#6366f1'];
    const ws = {
      id: Date.now(),
      name: tpl.name,
      tabs: tpl.tabs,
      createdAt: new Date().toISOString(),
      color: colors[state.workspaces.length % colors.length],
      template,
    };
    const updated = [...state.workspaces, ws];
    window.flipAPI?.saveWorkspaces?.(updated);
    set({ workspaces: updated });
  },

  renameWorkspace: (wsId, name) =>
    set((state) => {
      const updated = state.workspaces.map(w => w.id === wsId ? { ...w, name } : w);
      window.flipAPI?.saveWorkspaces?.(updated);
      return { workspaces: updated };
    }),

  deleteWorkspace: (wsId) =>
    set((state) => {
      const updated = state.workspaces.filter((w) => w.id !== wsId);
      window.flipAPI?.saveWorkspaces?.(updated);
      const newState = { workspaces: updated };
      if (state.activeWorkspaceId === wsId) newState.activeWorkspaceId = null;
      return newState;
    }),

  sidebarOpen: true,
  sidebarWidth: 260,
  sidebarView: 'tabs', // 'tabs' | 'bookmarks' | 'history' | 'extensions' | 'settings'

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarView: (view) => set({ sidebarView: view, sidebarOpen: true }),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(500, width)) }),

  commandPaletteOpen: false,
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),

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

  settings: { ...DEFAULT_SETTINGS },

  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  bookmarks: [],
  bookmarkCategories: ['General', 'Development', 'News', 'Social', 'Shopping', 'Research', 'Entertainment', 'Work', 'Finance', 'Education'],
  setBookmarks: (bookmarks) => set({ bookmarks }),

  addBookmark: (bookmark) => {
    const id = Date.now();
    const newBm = { ...bookmark, id, category: bookmark.category || 'General', addedAt: new Date().toISOString() };
    set((state) => {
      const bookmarks = [...state.bookmarks, newBm];
      window.flipAPI?.saveBookmarks(bookmarks);
      return { bookmarks };
    });
    // Fire-and-forget AI categorization
    if (window.flipAPI?.aiChat && !bookmark.category) {
      window.flipAPI.aiChat({
        messages: [
          { role: 'system', content: 'You are a bookmark categorizer. Given a URL and title, respond with ONLY one category from this list: General, Development, News, Social, Shopping, Research, Entertainment, Work, Finance, Education. No explanation, just the category word.' },
          { role: 'user', content: `URL: ${bookmark.url}\nTitle: ${bookmark.title || ''}` },
        ],
        stream: false,
      }).then(result => {
        const cat = (typeof result === 'string' ? result : result?.content || '').trim();
        const validCats = get().bookmarkCategories;
        if (cat && validCats.includes(cat)) {
          set((state) => {
            const bookmarks = state.bookmarks.map(b => b.id === id ? { ...b, category: cat } : b);
            window.flipAPI?.saveBookmarks(bookmarks);
            return { bookmarks };
          });
        }
      }).catch(() => {});
    }
  },

  updateBookmark: (id, partial) =>
    set((state) => {
      const bookmarks = state.bookmarks.map(b => b.id === id ? { ...b, ...partial } : b);
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

  history: [],
  setHistory: (history) => set({ history }),

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

  blockedCount: 0,
  incrementBlocked: () => set((s) => ({ blockedCount: s.blockedCount + 1 })),

  readingMode: false,
  toggleReadingMode: () => set((s) => ({ readingMode: !s.readingMode })),

  autofill: { addresses: [], payments: [] },
  setAutofill: (data) => set({ autofill: data }),

  notificationPerms: {}, // { 'example.com': 'allow' | 'block' }
  setNotificationPerms: (perms) => set({ notificationPerms: perms }),

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

  pipActive: false,
  setPipActive: (active) => set({ pipActive: active }),

  readerSettings: { fontSize: 18, fontFamily: 'serif', bgColor: '#1a1a1a', textColor: '#e0e0e0' },
  setReaderSettings: (s) => set({ readerSettings: s }),

  profiles: { active: 'Default', profiles: [{ name: 'Default', created: Date.now() }] },
  setProfiles: (p) => set({ profiles: p }),

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

  pendingCredential: null, // { site, username, password, tabId }
  setPendingCredential: (cred) => set({ pendingCredential: cred }),

  permissionRequest: null, // { id, origin, permission, type }
  setPermissionRequest: (req) => set({ permissionRequest: req }),

  downloads: [],
}));

export default useBrowserStore;
