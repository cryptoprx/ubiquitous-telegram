# Flip Browser

A privacy-first web browser built with Electron and React. Features a sandboxed React extension system, built-in ad/tracker blocking, an AI assistant, and an extension marketplace — all designed to give users full control over their browsing experience.

**Version:** 1.2.90 · **Platform:** Windows & macOS (Linux coming soon) · **By:** [CROAKWORKS](https://croak.work)

---

## Features

### Browsing & Tabs
- Vertical sidebar tabs with search, pinning, groups, and auto-suspension
- Tab groups and workspaces — named groups, collapsible, save/load layouts
- Split view — two pages side by side in the same window
- Session restore — auto-save and restore all tabs on restart or crash
- User profiles — separate bookmarks, history, passwords per profile
- Command palette (Ctrl+K) — search tabs, bookmarks, history, and browser actions

### Privacy & Security
- Built-in ad/tracker blocker (EasyList + EasyPrivacy, 143K+ filters)
- HTTPS-only mode with automatic HTTP → HTTPS upgrade
- DNS-over-HTTPS via Cloudflare (always active)
- Fingerprint protection (canvas, WebGL, AudioContext, navigator spoofing)
- AES-256 encrypted storage for passwords, autofill, and sensitive data
- Tamper protection via Electron Fuses and runtime SHA-256 integrity checks
- Strict Content Security Policy on production builds
- Camera, mic, and geolocation blocked by default

### AI Assistant
- Multi-provider LLM support (Ollama, LM Studio, OpenAI, custom endpoints)
- 24 browser action tools (page reading, tab management, web search, CSS injection, data extraction)
- Streaming responses with multi-round tool calling (up to 10 rounds)
- Quick actions: summarize, explain, key points, organize tabs, translate
- Context menu and address bar integration

### Built-in Tools
- Password manager — save, reveal, autofill credentials (encrypted on device)
- Autofill manager — addresses and payment methods (encrypted)
- Download manager — real-time progress, speed, status in the sidebar
- VPN/Proxy — SOCKS5, SOCKS4, HTTP, HTTPS via session proxy
- Performance dashboard — memory, CPU, per-tab process monitoring
- Crypto tracker — top 10 coins by market cap via CoinGecko
- Notifications manager — per-site allow/block permissions
- Keyboard shortcuts — 13 rebindable actions with record mode
- Screenshot tool — capture visible page, save as PNG
- Translation — 12 languages via Google Translate
- Picture-in-Picture — floating video from any site
- Reading mode — distraction-free view with font/theme options
- Import/Export — bookmarks from Chrome/Firefox, passwords from CSV
- Site-specific settings — per-site zoom, JS toggle, cookie preferences
- New tab dashboard — wallpapers, quick links, daily quotes, BBC news, stats

### Extension System & Marketplace
- Sandboxed React extension system with permission enforcement
- Extension marketplace — remote catalog, one-click install/uninstall
- 15+ extensions including AI Chat, Music Player, Community Chat, File Sharing, Video Calling, Screenshot Annotator, Meme Generator, and developer tools
- Cross-extension storage API for secure data sharing
- Extensions can run in sidebar panel or full-tab mode (`flip://ext/{id}`)
- CORS-free network API (`Flip.net.fetch`) with SSRF protection
- Built-in Community Chat with private and public support channels — all encrypted

### Themes & Customization
- 6 color schemes: Warm Coral, Ocean Blue, Midnight Purple, Forest Green, Rose Gold, Monochrome
- Custom new tab wallpapers (presets + custom URL)
- Multi-language support (English, Spanish)

---

## Prerequisites

- Node.js 18+
- npm

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Publish

```bash
npm run publish
```

Requires `GH_TOKEN` in `.env`. The publish pipeline auto-bumps the version, stamps the changelog, builds, uploads, and syncs the download portal.

---

## Project Structure

```
flip-browser/
├── electron/
│   ├── main.js              # Main process (AI, licensing, extensions, privacy, IPC)
│   ├── preload.js           # Context bridge (flipAPI)
│   ├── adblock.js           # Ad/tracker blocking engine
│   ├── wallet.js            # Wallet operations
│   └── integrity.json       # SHA-256 hashes for tamper detection
├── src/
│   ├── App.jsx              # Root layout and routing
│   ├── main.jsx             # Entry point
│   ├── index.css            # Global styles
│   ├── store/
│   │   └── browserStore.js  # Zustand store (tabs, settings, extensions, etc.)
│   └── components/
│       ├── TitleBar.jsx
│       ├── Sidebar.jsx
│       ├── AddressBar.jsx
│       ├── BookmarksBar.jsx
│       ├── WebContent.jsx
│       ├── NewTabPage.jsx
│       ├── CommandPalette.jsx
│       ├── Marketplace.jsx
│       ├── AiOverlay.jsx
│       ├── AiTabAssistant.jsx
│       ├── LicenseGate.jsx
│       ├── FlipLogo.jsx
│       ├── X402PaymentPrompt.jsx
│       ├── extensions/
│       │   ├── ExtensionHost.jsx
│       │   ├── ExtensionManager.jsx
│       │   ├── ExtensionPanel.jsx
│       │   ├── ExtensionDock.jsx
│       │   └── DevDashboard.jsx
│       └── sidebar/
│           ├── BookmarksView.jsx
│           ├── HistoryView.jsx
│           ├── DownloadsView.jsx
│           ├── PasswordsView.jsx
│           ├── CryptoView.jsx
│           ├── VpnView.jsx
│           ├── AutofillView.jsx
│           ├── NotificationsView.jsx
│           ├── PerformanceView.jsx
│           ├── ShortcutsView.jsx
│           ├── ProfilesView.jsx
│           ├── SettingsView.jsx
│           ├── SiteSettingsView.jsx
│           ├── WalletView.jsx
│           └── ...
├── extensions/
│   └── community-chat/     # Built-in Community Chat (webview)
├── scripts/
│   ├── publish.js           # Full publish pipeline
│   ├── afterPack.js         # Electron Fuse flipping (post-build)
│   ├── clean-build.js       # Clean release folder before build
│   ├── generate-integrity.js # SHA-256 hash generation
│   ├── update-changelog.js  # Auto-stamp changelog with version
│   ├── restore-output.js    # Restore output dir after build
│   └── post-publish.js      # Auto-sync version to download portal
├── docs/
│   ├── WHITEPAPER.md        # Full technical whitepaper
│   └── BUILD-MAC.md         # macOS build guide
├── public/                  # Static assets (icons, favicon)
├── marketplace-update/      # Marketplace catalog management
├── changelog.json           # Version history (auto-stamped on publish)
├── package.json
├── tailwind.config.js
├── vite.config.js
└── LICENSE
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Electron 28 (Chromium) |
| **UI** | React 18 |
| **Build** | Vite 5 |
| **Styling** | Tailwind CSS 3 |
| **State** | Zustand |
| **Icons** | Lucide React |
| **Updates** | electron-updater |
| **Packaging** | electron-builder |
| **Security** | @electron/fuses, AES-256 via safeStorage |

## Platform Targets

| Platform | Format | Status |
|----------|--------|--------|
| **Windows** | NSIS Installer (.exe) | Available |
| **macOS** | DMG | Available by request |
| **Linux** | AppImage | Coming Soon |

## License

Proprietary — see [LICENSE](./LICENSE).

To request a license key, contact [@CLOS787 on X](https://x.com/clos787).

---

**CROAKWORKS** — [croak.work](https://croak.work)

*Built with purpose. Browsed with confidence.*
