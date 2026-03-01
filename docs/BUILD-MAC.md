# Building Flip Browser for macOS

## Prerequisites

1. **macOS** (any recent version — Ventura, Sonoma, Sequoia)
2. **Node.js 18+** — install via [nodejs.org](https://nodejs.org) or `brew install node`
3. **Git** — `xcode-select --install` (or `brew install git`)

## Steps

### 1. Clone or copy the project to the Mac

```bash
# Option A: clone from repo
git clone <your-repo-url> flip-browser
cd flip-browser

# Option B: copy the project folder via USB/AirDrop/etc.
cd /path/to/flip-browser
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build the macOS installer

```bash
npm run build:mac
```

This runs the full pipeline:
- Cleans the `release/` folder
- Generates integrity hashes for tamper protection
- Builds the React frontend with Vite
- Packages with electron-builder for macOS (DMG + ZIP)
- Flips Electron Fuses (disables RunAsNode, NODE_OPTIONS, --inspect)

### 4. Find the output

After a successful build, the installers are in:

```
release/
  Flip-Browser-1.2.18-mac-x64.dmg      # Disk image (drag to Applications)
  Flip-Browser-1.2.18-mac-x64.zip      # Portable ZIP
  Flip-Browser-1.2.18-mac-arm64.dmg    # Apple Silicon (if built on M1/M2/M3)
  Flip-Browser-1.2.18-mac-arm64.zip
```

> **Note:** The build produces the architecture matching the Mac you build on.
> Intel Mac → `x64` artifacts. Apple Silicon Mac → `arm64` artifacts.

### 5. (Optional) Build for both architectures

To build a universal binary (both Intel + Apple Silicon) on an Apple Silicon Mac:

```bash
npx electron-builder --mac --arch universal
```

Or build for a specific architecture:

```bash
# Intel only (on any Mac)
npx electron-builder --mac --arch x64

# Apple Silicon only (on Apple Silicon Mac)
npx electron-builder --mac --arch arm64
```

## Code Signing (Optional)

Without code signing, macOS will show a Gatekeeper warning ("unidentified developer"). Users can bypass via **System Settings > Privacy & Security > Open Anyway**.

To sign the app, you need an Apple Developer account ($99/year):

1. Get a **Developer ID Application** certificate from [developer.apple.com](https://developer.apple.com)
2. Install the certificate in Keychain Access
3. Set environment variables before building:

```bash
export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
npm run build:mac
```

electron-builder will automatically sign and notarize the app.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `gyp ERR! build error` | Run `xcode-select --install` to install build tools |
| `Error: Cannot create DMG` | Install `create-dmg`: `brew install create-dmg` |
| Gatekeeper blocks the app | Right-click > Open, or System Settings > Privacy > Open Anyway |
| `EACCES` permission errors | Don't use `sudo`. Fix npm permissions: `sudo chown -R $(whoami) ~/.npm` |
| Build hangs at "signing" | No certificate found — set `CSC_IDENTITY_AUTO_DISCOVERY=false` to skip signing |

## Quick Reference

```bash
# Full build (DMG + ZIP)
npm run build:mac

# Just package without cleaning (faster for testing)
npx vite build && npx electron-builder --mac --publish never

# Skip code signing entirely
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:mac
```
