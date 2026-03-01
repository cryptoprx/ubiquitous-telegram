# Flip Browser

A privacy-first web browser built with Electron and React, featuring a sandboxed React extension system, built-in ad/tracker blocking, and companion app integration.

## Features

- Vertical sidebar tabs with domain grouping, search, and auto-suspension
- Built-in ad blocker (EasyList + EasyPrivacy, 143K+ filters) and tracking parameter stripping
- AI assistant with streaming, tool use, and page-aware context
- Sandboxed React extension system with permission enforcement
- Extension marketplace with premium support via Stripe
- Companion app sync (tabs, passwords, notifications, AI relay, calls)
- Workspaces, session manager, command palette, split view
- XRPL wallet integration with x402 micropayment support

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

Requires `GH_TOKEN` in `.env`. See `scripts/publish.js` for the full pipeline.

## Project Structure

```
├── electron/
│   ├── main.js            # Main process, IPC handlers, AI, extensions
│   ├── preload.js         # Context bridge (flipAPI)
│   ├── adblock.js         # Ad/tracker blocking engine
│   └── wallet.js          # XRPL wallet operations
├── src/
│   ├── App.jsx            # Root layout and routing
│   ├── main.jsx           # Entry point
│   ├── i18n.js            # Internationalization
│   ├── index.css          # Global styles
│   ├── store/
│   │   └── browserStore.js
│   ├── lib/
│   │   └── companionSync.js
│   ├── components/
│   │   ├── TitleBar.jsx
│   │   ├── Sidebar.jsx
│   │   ├── AddressBar.jsx
│   │   ├── WebContent.jsx
│   │   ├── NewTabPage.jsx
│   │   ├── CommandPalette.jsx
│   │   ├── Marketplace.jsx
│   │   ├── AiOverlay.jsx
│   │   ├── AiTabAssistant.jsx
│   │   ├── LicenseGate.jsx
│   │   ├── X402PaymentPrompt.jsx
│   │   └── extensions/
│   │       ├── ExtensionHost.jsx
│   │       ├── ExtensionManager.jsx
│   │       ├── ExtensionPanel.jsx
│   │       └── DevDashboard.jsx
│   └── pages/
│       └── ExtensionStudio.jsx
├── extensions/            # Bundled extensions
├── scripts/               # Build, publish, and CI tooling
├── docs/                  # Whitepaper, build guides
└── public/                # Static assets
```

## Tech Stack

- **Electron 28** — Chromium rendering
- **React 18** — UI
- **Vite 5** — Build tooling
- **TailwindCSS 3** — Styling
- **Zustand** — State management
- **Firebase** — Companion app sync
- **Lucide React** — Icons

## License

Proprietary — see [LICENSE](./LICENSE).
