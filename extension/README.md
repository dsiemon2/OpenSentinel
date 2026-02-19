# OpenSentinel Browser Extension

**Status: IMPLEMENTED** (v3.1.1)

A Chrome/Firefox browser extension for interacting with your OpenSentinel personal AI assistant.

## Features

- **Popup Chat Interface**: Chat with OpenSentinel directly from your browser toolbar
- **Page Summarization**: Summarize any webpage with one click
- **Data Extraction**: Extract structured data from web pages
- **Quick Capture**: Save pages to memory for future reference
- **Context Menu Integration**: Right-click selected text to ask OpenSentinel about it
- **Keyboard Shortcuts**: Quick access via customizable keyboard shortcuts

## Prerequisites

- A running OpenSentinel server (default: `http://localhost:8030`)
- Bun runtime installed (`curl -fsSL https://bun.sh/install | bash`)

## Installation

### Building the Extension

1. Navigate to the extension directory:
   ```bash
   cd extension
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Generate icons (requires ImageMagick):
   ```bash
   cd icons && ./create-icons.sh && cd ..
   ```

   Or manually create PNG icons at 16x16, 48x48, and 128x128 pixels named `icon16.png`, `icon48.png`, and `icon128.png`.

4. Build the extension:
   ```bash
   bun run build
   ```

   For Firefox:
   ```bash
   bun run build:firefox
   ```

### Loading in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked"
4. Select the `extension/dist` directory
5. The OpenSentinel icon should appear in your toolbar

### Loading in Firefox

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on"
4. Navigate to `extension/dist-firefox` and select `manifest.json`
5. The extension will be loaded (note: temporary add-ons are removed when Firefox closes)

For permanent installation in Firefox, you need to sign the extension through [addons.mozilla.org](https://addons.mozilla.org/).

## Configuration

1. Click the OpenSentinel icon in your toolbar
2. Click the settings (gear) icon
3. Enter your OpenSentinel server URL (default: `http://localhost:8030`)
4. Click "Save Settings"

The extension will automatically test the connection to your server.

## Usage

### Popup Chat

Click the OpenSentinel icon in your toolbar to open the chat popup. You can:
- Type messages directly to chat with OpenSentinel
- Use quick action buttons to summarize, extract data, or capture the current page

### Context Menu

1. Select text on any webpage
2. Right-click to open the context menu
3. Choose "Ask OpenSentinel about [selected text]"
4. The popup will open with your selection attached

You can also right-click anywhere on a page to:
- Summarize the page
- Extract data from the page
- Capture the page to memory

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+M` | Open OpenSentinel popup |
| `Alt+Shift+M` | Quick capture current page |
| `Alt+Shift+S` | Summarize current page |
| `Alt+Shift+E` | Extract data from page |

To customize shortcuts in Chrome, go to `chrome://extensions/shortcuts`.

## Development

### Project Structure

```
extension/
├── manifest.json       # Extension manifest (Manifest V3)
├── background.ts       # Service worker for background tasks
├── content.ts          # Content script for page interaction
├── popup/
│   ├── popup.html      # Popup HTML
│   ├── popup.tsx       # React popup component
│   └── popup.css       # Popup styles
├── options/
│   ├── options.html    # Options page HTML
│   └── options.tsx     # React options component
├── utils/
│   └── api.ts          # API client for OpenSentinel server
├── icons/
│   ├── icon.svg        # Source SVG icon
│   └── create-icons.sh # Script to generate PNG icons
└── scripts/
    └── firefox-manifest.js  # Generate Firefox-compatible manifest
```

### Development Mode

Run the build in watch mode:
```bash
bun run dev
```

After making changes, reload the extension in your browser:
- Chrome: Click the refresh icon on the extension card in `chrome://extensions/`
- Firefox: Click "Reload" next to the extension in `about:debugging`

### Type Checking

```bash
bun run typecheck
```

## Troubleshooting

### Extension can't connect to OpenSentinel

1. Ensure your OpenSentinel server is running on the configured URL
2. Check that the URL includes the correct port (default: 8030)
3. Verify there are no CORS issues - the OpenSentinel server should allow requests from the extension

### Icons not showing

Make sure you've generated the PNG icons:
```bash
cd icons && ./create-icons.sh
```

Or manually create icons at the required sizes.

### Keyboard shortcuts not working

1. Go to `chrome://extensions/shortcuts` (Chrome) or `about:addons` (Firefox)
2. Check if the shortcuts are assigned
3. Make sure no other extensions or applications are using the same shortcuts

## API Endpoints Used

The extension communicates with these OpenSentinel API endpoints:

- `POST /api/chat` - Send messages and receive responses
- `GET /api/health` - Check server connectivity
- `GET /api/chat/history` - Retrieve conversation history (optional)

## License

Part of the OpenSentinel project.
