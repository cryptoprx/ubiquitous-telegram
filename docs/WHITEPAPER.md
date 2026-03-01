# Flip Browser — Whitepaper

**Version 1.2.37**
**Author:** CROAKWORKS ([croak.work](https://croak.work))
**Date:** February 2026

---

## Abstract

Flip Browser is a privacy-first, extensible web browser built on Electron and React. It combines the full rendering power of Chromium with a modern, component-driven UI architecture that gives users complete control over their browsing experience. Unlike traditional browsers that bolt on features through opaque binary extensions, Flip introduces a React-native extension system where developers build sidebar apps using the same tools they already know — React, JSX, and standard web APIs.

This whitepaper outlines the architecture, design philosophy, key features, and technical implementation of Flip Browser.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Design Philosophy](#2-design-philosophy)
3. [Architecture Overview](#3-architecture-overview)
4. [Privacy & Security](#4-privacy--security)
5. [React Extension System](#5-react-extension-system)
6. [Webview Extensions](#6-webview-extensions)
7. [Flip AI Assistant](#7-flip-ai-assistant)
8. [Extension Marketplace](#8-extension-marketplace)
9. [Built-in Features](#9-built-in-features)
10. [User Interface](#10-user-interface)
11. [Technology Stack](#11-technology-stack)
12. [Licensing & Distribution](#12-licensing--distribution)
13. [Roadmap](#13-roadmap)
14. [Conclusion](#14-conclusion)

---

## 1. Introduction

The modern browser landscape is dominated by a handful of players — Chrome, Firefox, Safari, Edge — all sharing similar paradigms established over a decade ago. While these browsers are powerful, they are also bloated, opaque, and increasingly hostile to user privacy.

Flip Browser is a response to this status quo. It is built from the ground up with three core principles:

- **Privacy by default** — Ad and tracker blocking is built into the network layer, not bolted on as an afterthought.
- **Developer-first extensibility** — Extensions are React applications, not arcane WebExtension manifests. If you can build a React component, you can extend Flip.
- **Modern UI/UX** — The entire interface is a React application styled with Tailwind CSS, making every pixel customizable and every interaction fluid.

---

## 2. Design Philosophy

### 2.1 Transparency Over Obscurity

Every component of Flip Browser is a readable React component. The sidebar, address bar, tab management, new tab page, and extension system are all standard JSX files that developers can inspect, modify, and learn from.

### 2.2 Privacy as Architecture

Privacy is not a setting in Flip — it is an architectural decision. The ad blocker operates at the Electron session level, intercepting and cancelling requests to known tracking domains before they reach the renderer. No data leaves the user's machine without their explicit action.

### 2.3 Composability

Flip is designed as a composition of independent, well-scoped components. The sidebar, address bar, web content area, and extension panel are all decoupled units that communicate through a central Zustand store. This makes the codebase easy to reason about, test, and extend.

### 2.4 Warm, Distinctive Identity

Flip's visual identity — coral/orange primaries, teal accents, warm dark surfaces — is intentionally distinct from the cold blues and grays of incumbent browsers. The brand communicates energy, approachability, and a break from convention.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                  Electron Main Process            │
│  ┌────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Ad Blocker │ │ IPC Hub  │ │ Extension Loader│  │
│  │ (session)  │ │          │ │ (filesystem)    │  │
│  └────────────┘ └──────────┘ └────────────────┘  │
│  ┌────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Bookmarks  │ │ History  │ │ Window Manager  │  │
│  │ (JSON)     │ │ (JSON)   │ │                 │  │
│  └────────────┘ └──────────┘ └────────────────┘  │
│  ┌────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Passwords  │ │ Settings │ │Download Tracker │  │
│  │ (encrypted)│ │ (JSON)   │ │ (will-download) │  │
│  └────────────┘ └──────────┘ └────────────────┘  │
│  ┌────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Autofill   │ │VPN/Proxy │ │  Notifications  │  │
│  │ (encrypted)│ │(session) │ │  (JSON)         │  │
│  └────────────┘ └──────────┘ └────────────────┘  │
│  ┌────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Shortcuts  │ │ Metrics  │ │ Import/Export   │  │
│  │ (JSON)     │ │(app.get) │ │ (dialog)        │  │
│  └────────────┘ └──────────┘ └────────────────┘  │
│  ┌────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │  Flip AI   │ │ License  │ │  Marketplace    │  │
│  │(LLM tools) │ │(validate)│ │  (remote pkgs)  │  │
│  └────────────┘ └──────────┘ └────────────────┘  │
└──────────────────────┬───────────────────────────┘
                       │ IPC (contextBridge)
┌──────────────────────▼───────────────────────────┐
│                 Renderer Process                  │
│  ┌─────────┐ ┌─────────┐ ┌───────────────────┐  │
│  │TitleBar │ │Sidebar  │ │   Main Content     │  │
│  └─────────┘ │ Tabs    │ │ ┌───────────────┐  │  │
│              │ Marks   │ │ │  AddressBar    │  │  │
│              │ History │ │ ├───────────────┤  │  │
│              │Downloads│ │ │  BookmarksBar  │  │  │
│              │Passwords│ │ ├───────────────┤  │  │
│              │ Crypto  │ │ │  WebContent /  │  │  │
│              │ VPN     │ │ │  NewTabPage    │  │  │
│              │Autofill │ │ │                │  │  │
│              │ Notifs  │ │ │                │  │  │
│              │ Perf    │ │ │                │  │  │
│              │Shortcuts│ │ │                │  │  │
│              │ Settings│ │ │                │  │  │
│              └─────────┘ │ └───────────────┘  │  │
│                          │ ┌───────────────┐  │  │
│                          │ │ExtensionPanel │  │  │
│                          │ │ (iframe/webview)│ │  │
│                          │ └───────────────┘  │  │
│                          └───────────────────┘│  │
│  ┌────────────────────────────────────────────┐  │
│  │          Zustand Store (browserStore)       │  │
│  │  tabs | settings | bookmarks | extensions   │  │
│  │  vpn | autofill | shortcuts | pip | notifs   │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 3.1 Main Process

The Electron main process handles:

- **Window management** — Frameless window with custom title bar controls
- **Ad/tracker blocking** — Session-level request interception via `webRequest.onBeforeRequest`
- **Data persistence** — Bookmarks, history, pinned tabs, settings, passwords, autofill, notification permissions, and keyboard shortcuts stored in the user data directory
- **VPN/Proxy management** — Set, clear, and query proxy configuration via `session.setProxy()` with SOCKS5/SOCKS4/HTTP/HTTPS support and authentication
- **Extension loading** — Reads extension manifests and source code from the `extensions/` directory
- **Extension network API** — CORS-free HTTP fetching for extensions via `Flip.net.fetch` (proxied through main process with SSRF protection) and file saving to Downloads via `Flip.net.saveFile`
- **Download tracking** — Monitors `will-download` events with progress updates sent to the renderer in real time; also registers extension-originated file saves with source attribution
- **Performance metrics** — Exposes `app.getAppMetrics()` and `process.memoryUsage()` for real-time resource monitoring
- **Import/Export** — Native file dialogs for importing Chrome/Firefox bookmarks (HTML/JSON) and passwords (CSV), and exporting Flip data
- **Content Security Policy** — Enforces strict CSP headers on production builds (`object-src 'none'`, restricted `default-src`)
- **AI assistant** — Multi-provider LLM integration (Ollama, LM Studio, OpenAI, custom) with streaming responses, multi-round tool calling, and 20+ browser action tools
- **License validation** — One-time license key activation on first launch, validated against a remote API
- **Extension marketplace** — Remote extension catalog with one-click install/uninstall from a hosted package server
- **IPC bridge** — Exposes a secure `flipAPI` to the renderer via `contextBridge`

### 3.2 Renderer Process

The renderer is a single-page React application that manages:

- **Tab state** — Multiple tabs with URL, title, favicon, loading state, pinning, and suspension
- **Navigation** — Address bar with URL parsing, search integration, reading mode toggle, picture-in-picture toggle, and loading indicators
- **Sidebar** — Collapsible panel with tabs, bookmarks, history, downloads, passwords, crypto tracker, VPN, autofill, notifications, performance, shortcuts, and settings
- **Bookmarks bar** — Horizontal bar below the address bar showing bookmarked pages with favicons
- **Extension panel** — Side panel rendering React extensions in sandboxed iframes or Electron webviews
- **Command palette** — Quick-access overlay for browser actions (Ctrl+K)

### 3.3 State Management

All application state flows through a single Zustand store (`browserStore.js`):

| State Slice | Contents |
|------------|----------|
| `tabs` | Array of tab objects (id, url, title, favicon, loading, pinned, suspended, lastActive) |
| `activeTabId` | Currently focused tab |
| `settings` | User preferences (search engine, homepage, ad blocker, tracking protection, wallpaper, tab suspension, bookmarks bar) |
| `bookmarks` | Saved bookmarks array |
| `history` | Browsing history entries |
| `downloads` | Active and completed download objects |
| `extensions` | Loaded extension objects with manifest and source |
| `readingMode` | Reading mode toggle state |
| `sidebarOpen` | Sidebar visibility toggle |
| `sidebarView` | Active sidebar panel (tabs, bookmarks, history, downloads, passwords, crypto, vpn, autofill, notifications, performance, shortcuts, extensions, settings) |
| `vpn` | VPN/Proxy connection state (active, type, host, port, credentials, IP, status) |
| `autofill` | Saved addresses and payment methods |
| `notificationPerms` | Per-domain notification permission map |
| `shortcuts` | Customizable keyboard shortcut bindings |
| `pipActive` | Picture-in-Picture active state |

---

## 4. Privacy & Security

### 4.1 Built-in Ad & Tracker Blocking

Flip blocks requests to known advertising and tracking domains at the network level:

- **Domain-based blocking** — Requests matching domains like `doubleclick.net`, `google-analytics.com`, `facebook.com/tr`, and others are cancelled before they execute
- **Header sanitization** — Tracking headers (`X-Client-Data`) and third-party cookies on cross-origin requests are stripped
- **Real-time counter** — Users see a live count of blocked requests on the new tab page

### 4.2 Context Isolation

The renderer process runs with:

- `nodeIntegration: false` — No direct Node.js access from web content
- `contextIsolation: true` — The preload script runs in an isolated context
- `contextBridge` — Only explicitly exposed APIs are available to the renderer

### 4.3 HTTPS-Only Mode

All HTTP requests are automatically upgraded to HTTPS at the session level:

- Transparent `http://` → `https://` redirect before the request leaves the browser
- Localhost and `.local` addresses are exempt for development workflows
- Togglable from Settings (enabled by default)

### 4.4 DNS-over-HTTPS (DoH)

DNS queries are encrypted to prevent ISP snooping and DNS-based censorship:

- Uses Cloudflare's DoH resolver (`https://cloudflare-dns.com/dns-query`)
- Enabled at the Chromium level via command-line switches — always active, cannot be downgraded
- Prevents DNS poisoning and man-in-the-middle attacks on name resolution

### 4.5 Fingerprint Protection

Flip injects anti-fingerprinting countermeasures into every loaded page:

- **Canvas fingerprinting** — Adds subtle pixel noise to `toDataURL()` and `toBlob()` outputs, making canvas hashes unique per session
- **WebGL fingerprinting** — Spoofs `UNMASKED_VENDOR_WEBGL` and `UNMASKED_RENDERER_WEBGL` to return `"Generic GPU"`
- **AudioContext fingerprinting** — Intercepts oscillator connections to prevent audio-based identification
- **Navigator spoofing** — Normalizes `hardwareConcurrency` (4), `deviceMemory` (8), and `platform` ("Win32") to reduce fingerprint entropy
- Togglable from Settings (enabled by default)

### 4.6 Permission Request Handler

Sensitive browser permissions are denied by default:

- **Auto-allowed:** Clipboard read/write, notifications
- **Auto-denied:** Camera, microphone, geolocation, MIDI, screen capture
- Denied permissions are logged to the console for developer visibility
- Prevents sites from silently accessing hardware without explicit user consent

### 4.7 Extension Sandboxing

React extensions run inside sandboxed iframes with restricted permissions:

- `sandbox="allow-scripts allow-popups allow-forms"` — no `allow-same-origin`, preventing extensions from accessing parent window context
- `allow="autoplay"` — enables audio playback for media extensions
- **Content Security Policy** — `default-src 'none'` with explicit allowlists for scripts, styles, images, fonts, media, and connections
- Extensions communicate with the browser exclusively through `postMessage`
- Storage is namespaced per extension (`flip-ext-{id}-{key}`)
- Extensions declare required permissions in their manifest
- **Rate limiting** — API calls are throttled per extension to prevent abuse
- **Input sanitization** — All payloads from extensions are sanitized before processing

### 4.8 SSRF Protection

The extension network API (`Flip.net.fetch`) includes server-side request forgery (SSRF) protection:

- **Blocked targets** — Requests to `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`, `.local`, and `.internal` are rejected before execution
- **Private IP ranges blocked** — `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x` (RFC 1918), `169.254.x.x` (link-local), and IPv6 private prefixes (`fc00:`, `fe80:`, `fd`)
- **Scheme validation** — Only `http://` and `https://` URLs are permitted
- Prevents malicious extensions from scanning internal networks or accessing local services

### 4.9 Tamper Protection

Multi-layer integrity verification prevents unauthorized modification of the packaged application:

- **Electron Fuses** — Compile-time flags that disable `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, `--inspect` debugging, and force loading from ASAR only
- **ASAR Integrity** — Embedded hash validation of the ASAR archive, enabled via the `EnableEmbeddedAsarIntegrityValidation` fuse
- **Runtime Integrity** — SHA-256 hashes of `main.js`, `preload.js`, and all extension manifests are computed at build time (`integrity.json`) and verified on every launch; tampered files abort the application immediately
- **Build pipeline** — Integrity hashes are generated before packaging, and fuses are flipped in the `afterPack` hook

### 4.10 Encrypted Password Storage

Credentials are encrypted at rest using OS-native encryption:

- **Windows** — DPAPI (Data Protection API)
- **macOS** — Keychain
- **Linux** — libsecret / gnome-keyring
- Automatic migration from plaintext to encrypted format on first read

---

## 5. React Extension System

### 5.1 Overview

Flip's extension system is fundamentally different from traditional browser extensions. Instead of background scripts, content scripts, and popup HTML, Flip extensions are **single-file React applications** that run in the browser's sidebar panel.

### 5.2 Extension Structure

```
my-extension/
├── manifest.json     # Extension metadata and permissions
└── App.jsx           # React component (entry point)
```

**manifest.json:**
```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "A Flip Browser extension",
  "author": "Developer Name",
  "type": "sidebar",
  "main": "App.jsx",
  "permissions": ["tabs", "storage"]
}
```

### 5.3 Flip Extension SDK

Extensions access browser functionality through the global `Flip` object:

| API | Methods |
|-----|---------|
| `Flip.tabs` | `getAll()`, `getActive()`, `create(url)`, `navigate(tabId, url)`, `close(tabId)` |
| `Flip.storage` | `get(key)`, `set(key, value)`, `crossGet(targetExtId, key)`, `crossSet(targetExtId, key, value)` |
| `Flip.ui` | `showNotification(message, type)`, `setBadge(text)` |
| `Flip.music` | `pickFolder()` |
| `Flip.ai` | `getConfig()`, `saveConfig(config)`, `isAvailable()`, `listModels()`, `chat(data)`, `stop()` |
| `Flip.net` | `fetch(url, options)`, `saveFile(base64, filename, source)` |
| `Flip.browser` | `getInfo()` |

All SDK methods return Promises and communicate with the main browser process via `postMessage`.

### 5.4 Runtime Environment

Extensions are rendered inside an iframe that provides:

- **React 18** and **ReactDOM 18** (loaded from CDN)
- **Babel Standalone** for JSX transpilation at runtime
- Pre-styled base CSS matching the Flip design language (dark theme, Inter font, styled inputs/buttons/cards)

### 5.5 Full-Tab Extension Mode

Extensions can be opened in a full browser tab instead of the sidebar panel:

- **`flip://ext/{extensionId}` URLs** — Navigate to this internal URL to render any extension in the full content area
- **Open in Tab button** — An expand icon in the extension panel header launches the extension in a new full tab
- **Dynamic canvas resizing** — Extensions like Meme Generator and Screenshot Annotator detect their container width and scale canvases accordingly
- **Same SDK** — Extensions running in full-tab mode use the same Flip SDK and permissions as sidebar mode

### 5.6 Toolbar Actions

Extensions can declare a `toolbar_action` in their manifest to appear in the address bar's "More Tools" dropdown:

```json
{
  "toolbar_action": { "label": "JSON Formatter" }
}
```

- When the user clicks the toolbar action, the extension panel opens and the extension is activated
- Toolbar actions only appear for enabled extensions
- Provides a quick-access path to developer tools and utilities without navigating the extension manager

### 5.7 Music Permission & Custom Protocol

The Music Player extension demonstrates an advanced extension capability — native audio playback:

- **`music` permission** — Extensions requesting the `music` permission can open a native OS folder picker dialog via `Flip.music.pickFolder()`
- **`flip-music://` custom protocol** — Registered at startup via `protocol.registerSchemesAsPrivileged` with `stream: true` and `bypassCSP: true`. Serves audio files directly from the user-selected folder with correct MIME types and CORS headers
- **Security** — The protocol handler validates that every requested file resides within the user-approved folder (case-insensitive path comparison for Windows). The allowed folder path is persisted to disk so it survives restarts
- **Web Audio API integration** — Extensions can connect the Audio element to an `AnalyserNode` via `createMediaElementSource()` for real-time frequency analysis, enabled by `crossOrigin: 'anonymous'` and `Access-Control-Allow-Origin: *` on protocol responses

### 5.8 Included Extensions

| Extension | Type | Description |
|-----------|------|-------------|
| **Community Chat** | Webview | Community chat room hosted on Hostinger |
| **AI Chat** | Marketplace | Browser-integrated AI assistant with 24 browser tools (see Section 7) |
| **Weather Widget** | Bundled | Animated SVG weather scenes (sun, clouds, rain, snow, thunder, fog), gradient hero card, 3-day forecast, stat cards (humidity, wind, visibility, UV, pressure, cloud cover), city search overlay, °C/°F toggle. Data sourced from wttr.in (free, no API key) via `Flip.net.fetch` |
| **Quick Notes** | Bundled | Persistent note-taking with categories, completion tracking, and color coding |
| **Music Player** | Bundled | Local audio playback with folder picker, playback controls (shuffle, repeat, seek, volume), and real-time audio-reactive wave visualizer using Web Audio API frequency analysis |
| **Flip Share** | Marketplace | Peer-to-peer file sharing via PeerJS WebRTC DataChannels. Room code generation and connection, drag-and-drop and file picker support, chunked transfer with real-time progress bar and speed indicator, transfer history persisted in `Flip.storage`. Received files auto-save to Downloads folder via `Flip.net.saveFile` and appear in the browser's Downloads panel with source attribution |
| **Flip Call** | Marketplace | WebRTC video and voice calling with room codes, public STUN servers, camera/microphone toggle, and full-screen mode |
| **Screenshot Annotator** | Marketplace | Capture screenshots and annotate with drawing tools, text, arrows, and shapes. Supports undo/redo, color picker, and export to PNG |
| **Meme Generator** | Marketplace | Create memes from popular templates or custom images. Text overlay with drag positioning, font size control, and canvas export. Dynamic canvas resizing in full-tab mode |
| **JSON Formatter** | Bundled | Paste JSON to format, validate, and explore with syntax highlighting, minify, and structure stats |
| **Color Picker** | Bundled | Pick colors and convert between HEX, RGB, and HSL with sliders, copy-to-clipboard, and saved palette |
| **Regex Tester** | Bundled | Live regex testing with match highlighting, capture group extraction, and flag toggles |
| **Mimo Messenger** | Webview | Embedded webview of mimo.works messaging platform |
| **FlipPRX Game** | Bundled | Retro arcade game with custom icon |
| **FlipPRX Miner** | Marketplace | Browser-integrated crypto mining simulator |

---

## 6. Webview Extensions

### 6.1 The Problem

Many web applications set `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` headers that prevent embedding in iframes. This makes it impossible to embed services like messaging platforms, social media, or productivity tools as traditional iframe-based extensions.

### 6.2 The Solution

Flip introduces `content_type: "webview"` extensions that use Electron's `<webview>` tag instead of iframes:

```json
{
  "content_type": "webview",
  "url": "https://example.com"
}
```

Webview extensions:

- **Bypass X-Frame-Options** — Electron's webview runs in a separate renderer process
- **Render as mobile** — A mobile user-agent is injected so web apps display their responsive/phone layout in the narrow sidebar panel
- **Full web capabilities** — Login sessions, cookies, camera/microphone access, notifications, and clipboard all work natively
- **Isolation** — Each webview has its own session, preventing cross-extension data leakage

---

## 7. Flip AI Assistant

### 7.1 Overview

Flip AI is a native, browser-integrated AI assistant that lives in the sidebar panel. Unlike bolt-on AI chatbots, Flip AI has deep access to the browser's state — it can read pages, manage tabs, search the web, extract data, and perform browser actions on behalf of the user, all through natural language.

Flip AI is implemented as a marketplace extension (`ai-chat`) that communicates with the Electron main process through the Flip Extension SDK's `Flip.ai` API. The main process handles LLM communication, tool execution, and streaming.

### 7.2 Multi-Provider Support

Flip AI supports multiple LLM backends, configurable through a setup wizard:

| Provider | Endpoint | API Key Required |
|----------|----------|-----------------|
| **Ollama** (Local) | `http://localhost:11434` | No |
| **LM Studio** (Local) | `http://localhost:1234` | No |
| **OpenAI** | `https://api.openai.com` | Yes |
| **Custom Endpoint** | User-defined | Optional |

- **Model discovery** — Automatically fetches available models from the configured provider (Ollama `/api/tags`, OpenAI-compatible `/v1/models`)
- **Dynamic switching** — Users can switch between providers and models at any time from the settings panel
- **Encrypted config** — Provider, endpoint, API key, and selected model are stored in an encrypted config file using Electron's `safeStorage`

### 7.3 Browser Tools

Flip AI uses OpenAI-compatible function calling to execute browser actions. The AI decides which tools to invoke based on the user's request, executes them via IPC to the main process, and incorporates the results into its response.

| Tool | Description |
|------|-------------|
| `get_page_content` | Read the full text content of the active page |
| `get_page_title` | Get the title, URL, and favicon of the active page |
| `get_page_metadata` | Extract meta tags, headings (h1-h3), links, and image sources |
| `get_selected_text` | Read user-highlighted text on the page |
| `get_all_tabs` | List all open tabs with id, title, URL, and pinned status |
| `create_tab` | Open a new tab with a given URL |
| `close_tab` | Close a tab by its ID |
| `navigate_tab` | Navigate the active tab to a new URL |
| `search_web` | Search DuckDuckGo and return top results with titles, URLs, and snippets |
| `open_url` | Open any URL in a new tab |
| `fetch_url_content` | Fetch and read the text content of any URL (first 10,000 characters) |
| `get_browsing_history` | Retrieve recent browsing history |
| `get_bookmarks` | List all saved bookmarks |
| `add_bookmark` | Bookmark the current page |
| `toggle_reading_mode` | Toggle reading mode on the active page |
| `take_screenshot` | Capture the visible page area as PNG |
| `pin_tab` | Pin or unpin a tab |
| `duplicate_tab` | Duplicate a tab by its ID |
| `switch_tab` | Switch to a specific tab by ID |
| `close_other_tabs` | Close all tabs except the specified one |
| `find_in_page` | Search for text on the current page (like Ctrl+F) |
| `extract_page_data` | Extract structured data from the page (emails, phone numbers, prices, social links) |
| `get_page_tables` | Read HTML tables as structured JSON data |
| `inject_page_css` | Inject custom CSS to restyle the active page |

### 7.4 Streaming & Multi-Round Tool Calling

- **Token streaming** — Responses are streamed token-by-token to the UI via IPC events (`ai-stream-token`, `ai-stream-done`), providing real-time feedback
- **Multi-round tool calls** — The AI can chain multiple tool calls in sequence (up to 10 rounds), using the output of one tool to inform the next
- **Abort control** — Users can stop generation mid-stream via an AbortController
- **Markdown rendering** — AI responses are rendered with full markdown support (headings, bold, italic, code blocks, inline code, lists, links, horizontal rules)

### 7.5 Quick Actions

Pre-built prompts for common tasks, accessible from the chat welcome screen:

- **Summarize page** — Read and condense the current page
- **Explain page** — Simplify the current page content
- **Key points** — Extract the main takeaways
- **Organize tabs** — Analyze open tabs and suggest logical groupings
- **Translate page** — Translate the current page into English

### 7.6 Context Menu & Address Bar Integration

- **Right-click → Ask Flip AI** — Send selected text or page context to the AI from the context menu
- **Address bar prompt** — Trigger AI prompts from the address bar
- Events are dispatched to the AI extension via `flip-ai-prompt` custom events

---

## 8. Extension Marketplace

### 8.1 Overview

Flip includes a built-in extension marketplace that allows users to discover, install, and manage extensions from a remote catalog. Extensions are hosted as flat file packages on a remote server and downloaded on demand.

### 8.2 Architecture

```
┌─────────────────────────────────────────┐
│           Marketplace Server             │
│  (Hostinger static hosting)              │
│                                          │
│  marketplace.json      ← catalog index   │
│  ai-chat/                                │
│    ├── manifest.json                     │
│    └── App.jsx                           │
│  community-chat/                         │
│    ├── manifest.json                     │
│    └── App.jsx                           │
│  ...                                     │
└─────────────────────────────────────────┘
         │
         │ HTTPS fetch
         ▼
┌─────────────────────────────────────────┐
│        Electron Main Process             │
│  marketplace-catalog → fetch catalog     │
│  install-extension → download files      │
│  uninstall-extension → rm directory      │
└─────────────────────────────────────────┘
         │
         │ IPC
         ▼
┌─────────────────────────────────────────┐
│        Renderer (Extension Manager)      │
│  Browse catalog, install, uninstall,     │
│  toggle extensions on/off                │
└─────────────────────────────────────────┘
```

### 8.3 Extension Lifecycle

1. **Discovery** — The renderer fetches `marketplace.json` via the `marketplace-catalog` IPC handler, displaying available extensions with name, description, author, and icon
2. **Installation** — User clicks "Install"; the main process downloads `manifest.json` and `App.jsx` (plus icon if specified) to `{dataDir}/installed-extensions/{id}/`
3. **Loading** — On browser launch, both bundled (`extensions/`) and installed (`installed-extensions/`) extensions are loaded and merged; user toggle states are preserved
4. **Uninstallation** — Removes the extension directory; bundled extensions cannot be uninstalled

### 8.4 Security

- Extension IDs are validated against `^[a-zA-Z0-9_-]+$` to prevent path traversal
- Downloads use HTTPS with an 8-second timeout
- Installed extensions run in the same sandboxed iframe environment as bundled extensions
- All marketplace extensions must declare permissions in their manifest

---

## 9. Built-in Features

### 9.1 Crypto Tracker

A built-in cryptocurrency dashboard in the sidebar showing the top 10 coins by market cap:

- Data sourced from the **CoinGecko API** (free tier, no key required)
- Displays rank, logo, name, symbol, price, market cap, and 24-hour change
- Auto-refreshes every 60 seconds with manual refresh option
- Color-coded price changes (green for gains, red for losses)

### 9.2 Command Palette

A keyboard-driven command interface (Ctrl+K) for quick actions:

- Search through open tabs, bookmarks, and history
- Navigate to URLs directly
- Execute browser actions (new tab, close tab, toggle sidebar)
- Fuzzy matching for fast discovery

### 9.3 Split View

Side-by-side tab rendering for multitasking — view two web pages simultaneously within the same window.

### 9.4 Bookmark & History Management

- **Bookmarks** — Star any page, organized in a searchable sidebar list with favicons
- **Bookmarks bar** — Horizontal quick-access bar below the address bar displaying up to 20 bookmarked pages with favicons and truncated titles
- **History** — Automatic browsing history with timestamps, grouped by date, with full-text search across titles and URLs

### 9.5 Download Manager

A sidebar download tracker with real-time progress:

- Captures all file downloads via Electron's `will-download` session event
- Displays filename, progress bar with percentage, and download state
- Tracks completed, failed, and in-progress downloads
- Timestamps for each download start
- **Extension file saves** — Files saved by extensions via `Flip.net.saveFile` are registered in the Downloads panel with a **source label** (e.g., "via Flip Share") so users can identify which extension originated the download

### 9.6 Password Manager

Encrypted credential storage accessible from the sidebar:

- Add, reveal, copy, and delete saved credentials (site, username, password)
- Encrypted at rest using Electron's `safeStorage` API (DPAPI on Windows, Keychain on macOS, libsecret on Linux)
- Automatic migration from plaintext to encrypted format on first read
- Quick copy-to-clipboard for usernames and passwords

### 9.7 Reading Mode

A distraction-free reading experience toggled from the address bar:

- Strips navigation, sidebars, ads, footers, comment sections, and cookie banners
- Applies clean serif typography (Georgia, 18px, 1.8 line-height) on a dark background
- Constrains content to a readable 680px column
- Preserves images, code blocks, and blockquotes with styled formatting
- Injected via `webview.insertCSS()` — reversible on toggle-off

### 9.8 Tab Pinning

- Pin important tabs to keep them persistently open
- Pinned tabs are excluded from auto-suspension
- Pinned tab state persists across browser restarts via JSON storage

### 9.9 Tab Suspension

Automatic memory management for inactive tabs:

- Tabs inactive beyond a configurable timeout (default: 5 minutes) are automatically suspended
- Pinned tabs and the new tab page are never suspended
- Suspended tabs display a restore prompt and free memory until reactivated
- Checks run every 30 seconds

### 9.10 Custom New Tab Wallpapers

- Five curated wallpaper presets (Mountains, Ocean, Forest, City, Aurora) from Unsplash
- Custom URL input for any image
- Dark overlay for text readability over wallpaper backgrounds
- Default gradient orb animation when no wallpaper is selected

### 9.11 Built-in VPN / Proxy

Browser-level proxy routing via Electron's `session.setProxy()` API:

- **Protocol support** — SOCKS5, SOCKS4, HTTP, and HTTPS proxies
- **Proxy authentication** — Optional username/password credentials injected via request headers
- **Connection status** — Real-time connected/disconnected indicator with external IP display via `api.ipify.org`
- **Custom configuration** — Users enter their own proxy server details (host, port, protocol, auth)
- **IP verification** — Check your current external IP through the proxy to confirm routing
- **Session-level routing** — All browser traffic (including webview content) passes through the configured proxy

### 9.12 Autofill Manager

Encrypted storage for addresses and payment methods:

- **Addresses** — Save name, street, city, state, ZIP, country, phone, and email
- **Payment methods** — Save card label, number (masked to last 4 digits), expiry, and cardholder name
- **Encrypted storage** — Data encrypted at rest using Electron's `safeStorage` API (DPAPI/Keychain/libsecret)
- **CRUD operations** — Add and delete entries with immediate persistence

### 9.13 Web Notifications Manager

Per-site notification permission control:

- **Domain-level permissions** — Allow or block notifications per domain
- **Permission toggle** — Switch between allow/block for any saved domain
- **Clear all** — Reset all notification permissions at once
- **Persistent storage** — Permissions saved to disk and restored on launch

### 9.14 Performance Dashboard

Real-time resource monitoring for all Electron processes:

- **Summary cards** — Total memory usage, CPU %, open tab count, and active process count
- **Process list** — Per-process breakdown showing type (Browser, GPU, Renderer, Utility), memory, and CPU usage
- **Auto-refresh** — Metrics refresh every 3 seconds with manual refresh option
- **Color-coded indicators** — Process types distinguished by colored dots

### 9.15 Import / Export

Data portability for bookmarks and passwords:

- **Import bookmarks** — Chrome/Firefox HTML bookmark exports (Netscape format) and JSON files
- **Export bookmarks** — Save all bookmarks as a JSON file via native save dialog
- **Import passwords** — Chrome/Firefox CSV password exports (auto-detects column layout)
- **Export passwords** — Save all passwords as a CSV file
- **Merge behavior** — Imported data is merged with existing entries (no duplicates overwritten)

### 9.16 Keyboard Shortcut Customization

13 rebindable keyboard shortcuts:

| Action | Default Binding |
|--------|----------------|
| New Tab | `Ctrl+T` |
| Close Tab | `Ctrl+W` |
| Reopen Closed Tab | `Ctrl+Shift+T` |
| Command Palette | `Ctrl+K` |
| Focus Address Bar | `Ctrl+L` |
| Toggle Sidebar | `Ctrl+B` |
| Split View | `Ctrl+Shift+S` |
| Developer Tools | `F12` |
| Reload Page | `Ctrl+R` |
| Zoom In / Out / Reset | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` |
| Picture-in-Picture | `Ctrl+Shift+P` |

- **Record mode** — Click any shortcut, then press your desired key combination to rebind
- **Reset to defaults** — One-click restore of all default bindings
- **Persistent** — Custom shortcuts saved to disk and restored on launch

### 9.17 Picture-in-Picture

Floating video player for multitasking:

- **One-click PiP** — Button in the address bar triggers `requestPictureInPicture()` on the active tab's first `<video>` element
- **OS-native window** — Video pops into a floating always-on-top window managed by the operating system
- **Toggle behavior** — Click again to exit PiP and return the video to the page
- **Works everywhere** — Supports any page with HTML5 video (YouTube, Twitch, etc.)

### 9.18 Developer Dashboard

Full-page developer tools accessible at `flip://devtools`:

- **Extension management** — View, create, and manage React extensions
- **Side-by-side editor** — Manifest JSON viewer alongside code editor for extension development
- **Quick access** — Available via Command Palette or address bar navigation

### 9.19 OTA Auto-Update System

Over-the-air updates delivered from a custom server via `electron-updater`:

- **Generic server provider** — Update files hosted on your own server (S3, VPS, CDN, etc.)
- **Background check** — Browser checks for updates 5 seconds after launch and every 30 minutes thereafter
- **User-controlled download** — A floating notification banner appears when an update is available; the user chooses when to download
- **Progress tracking** — Real-time download progress bar with percentage
- **One-click install** — "Restart Now" button quits the app, installs the update, and relaunches automatically
- **Dismiss & defer** — Users can dismiss the banner and update later; the update will install on next quit
- **Production only** — Update checks are skipped in development mode

**Publishing workflow:**
```bash
# 1. Bump version in package.json
# 2. Build + upload:
npm run publish
# → Builds the app and uploads installer + latest.yml to your update server
# → Every installed copy of Flip auto-detects and offers the update
```

**Server structure:**
```
https://peru-grasshopper-236853.hostingersite.com/
├── latest.yml                  # Version manifest (auto-generated)
├── Flip Browser Setup 1.2.0.exe   # Windows installer
├── Flip Browser-1.2.0.dmg         # macOS installer
└── Flip Browser-1.2.0.AppImage    # Linux installer
```

### 9.20 User Profiles

Multiple isolated browser profiles, each with separate data:

- **Profile creation** — Create named profiles with dedicated data directories
- **Profile switching** — Switch between profiles; bookmarks, history, passwords, and settings reload instantly
- **Profile deletion** — Remove non-default, non-active profiles and their data
- **Data isolation** — Each profile stores its own bookmarks.json, history.json, passwords.json, settings.json, autofill.json, shortcuts.json, and notifications.json

### 9.21 Session Restore

Automatic session persistence across browser restarts:

- **Auto-save** — All open tabs (excluding pinned, split, and new-tab pages) are saved to `session.json` on every tab change
- **Auto-restore** — On launch, previously open tabs are restored before pinned tabs
- **Crash recovery** — Since session state is persisted on every change, tabs survive unexpected crashes

### 9.22 Reader View Improvements

Customizable reading mode with live-updating settings:

- **Font size** — Adjustable from 12px to 32px via slider
- **Font family** — Choose between Serif (Georgia), Sans (system-ui), or Mono (JetBrains Mono)
- **Theme presets** — Dark, Sepia, Light, Night backgrounds with matching text colors
- **Live preview** — Settings panel shows a live preview of the reading appearance
- **Persistent** — Reader settings are saved and restored across sessions

### 9.23 Site-Specific Settings

Per-domain configuration for granular control:

- **Per-site zoom** — Set zoom level (50%–200%) for individual domains
- **JavaScript toggle** — Enable/disable JavaScript per site
- **Cookie toggle** — Enable/disable cookies per site
- **Quick-add** — One-click button to add settings for the currently active site
- **Custom domains** — Manually add any domain

### 9.24 Screenshot Tool

Capture the visible page area and save as PNG:

- **Address bar button** — Camera icon in the toolbar captures the active webview
- **Save dialog** — Native OS save dialog with timestamped default filename
- **PNG output** — High-quality PNG image saved to user-chosen location

### 9.25 Translation

In-page translation bar powered by Google Translate:

- **12 languages** — English, Spanish, French, German, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Russian, Italian
- **Injected UI** — A styled translate bar appears at the top of the page with language picker and translate button
- **Non-destructive** — Dismissible bar; translates by redirecting through Google Translate proxy
- **Address bar button** — Languages icon in the toolbar triggers translation

### 9.26 Customizable Settings

- Search engine selection (DuckDuckGo, Bing, Brave, Yahoo, Ecosia)
- Homepage configuration
- Ad blocker toggle
- Tracking protection toggle
- Auto-suspend inactive tabs toggle and timeout
- Show/hide bookmarks bar
- New tab wallpaper selection
- Import/Export for bookmarks and passwords
- Language selection (English, Spanish)

---

## 10. User Interface

### 10.1 Design System

| Element | Specification |
|---------|---------------|
| **Primary color** | Coral/Orange (`#ff6234` → `#ff7a4d`) |
| **Accent color** | Teal (`#2dd4a8` → `#14b8a6`) |
| **Surface palette** | Warm darks (`#0c0a09` → `#1c1917`) |
| **Typography** | Inter (UI), JetBrains Mono (code) |
| **Border radius** | Pill-shaped elements (rounded-full/xl) |
| **Animations** | Flip-themed transitions, fade-ins, gradient shifts |

### 10.2 Layout

- **Title Bar** — Custom frameless bar with Flip logo, app name, and window controls (minimize, maximize, close)
- **Sidebar** — Collapsible left panel (280px) with icon navigation and content panels (tabs, bookmarks, history, downloads, passwords, crypto, VPN, autofill, notifications, performance, shortcuts, extensions, settings)
- **Address Bar** — Centered URL input with search integration, navigation controls, reading mode toggle, bookmark/split-view actions, and shield indicator showing blocked tracker count
- **Bookmarks Bar** — Optional horizontal bar below the address bar for quick bookmark access
- **Content Area** — Full-height web content renderer with new tab page and wallpaper support
- **Extension Panel** — Right-side panel (375–420px) for active extensions

### 10.3 New Tab Page

The new tab page features:

- Flip logo and branded hero section with greeting (Good morning/afternoon/evening)
- Live clock with time and date display
- **Daily motivational quote** — curated list of 60 inspirational quotes, one shown per day (rotated by day-of-year)
- Centered search bar with search engine integration
- Quick-access links with real favicons (Flip, CROAKWORKS, GitHub, Medium, X)
- **BBC World News feed** — 8 latest world headlines fetched from BBC RSS with thumbnails, timestamps, and deduplication; manual refresh button
- Customizable wallpaper backgrounds with dark overlay for readability
- Animated gradient orbs (default) or user-selected wallpaper
- Statistics dashboard (open tabs, bookmarks, blocked trackers)
- **Confetti celebration animation** — 150 colorful particles with physics-based animation on first launch after an update, auto-fades after 7 seconds
- **"Flip Browser is now complete!" banner** — celebration message shown in the What's New toast on update
- CROAKWORKS developer credit

---

## 11. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Electron 28+ (Chromium-based) |
| **UI Framework** | React 18 |
| **State Management** | Zustand 4 |
| **Styling** | Tailwind CSS 3.4 |
| **Build Tool** | Vite 5 |
| **Icons** | Lucide React |
| **Utilities** | clsx |
| **Packaging** | electron-builder 24 |
| **Extension Runtime** | Babel Standalone (JSX transpilation) |
| **AI Integration** | OpenAI-compatible API (Ollama, LM Studio, OpenAI, custom) |
| **Weather API** | wttr.in (free, no API key) |
| **News Feed** | BBC World News RSS |
| **P2P Communication** | PeerJS (WebRTC DataChannels) |
| **Crypto API** | CoinGecko (free tier) |
| **Download Portal** | Express.js, Vercel, PostgreSQL, EJS, Tailwind CSS |
| **License API** | REST endpoint on Vercel (JWT, bcrypt, rate-limited) |

---

## 12. Licensing & Distribution

### 12.1 License Activation

Flip Browser requires a one-time license key activation on first launch:

- **Invite-only distribution** — Download links are generated through the admin dashboard with configurable expiry times
- **License key generation** — Each download link includes a unique license key (format: `FLIP-XXXX-XXXX-XXXX-XXXX`)
- **Remote validation** — On first launch, the browser sends the license key to the validation API; valid keys are marked as used
- **Local persistence** — Once activated, the license state is saved locally in an encrypted file; no further network checks required
- **Graceful failure** — If the API is unreachable, a retry prompt is shown; the browser does not launch without activation

### 12.2 Download Portal

A dedicated web application for managing browser distribution:

- **Admin dashboard** — Secure login with JWT authentication, protected by rate limiting
- **Link management** — Create, view, and delete time-limited download links with unique tokens
- **License tracking** — View all issued license keys with activation status
- **Version management** — Current version and download URL displayed; auto-updated on each publish via API
- **Branded UI** — Flip Browser logo and CROAKWORKS footer on all pages
- **Tech stack** — Express.js on Vercel, PostgreSQL (Vercel Postgres), EJS templates, Tailwind CSS

### 12.3 Auto-Publish Pipeline

The publish workflow automatically syncs the download portal:

```bash
npm run publish
# 1. npm version patch
# 2. Update changelog.json with current version
# 3. Clean build folder
# 4. Generate integrity hashes
# 5. Vite build
# 6. electron-builder --publish always (uploads to Hostinger)
# 7. Restore output directory
# 8. POST /api/update-version → portal auto-updates version + download URL
```

The post-publish script sends a Bearer-authenticated request to the portal API with the new version and constructed download URL.

### 12.4 Development

```bash
npm install
npm run dev          # Starts Vite + Electron concurrently
```

### 12.5 Production Build

```bash
npm run build        # Vite build → electron-builder package
```

### 12.6 Platform Targets

| Platform | Format | Output |
|----------|--------|--------|
| **Windows** | NSIS Installer | `release/Flip Browser Setup *.exe` |
| **macOS** | DMG | `release/Flip Browser-*.dmg` |
| **Linux** | AppImage | `release/Flip Browser-*.AppImage` |

### 12.7 Project Structure

```
flip-browser/
├── electron/
│   ├── main.js              # Main process (AI, licensing, extensions, privacy)
│   ├── preload.js           # Context bridge (flipAPI)
│   └── integrity.json       # SHA-256 hashes for tamper detection
├── extensions/
│   ├── community-chat/      # Community Chat (webview)
│   ├── sample-weather/      # Weather widget extension
│   ├── sample-notes/        # Quick notes extension
│   ├── music-player/        # Music player extension
│   ├── mimo-messenger/      # Mimo webview extension
│   ├── flipprx-game/        # FlipPRX retro game
│   ├── json-formatter/      # JSON Formatter dev tool
│   ├── color-picker/        # Color Picker dev tool
│   └── regex-tester/        # Regex Tester dev tool
├── scripts/
│   ├── afterPack.js         # Electron Fuse flipping (post-build)
│   ├── clean-build.js       # Clean release folder before build
│   ├── generate-integrity.js # SHA-256 hash generation
│   ├── update-changelog.js  # Auto-stamp changelog with version
│   ├── restore-output.js    # Restore output dir after build
│   └── post-publish.js      # Auto-sync version to download portal
├── public/
│   ├── fliplogo.png         # App icon
│   └── favicon.ico          # Browser favicon
├── src/
│   ├── components/
│   │   ├── TitleBar.jsx
│   │   ├── Sidebar.jsx          # Tabs, Bookmarks, History, Downloads, Passwords, Crypto, VPN, Autofill, Notifications, Performance, Shortcuts, Settings views
│   │   ├── AddressBar.jsx       # Navigation, search, reading mode, PiP, bookmark toggle
│   │   ├── BookmarksBar.jsx     # Horizontal bookmarks bar below address bar
│   │   ├── WebContent.jsx       # Webview management, reading mode CSS injection, PiP handler
│   │   ├── NewTabPage.jsx       # Wallpaper support, quick links, stats
│   │   ├── CommandPalette.jsx
│   │   ├── FlipLogo.jsx
│   │   └── extensions/
│   │       ├── ExtensionHost.jsx  # Sandboxed iframe/webview host with SDK bridge
│   │       ├── ExtensionManager.jsx # Marketplace UI
│   │       └── ExtensionPanel.jsx
│   ├── store/
│   │   └── browserStore.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── changelog.json           # Version history (auto-stamped on publish)
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── WHITEPAPER.md
```

---

## 13. Roadmap

### Phase 1 — Foundation (Current)
- [x] Core browser functionality (tabs, navigation, history, bookmarks)
- [x] Privacy-first ad/tracker blocking with header sanitization
- [x] React extension system with SDK
- [x] Webview extension support
- [x] Built-in crypto tracker
- [x] Weather, Notes, and Messenger extensions
- [x] Command palette
- [x] Split view
- [x] Windows, macOS, and Linux packaging

### Phase 2 — Polish & UX (Current)
- [x] Custom new tab wallpapers (curated presets + custom URL)
- [x] Tab pinning with cross-session persistence
- [x] Download manager with real-time progress tracking
- [x] Bookmarks bar (horizontal quick-access below address bar)
- [x] Reading mode (strip page clutter, serif typography)
- [x] Full-text history search
- [x] Password manager (add, reveal, copy, delete credentials)
- [x] Tab suspension (auto-suspend inactive tabs to save memory)
- [x] Production Content Security Policy (strict CSP headers)
- [x] Settings persistence across sessions

### Phase 2b — Security Hardening
- [x] HTTPS-only mode (auto-upgrade HTTP → HTTPS)
- [x] DNS-over-HTTPS via Cloudflare (always active)
- [x] Fingerprint protection (canvas, WebGL, AudioContext, navigator spoofing)
- [x] Permission request handler (deny camera/mic/geolocation by default)
- [x] Encrypted password storage (Electron safeStorage — DPAPI/Keychain/libsecret)
- [x] Security & Privacy settings panel with toggles

### Phase 3 — Power Features (Current)
- [x] Built-in VPN/Proxy (SOCKS5/SOCKS4/HTTP/HTTPS via session.setProxy)
- [x] Autofill manager (encrypted addresses and payment methods)
- [x] Web notifications manager (per-site allow/block permissions)
- [x] Performance dashboard (memory, CPU, process list, auto-refresh)
- [x] Import/Export (bookmarks from Chrome/Firefox HTML, passwords from CSV)
- [x] Keyboard shortcut customization (13 rebindable actions with record mode)
- [x] Picture-in-Picture (floating video player via address bar toggle)
- [x] Developer Dashboard (full-page at flip://devtools)
- [x] Removed Google from search engines; DuckDuckGo is the default
- [x] Multi-language support (English, Spanish)
- [x] OTA auto-update system (electron-updater with generic server provider)

### Phase 3b — Usability & Productivity
- [x] User profiles (multiple profiles with separate bookmarks, history, passwords)
- [x] Tab search (search open tabs by title/URL in sidebar)
- [x] Session restore (auto-save and restore all tabs on restart/crash)
- [x] Reader view improvements (font size, serif/sans/mono toggle, 4 background themes)
- [x] Site-specific settings (per-site zoom, JavaScript toggle, cookie preferences)
- [x] Screenshot tool (capture visible page, save as PNG via dialog)
- [x] Translation (inject translate bar with 12 languages via Google Translate)

### Phase 3c — Credential Management & Automation
- [x] Auto-detect login forms and prompt to save credentials
- [x] Credential autofill on recognized sites
- [x] Permission request prompts for camera, mic, notifications (user-facing UI)
- [x] AES-256 encryption for all saved data (safeStorage + auto-migration from plaintext)
- [x] Scrollable tab strip in sidebar rail (no more hidden tabs)
- [x] Version number displayed in sidebar rail
- [x] FLIPPRX retro game extension with custom icon
- [x] Community Chat extension (webview, Hostinger-hosted)
- [x] Mimo Messenger extension (webview)
- [x] First-time extension defaults (only Community, Weather, Notes ON; others OFF)
- [x] Extension toggle state persistence across restarts

### Phase 3d — UI Polish & Developer Experience
- [x] Full UI polish pass (10 visual improvements across all surfaces)
- [x] Address bar overflow menu (PiP, Screenshot, Translate collapsed into ⋮ dropdown)
- [x] Sidebar panel headers with icon + gradient accent line
- [x] Staggered fade-in animations on tab cards, popups, and list items
- [x] Context menus with icons, dividers, and backdrop blur
- [x] Settings reorganized into grouped cards (Security, General, Wallpaper, Import/Export)
- [x] Polished empty states with icon placeholders (bookmarks, downloads, passwords)
- [x] Bookmarks bar auto-fetches favicons from DuckDuckGo with hover effects
- [x] More Tools popup with icon background cards and staggered entry animation
- [x] Tab favicon active indicator with scale + glow effect
- [x] Glass/blur effect on floating sidebar panels (backdrop-blur-2xl)
- [x] Changelog system (changelog.json with auto-version stamping on publish)
- [x] Release notes shown in update banner (expandable bullet list)
- [x] "What's new" toast on new tab page after app restart with a new version
- [x] Auto-versioned publish pipeline (npm run publish auto-bumps + stamps changelog)

### Phase 3e — Security Hardening & Media
- [x] Tamper protection: Electron Fuses (disable RunAsNode, NODE_OPTIONS, --inspect, force ASAR)
- [x] Runtime integrity verification (SHA-256 hash check of main.js, preload.js, extension manifests)
- [x] ASAR integrity validation fuse
- [x] Extension sandbox hardened (removed allow-same-origin, added rate limiting, input sanitization)
- [x] Manual "Check for Updates" button in Settings
- [x] Theme-matched scrollbar styling (CSS variables for thumb/hover across all themes)
- [x] Music Player extension (local folder playback, shuffle, repeat, seek, volume)
- [x] Custom `flip-music://` protocol for secure audio file streaming
- [x] Audio-reactive wave visualizer (Web Audio API AnalyserNode, mirrored frequency bars)
- [x] Robust build pipeline (clean-build.js handles locked files, restore-output.js)

### Phase 3f — Extension API v2 & Developer Tools
- [x] Toolbar actions: extensions declare `toolbar_action` in manifest, appear in address bar More Tools menu
- [x] Custom context menu on webview right-click (Back, Forward, Reload, Copy, Search, Select All, View Source, Inspect)
- [x] Extension items in context menu (quick-open enabled extensions with toolbar actions)
- [x] PWA detection (auto-detect web app manifests, show install-as-pinned-tab button in address bar)
- [x] WebRTC enhancements (PipeWire capturer flag, CPU consumption throttling)
- [x] JSON Formatter extension (format, minify, validate, syntax highlight, structure stats)
- [x] Color Picker extension (HEX/RGB/HSL conversion, sliders, saved palette, random color)
- [x] Regex Tester extension (live match highlighting, capture groups, flag toggles)

### Phase 4 — AI & Distribution
- [x] Flip AI assistant with multi-provider LLM support (Ollama, LM Studio, OpenAI, custom endpoints)
- [x] 24 browser action tools for AI (page reading, tab management, web search, data extraction, CSS injection)
- [x] Streaming responses with multi-round tool calling (up to 10 rounds)
- [x] AI quick actions (summarize, explain, key points, organize tabs, translate)
- [x] Context menu and address bar AI integration
- [x] Extension marketplace with remote catalog, one-click install/uninstall
- [x] Cross-extension storage API (`Flip.storage.crossGet/crossSet`)
- [x] License activation system (one-time key validation on first launch)
- [x] Download portal with admin dashboard (link management, license tracking, version control)
- [x] Auto-publish pipeline (portal version + download URL auto-sync on build)
- [x] Custom themes and color schemes (6 presets: Warm Coral, Ocean Blue, Midnight Purple, Forest Green, Rose Gold, Monochrome)
- [x] Tab groups and workspaces (manual named groups, collapsible, rename/delete, workspace save/load/delete)

### Phase 4b — Completion & P2P
- [x] Flip Share extension (P2P file sharing via PeerJS WebRTC DataChannels, room codes, chunked transfer, progress/speed)
- [x] Flip Call extension (WebRTC video/voice calling with room codes and STUN servers)
- [x] Screenshot Annotator extension (capture, draw, text, arrows, shapes, export PNG)
- [x] Meme Generator extension (templates, text overlay, canvas export, dynamic resizing in full-tab mode)
- [x] Extension full-tab mode (`flip://ext/{id}` URLs, Open in Tab button, dynamic canvas resizing)
- [x] `Flip.net.fetch` API (CORS-free fetching for extensions through main process with SSRF protection)
- [x] `Flip.net.saveFile` API (save files to Downloads folder from sandboxed extensions via IPC pipeline)
- [x] Extension downloads in sidebar Downloads panel with source attribution ("via Flip Share")
- [x] Weather Widget redesigned (animated SVG scenes, gradient hero, 3-day forecast, stat cards, no emojis, wttr.in API)
- [x] Daily motivational quotes on new tab page (60 curated quotes, one per day)
- [x] BBC World News RSS feed on new tab page (replaced NBC, deduplication)
- [x] SSRF protection on extension network API (block localhost, private IPs, link-local, IPv6 private)
- [x] Confetti celebration animation on update (canvas-based, 150 particles, 7s duration with fade-out)
- [x] Security: removed hardcoded API keys and TURN credentials from extensions

### Phase 5 — Enhancement
- [ ] Sync across devices (encrypted)
- [ ] Extension API v2 background tasks
- [ ] Mobile companion app

---

## 14. Conclusion

Flip Browser represents a new approach to web browsing — one where privacy is not negotiable, extensibility is not arcane, and the user interface is not a relic of a previous decade. By building on Electron and React, Flip makes the browser itself as hackable and composable as the web applications it renders.

We believe the browser should be a platform that works for its users, not against them. Flip is that platform.

---

**CROAKWORKS** — [croak.work](https://croak.work)

*Built with purpose. Browsed with confidence.*
