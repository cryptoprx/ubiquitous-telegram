# Flip Browser

A blazing-fast, privacy-first web browser built with Electron + React, featuring a React-based extension system and a distinctive warm coral & teal design language.

## Features

### Core Browser
- **Chromium-based rendering** via Electron — full web compatibility
- **Cross-platform** — Windows and macOS support
- **Original frameless UI** with warm coral/teal accent design, glassmorphism, and flip animations

### Addressing Top Browser Complaints
- **Tab Overload** → Vertical sidebar tabs with search, pinning, grouping, and tab suspension
- **Privacy** → Built-in ad/tracker blocker, no telemetry, tracking header removal
- **Memory Hogging** → Automatic tab suspension for inactive tabs
- **Bloated UI** → Clean, minimal interface with collapsible sidebar
- **Slow Navigation** → Command Palette (Ctrl+K) for instant tab/bookmark/action search
- **No Split View** → Side-by-side browsing with split view

### React Extension System
Extensions are **React apps** that run sandboxed inside Flip Browser:
- Extensions are built with standard React (JSX)
- Each extension has a `manifest.json` + `App.jsx`
- Extensions run in sandboxed iframes with their own React instance
- Communication via the **Flip Extension API** (`window.Flip`)
- Permission-based access to tabs, storage, and UI

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Install & Run

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Build for Production

```bash
# Build and package
npm run build
```

## Project Structure

```
br/
├── electron/           # Electron main process
│   ├── main.js         # App entry, window management, ad blocker, IPC
│   └── preload.js      # Context bridge (flipAPI)
├── src/
│   ├── main.jsx        # React entry point
│   ├── index.css       # Global styles (Tailwind)
│   ├── App.jsx         # Root component
│   ├── store/
│   │   └── browserStore.js  # Zustand state management
│   └── components/
│       ├── TitleBar.jsx          # Custom title bar with Flip branding
│       ├── Sidebar.jsx           # Vertical tabs, bookmarks, history, settings
│       ├── AddressBar.jsx        # URL bar, navigation, security indicator
│       ├── WebContent.jsx        # Webview manager (multi-tab)
│       ├── CommandPalette.jsx    # Quick-action search (Ctrl+K)
│       ├── NewTabPage.jsx        # New tab dashboard with Flip identity
│       └── extensions/
│           ├── ExtensionManager.jsx  # Install/manage extensions
│           ├── ExtensionHost.jsx     # Sandboxed extension runtime
│           └── ExtensionPanel.jsx    # Extension sidebar panel
├── extensions/         # Installed extensions
│   ├── sample-weather/ # Weather widget demo extension
│   └── sample-notes/   # Notes app demo extension
└── package.json
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open Command Palette |
| `Ctrl+T` | New Tab |
| `Ctrl+W` | Close Tab |
| `Ctrl+L` | Focus Address Bar |

## Creating Extensions

### Extension Structure

```
my-extension/
├── manifest.json
└── App.jsx
```

### manifest.json

```json
{
  "name": "My Extension",
  "version": "1.0.0",
  "description": "What this extension does",
  "author": "Your Name",
  "type": "sidebar",
  "main": "App.jsx",
  "permissions": ["tabs", "storage"],
  "api_version": "1.0"
}
```

### App.jsx

```jsx
function App() {
  const [tabs, setTabs] = React.useState([]);

  React.useEffect(() => {
    // Use the Flip Extension API
    Flip.tabs.getAll().then(setTabs);
  }, []);

  return (
    <div>
      <h2>My Extension</h2>
      <p>Open tabs: {tabs.length}</p>
      <button onClick={() => Flip.tabs.create('https://example.com')}>
        Open Example
      </button>
    </div>
  );
}
```

### Flip Extension API

```js
// Tabs
Flip.tabs.getAll()              // Get all open tabs
Flip.tabs.getActive()           // Get active tab
Flip.tabs.create(url)           // Open new tab
Flip.tabs.close(tabId)          // Close a tab
Flip.tabs.navigate(tabId, url)  // Navigate a tab

// Storage (per-extension, persistent)
Flip.storage.get(key)           // Get stored value
Flip.storage.set(key, value)    // Store value

// UI
Flip.ui.showNotification(msg)   // Show notification
Flip.ui.setBadge(text)          // Set badge text
```

### Installing Extensions

1. Click the **Extensions** icon in the sidebar
2. Click **"Install Extension from Folder"**
3. Select the folder containing your `manifest.json`
4. The extension loads immediately

## Tech Stack

- **Electron 28** — Chromium rendering engine
- **React 18** — UI framework
- **Vite 5** — Build tool
- **TailwindCSS 3** — Styling (warm coral/teal design system)
- **Zustand** — State management
- **Lucide React** — Icons

## License

MIT
