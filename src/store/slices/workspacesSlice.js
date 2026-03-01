export const createWorkspacesSlice = (set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
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
});
