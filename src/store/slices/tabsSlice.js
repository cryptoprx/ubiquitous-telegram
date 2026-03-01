export const createTabsSlice = (set, get) => ({
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

  unsuspendAll: () =>
    set((state) => ({
      tabs: state.tabs.map(t => ({ ...t, suspended: false })),
    })),

  getSuspendStats: () => {
    const state = get();
    const total = state.tabs.length;
    const suspended = state.tabs.filter(t => t.suspended).length;
    const active = total - suspended;
    const estimatedSaved = suspended * 45;
    return { total, suspended, active, estimatedSavedMB: estimatedSaved };
  },

  tabStacks: {},
  nextStackColor: 0,

  getStackColors: () => [
    '#ff6234', '#2dd4a8', '#a78bfa', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  ],

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

  renameStack: (domain, name) =>
    set((state) => ({
      tabStacks: {
        ...state.tabStacks,
        [domain]: { ...(state.tabStacks[domain] || {}), name },
      },
    })),

  tabGroups: {},
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

  autoGroupByDomain: () => {
    const state = get();
    const domainColors = ['#f97316', '#8b5cf6', '#06b6d4', '#22c55e', '#ef4444', '#eab308', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];
    const domainMap = {};
    let nextGrpId = state.nextGroupId;
    const newGroups = { ...state.tabGroups };
    const newTabs = state.tabs.map(t => {
      if (t.pinned || !t.url || t.url === 'flip://newtab') return t;
      try {
        const hostname = new URL(t.url).hostname.replace(/^www\./, '');
        const domain = hostname.split('.').slice(-2).join('.');
        if (!domainMap[domain]) {
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
    const usedGroups = new Set(newTabs.map(t => t.group).filter(Boolean));
    const finalGroups = {};
    for (const [gid, g] of Object.entries(newGroups)) {
      if (usedGroups.has(gid)) finalGroups[gid] = g;
    }
    set({ tabs: newTabs, tabGroups: finalGroups, nextGroupId: nextGrpId });
  },

  ungroupAll: () =>
    set((state) => ({
      tabs: state.tabs.map(t => ({ ...t, group: null })),
      tabGroups: {},
    })),
});
