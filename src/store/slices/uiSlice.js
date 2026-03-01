export const createUISlice = (set) => ({
  sidebarOpen: true,
  sidebarWidth: 260,
  sidebarView: 'tabs',

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

  readingMode: false,
  toggleReadingMode: () => set((s) => ({ readingMode: !s.readingMode })),

  pipActive: false,
  setPipActive: (active) => set({ pipActive: active }),

  blockedCount: 0,
  incrementBlocked: () => set((s) => ({ blockedCount: s.blockedCount + 1 })),

  pendingCredential: null,
  setPendingCredential: (cred) => set({ pendingCredential: cred }),

  permissionRequest: null,
  setPermissionRequest: (req) => set({ permissionRequest: req }),

  downloads: [],
});
