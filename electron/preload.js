const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flipAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Extensions
  loadExtensions: () => ipcRenderer.invoke('load-extensions'),
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
  adblockStats: () => ipcRenderer.invoke('adblock-stats'),
  adblockToggleSite: (hostname) => ipcRenderer.invoke('adblock-toggle-site', hostname),
  adblockIsWhitelisted: (hostname) => ipcRenderer.invoke('adblock-is-whitelisted', hostname),
  adblockGetWhitelist: () => ipcRenderer.invoke('adblock-get-whitelist'),
  adblockCosmeticCSS: (hostname) => ipcRenderer.invoke('adblock-cosmetic-css', hostname),
  adblockForceUpdate: () => ipcRenderer.invoke('adblock-force-update'),

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
  saveNamedSession: (data) => ipcRenderer.invoke('save-named-session', data),
  getNamedSessions: () => ipcRenderer.invoke('get-named-sessions'),
  loadNamedSession: (id) => ipcRenderer.invoke('load-named-session', id),
  deleteNamedSession: (id) => ipcRenderer.invoke('delete-named-session', id),

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
  onUpdateStatus: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },

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
  onDownloadStarted: (cb) => {
    const handler = (_, d) => cb(d);
    ipcRenderer.on('download-started', handler);
    return () => ipcRenderer.removeListener('download-started', handler);
  },
  onDownloadUpdated: (cb) => {
    const handler = (_, d) => cb(d);
    ipcRenderer.on('download-updated', handler);
    return () => ipcRenderer.removeListener('download-updated', handler);
  },
  onDownloadDone: (cb) => {
    const handler = (_, d) => cb(d);
    ipcRenderer.on('download-done', handler);
    return () => ipcRenderer.removeListener('download-done', handler);
  },

  // Security
  getCertificateInfo: (url) => ipcRenderer.invoke('get-certificate-info', url),
  setHttpsOnly: (enabled) => ipcRenderer.invoke('set-https-only', enabled),
  setFingerprintProtection: (enabled) => ipcRenderer.invoke('set-fingerprint-protection', enabled),
  getSecurityStatus: () => ipcRenderer.invoke('get-security-status'),

  // Permission request prompt
  respondPermission: (id, allowed) => ipcRenderer.invoke('respond-permission', id, allowed),
  onPermissionRequest: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('permission-request', handler);
    return () => ipcRenderer.removeListener('permission-request', handler);
  },

  // AI SDK
  aiGetConfig: () => ipcRenderer.invoke('ai-get-config'),
  aiSaveConfig: (config) => ipcRenderer.invoke('ai-save-config', config),
  aiIsAvailable: () => ipcRenderer.invoke('ai-is-available'),
  aiListModels: () => ipcRenderer.invoke('ai-list-models'),
  aiChat: (data) => ipcRenderer.invoke('ai-chat', data),
  aiStop: () => ipcRenderer.invoke('ai-stop'),
  onAiStreamToken: (cb) => {
    const handler = (_, token) => cb(token);
    ipcRenderer.on('ai-stream-token', handler);
    return () => ipcRenderer.removeListener('ai-stream-token', handler);
  },
  onAiStreamDone: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('ai-stream-done', handler);
    return () => ipcRenderer.removeListener('ai-stream-done', handler);
  },
  // Extension Studio AI (locked-down)
  aiStudioChat: (data) => ipcRenderer.invoke('ai-studio-chat', data),
  aiStudioStop: () => ipcRenderer.invoke('ai-studio-stop'),
  onAiStudioToken: (cb) => {
    const handler = (_, token) => cb(token);
    ipcRenderer.on('ai-studio-token', handler);
    return handler;
  },
  offAiStudioToken: () => { ipcRenderer.removeAllListeners('ai-studio-token'); },
  onAiStudioDone: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('ai-studio-done', handler);
    return handler;
  },
  offAiStudioDone: () => { ipcRenderer.removeAllListeners('ai-studio-done'); },

  // Base Wallet (x402)
  walletHas: () => ipcRenderer.invoke('wallet-has'),
  walletCreate: () => ipcRenderer.invoke('wallet-create'),
  walletImport: (seed) => ipcRenderer.invoke('wallet-import', seed),
  walletInfo: () => ipcRenderer.invoke('wallet-info'),
  walletExportMnemonic: () => ipcRenderer.invoke('wallet-export-mnemonic'),
  walletDelete: () => ipcRenderer.invoke('wallet-delete'),
  walletBalance: (testnet) => ipcRenderer.invoke('wallet-balance', testnet),
  walletSendUsdc: (to, amount, testnet) => ipcRenderer.invoke('wallet-send-usdc', to, amount, testnet),
  walletSendEth: (to, amount, testnet) => ipcRenderer.invoke('wallet-send-eth', to, amount, testnet),
  walletSignX402: (paymentReq) => ipcRenderer.invoke('wallet-sign-x402', paymentReq),
  walletTxHistory: () => ipcRenderer.invoke('wallet-tx-history'),
  walletAddTx: (entry) => ipcRenderer.invoke('wallet-add-tx', entry),
  onX402PaymentRequest: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('x402-payment-request', handler);
    return () => ipcRenderer.removeListener('x402-payment-request', handler);
  },
  respondX402Payment: (id, approved) => ipcRenderer.invoke('respond-x402-payment', id, approved),

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
  onAiCloseTab: (cb) => {
    const handler = (_, tabId) => cb(tabId);
    ipcRenderer.on('ai-close-tab', handler);
    return () => ipcRenderer.removeListener('ai-close-tab', handler);
  },
  onAiNavigateCurrent: (cb) => {
    const handler = (_, url) => cb(url);
    ipcRenderer.on('ai-navigate-current', handler);
    return () => ipcRenderer.removeListener('ai-navigate-current', handler);
  },
  onAiToggleReadingMode: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('ai-toggle-reading-mode', handler);
    return () => ipcRenderer.removeListener('ai-toggle-reading-mode', handler);
  },
  onAiTakeScreenshot: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('ai-take-screenshot', handler);
    return () => ipcRenderer.removeListener('ai-take-screenshot', handler);
  },
  onAiPinTab: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('ai-pin-tab', handler);
    return () => ipcRenderer.removeListener('ai-pin-tab', handler);
  },
  onAiDuplicateTab: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('ai-duplicate-tab', handler);
    return () => ipcRenderer.removeListener('ai-duplicate-tab', handler);
  },
  onAiSwitchTab: (cb) => {
    const handler = (_, tabId) => cb(tabId);
    ipcRenderer.on('ai-switch-tab', handler);
    return () => ipcRenderer.removeListener('ai-switch-tab', handler);
  },
  onAiCloseOtherTabs: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('ai-close-other-tabs', handler);
    return () => ipcRenderer.removeListener('ai-close-other-tabs', handler);
  },
  onBookmarksUpdated: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('bookmarks-updated', handler);
    return () => ipcRenderer.removeListener('bookmarks-updated', handler);
  },
  onWatcherChange: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('watcher-change', handler);
    return () => ipcRenderer.removeListener('watcher-change', handler);
  },

  // Window management
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  newWindow: () => ipcRenderer.invoke('new-window'),
  newPrivateWindow: () => ipcRenderer.invoke('new-private-window'),
});
