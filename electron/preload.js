const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flipAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Extensions
  loadExtensions: () => ipcRenderer.invoke('load-extensions'),
  installExtension: () => ipcRenderer.invoke('install-extension'),
  createExtension: (data) => ipcRenderer.invoke('create-extension', data),

  // VPN / Proxy
  setProxy: (config) => ipcRenderer.invoke('set-proxy', config),
  clearProxy: () => ipcRenderer.invoke('clear-proxy'),
  getProxyStatus: () => ipcRenderer.invoke('get-proxy-status'),
  checkIp: () => ipcRenderer.invoke('check-ip'),

  // Ad blocker & tracking protection
  getBlockedCount: () => ipcRenderer.invoke('get-blocked-count'),
  setAdBlock: (enabled) => ipcRenderer.invoke('set-ad-block', enabled),
  setTrackingProtection: (enabled) => ipcRenderer.invoke('set-tracking-protection', enabled),
  onAdBlocked: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('ad-blocked', handler);
    return () => ipcRenderer.removeListener('ad-blocked', handler);
  },

  // Bookmarks
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  saveBookmarks: (bookmarks) => ipcRenderer.invoke('save-bookmarks', bookmarks),

  // History
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (entry) => ipcRenderer.invoke('add-history', entry),

  // Pinned tabs
  getPinnedTabs: () => ipcRenderer.invoke('get-pinned-tabs'),
  savePinnedTabs: (tabs) => ipcRenderer.invoke('save-pinned-tabs', tabs),

  // Settings persistence
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Passwords
  getPasswords: () => ipcRenderer.invoke('get-passwords'),
  savePasswords: (passwords) => ipcRenderer.invoke('save-passwords', passwords),

  // Autofill
  getAutofill: () => ipcRenderer.invoke('get-autofill'),
  saveAutofill: (data) => ipcRenderer.invoke('save-autofill', data),

  // Notification permissions
  getNotificationPermissions: () => ipcRenderer.invoke('get-notification-permissions'),
  saveNotificationPermissions: (perms) => ipcRenderer.invoke('save-notification-permissions', perms),

  // Performance
  getAppMetrics: () => ipcRenderer.invoke('get-app-metrics'),
  getProcessMemory: () => ipcRenderer.invoke('get-process-memory'),

  // Import/Export
  importBookmarksFile: () => ipcRenderer.invoke('import-bookmarks-file'),
  exportBookmarksFile: (bookmarks) => ipcRenderer.invoke('export-bookmarks-file', bookmarks),
  importPasswordsFile: () => ipcRenderer.invoke('import-passwords-file'),
  exportPasswordsFile: (passwords) => ipcRenderer.invoke('export-passwords-file', passwords),

  // Keyboard shortcuts
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  saveShortcuts: (shortcuts) => ipcRenderer.invoke('save-shortcuts', shortcuts),

  // Session restore
  saveSession: (tabs) => ipcRenderer.invoke('save-session', tabs),
  getSession: () => ipcRenderer.invoke('get-session'),

  // User profiles
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  createProfile: (name) => ipcRenderer.invoke('create-profile', name),
  switchProfile: (name) => ipcRenderer.invoke('switch-profile', name),
  deleteProfile: (name) => ipcRenderer.invoke('delete-profile', name),

  // Site-specific settings
  getSiteSettings: () => ipcRenderer.invoke('get-site-settings'),
  saveSiteSettings: (settings) => ipcRenderer.invoke('save-site-settings', settings),

  // Reader settings
  getReaderSettings: () => ipcRenderer.invoke('get-reader-settings'),
  saveReaderSettings: (settings) => ipcRenderer.invoke('save-reader-settings', settings),

  // Music Player
  pickMusicFolder: () => ipcRenderer.invoke('pick-music-folder'),

  // Screenshot
  saveScreenshot: (dataUrl) => ipcRenderer.invoke('save-screenshot', dataUrl),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (cb) => { ipcRenderer.on('update-status', (_, data) => cb(data)); },

  // Changelog
  getChangelog: () => ipcRenderer.invoke('get-changelog'),
  getWhatsNew: () => ipcRenderer.invoke('get-whats-new'),

  // Extension states
  saveExtensionStates: (states) => ipcRenderer.invoke('save-extension-states', states),

  // Workspaces
  saveWorkspaces: (workspaces) => ipcRenderer.invoke('save-workspaces', workspaces),
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),

  // Browsing data
  clearBrowsingData: (options) => ipcRenderer.invoke('clear-browsing-data', options),

  // Downloads
  getDownloads: () => ipcRenderer.invoke('get-downloads'),

  // Download events
  onDownloadStarted: (cb) => { ipcRenderer.on('download-started', (_, d) => cb(d)); },
  onDownloadUpdated: (cb) => { ipcRenderer.on('download-updated', (_, d) => cb(d)); },
  onDownloadDone: (cb) => { ipcRenderer.on('download-done', (_, d) => cb(d)); },

  // Security
  getCertificateInfo: (url) => ipcRenderer.invoke('get-certificate-info', url),
  setHttpsOnly: (enabled) => ipcRenderer.invoke('set-https-only', enabled),
  setFingerprintProtection: (enabled) => ipcRenderer.invoke('set-fingerprint-protection', enabled),
  getSecurityStatus: () => ipcRenderer.invoke('get-security-status'),

  // Permission request prompt
  respondPermission: (id, allowed) => ipcRenderer.invoke('respond-permission', id, allowed),
  onPermissionRequest: (cb) => { ipcRenderer.on('permission-request', (_, data) => cb(data)); },

  // AI SDK
  aiGetConfig: () => ipcRenderer.invoke('ai-get-config'),
  aiSaveConfig: (config) => ipcRenderer.invoke('ai-save-config', config),
  aiIsAvailable: () => ipcRenderer.invoke('ai-is-available'),
  aiListModels: () => ipcRenderer.invoke('ai-list-models'),
  aiChat: (data) => ipcRenderer.invoke('ai-chat', data),
  aiStop: () => ipcRenderer.invoke('ai-stop'),
  onAiStreamToken: (cb) => { ipcRenderer.on('ai-stream-token', (_, token) => cb(token)); },
  onAiStreamDone: (cb) => { ipcRenderer.on('ai-stream-done', () => cb()); },

  // License
  licenseCheck: () => ipcRenderer.invoke('license-check'),
  licenseActivate: (key) => ipcRenderer.invoke('license-activate', key),

  // Extension fetch (CORS-free for extensions with network permission)
  extFetchUrl: (url, options) => ipcRenderer.invoke('ext-fetch-url', url, options),

  // Extension file save (save base64 data to Downloads folder)
  extSaveFile: (base64, filename, source) => ipcRenderer.invoke('ext-save-file', { base64, filename, source }),

  // Premium Extensions API
  premiumCheckEntitlements: (token) => ipcRenderer.invoke('premium-check-entitlements', token),
  premiumCreateCheckout: (data) => ipcRenderer.invoke('premium-create-checkout', data),
  premiumCancelSubscription: (data) => ipcRenderer.invoke('premium-cancel-subscription', data),

  // Security API
  extSecurityConnections: () => ipcRenderer.invoke('ext-security-connections'),
  extSecurityListening: () => ipcRenderer.invoke('ext-security-listening'),
  extSecurityProcessName: (pid) => ipcRenderer.invoke('ext-security-process-name', pid),
  extSecurityStartup: () => ipcRenderer.invoke('ext-security-startup'),
  extSecurityScan: () => ipcRenderer.invoke('ext-security-scan'),

  // Filesystem API (sandboxed to safe public folders)
  extFsListDir: (dirPath) => ipcRenderer.invoke('ext-fs-list-dir', dirPath),
  extFsGetSize: (dirPath) => ipcRenderer.invoke('ext-fs-get-size', dirPath),
  extFsDelete: (filePaths) => ipcRenderer.invoke('ext-fs-delete', filePaths),
  extFsGetSafeFolders: () => ipcRenderer.invoke('ext-fs-get-safe-folders'),
  extFsDiskUsage: () => ipcRenderer.invoke('ext-fs-disk-usage'),

  // Marketplace
  marketplaceCatalog: () => ipcRenderer.invoke('marketplace-catalog'),
  marketplaceGetInstalled: () => ipcRenderer.invoke('marketplace-get-installed'),
  marketplaceInstall: (extId) => ipcRenderer.invoke('marketplace-install', extId),
  marketplaceUninstall: (extId) => ipcRenderer.invoke('marketplace-uninstall', extId),

  // Events from main process
  onOpenUrl: (callback) => {
    const handler = (_, url) => callback(url);
    ipcRenderer.on('open-url-in-tab', handler);
    return () => ipcRenderer.removeListener('open-url-in-tab', handler);
  },
  savePdf: (data, fileName) => ipcRenderer.invoke('save-pdf', data, fileName),
  onAiCloseTab: (cb) => { ipcRenderer.on('ai-close-tab', (_, tabId) => cb(tabId)); },
  onAiNavigateCurrent: (cb) => { ipcRenderer.on('ai-navigate-current', (_, url) => cb(url)); },
  onAiToggleReadingMode: (cb) => { ipcRenderer.on('ai-toggle-reading-mode', () => cb()); },
  onAiTakeScreenshot: (cb) => { ipcRenderer.on('ai-take-screenshot', () => cb()); },
  onAiPinTab: (cb) => { ipcRenderer.on('ai-pin-tab', () => cb()); },
  onAiDuplicateTab: (cb) => { ipcRenderer.on('ai-duplicate-tab', () => cb()); },
  onAiSwitchTab: (cb) => { ipcRenderer.on('ai-switch-tab', (_, tabId) => cb(tabId)); },
  onAiCloseOtherTabs: (cb) => { ipcRenderer.on('ai-close-other-tabs', () => cb()); },
  onBookmarksUpdated: (cb) => { ipcRenderer.on('bookmarks-updated', () => cb()); },

  // Window management
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  newWindow: () => ipcRenderer.invoke('new-window'),
  newPrivateWindow: () => ipcRenderer.invoke('new-private-window'),
});
