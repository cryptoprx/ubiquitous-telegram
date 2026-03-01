const DEFAULT_SETTINGS = {
  adBlockEnabled: true,
  trackingProtection: true,
  theme: 'dark',
  httpsOnly: true,
  fingerprintProtection: true,
  tabSuspensionEnabled: true,
  tabSuspensionTimeout: 300000,
  verticalTabs: true,
  searchEngine: 'https://duckduckgo.com/?q=',
  homepage: 'flip://newtab',
  showBookmarksBar: false,
  wallpaper: null,
  language: 'en',
};

export const createSettingsSlice = (set) => ({
  settings: { ...DEFAULT_SETTINGS },
  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
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

  autofill: { addresses: [], payments: [] },
  setAutofill: (data) => set({ autofill: data }),

  notificationPerms: {},
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

  readerSettings: { fontSize: 18, fontFamily: 'serif', bgColor: '#1a1a1a', textColor: '#e0e0e0' },
  setReaderSettings: (s) => set({ readerSettings: s }),

  profiles: { active: 'Default', profiles: [{ name: 'Default', created: Date.now() }] },
  setProfiles: (p) => set({ profiles: p }),

  siteSettings: {},
  setSiteSettings: (s) => set({ siteSettings: s }),
  updateSiteSetting: (domain, partial) =>
    set((state) => ({
      siteSettings: {
        ...state.siteSettings,
        [domain]: { ...(state.siteSettings[domain] || {}), ...partial },
      },
    })),
});
