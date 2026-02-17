# OpenSentinel Desktop

**Status: IMPLEMENTED** (v2.7.0)

Electron-based desktop application for OpenSentinel - your personal AI assistant.

## Features

- **System Tray Integration**: Runs in the background with quick access from the system tray
- **Global Hotkey**: Press `Ctrl+Shift+M` (configurable) to open the quick input popup from anywhere
- **Quick Input Popup**: Spotlight-like floating window for quick questions
- **Full Chat Interface**: Complete chat UI with conversation history
- **Native Notifications**: Get notified when OpenSentinel responds
- **Auto-Start**: Optionally start OpenSentinel with your system
- **Minimize to Tray**: Close the window without quitting the app

## Requirements

- Node.js 18+ or Bun
- OpenSentinel server running (default: http://localhost:8030)

## Development Setup

1. Install dependencies:

```bash
cd desktop
npm install
# or
bun install
```

2. Start in development mode:

```bash
npm run dev
# or
bun run dev
```

This will:
- Start the TypeScript compiler in watch mode for the main process
- Start Vite dev server for the renderer process

3. In a separate terminal, start the Electron app:

```bash
npm run start
# or
bun run start
```

## Building for Production

### Build All

```bash
npm run build
```

### Build for Windows

```bash
npm run dist:win
```

Creates:
- `release/OpenSentinel Setup x.x.x.exe` - NSIS installer
- `release/OpenSentinel x.x.x.exe` - Portable executable

### Build for Linux

```bash
npm run dist:linux
```

Creates:
- `release/OpenSentinel-x.x.x.AppImage` - AppImage (portable)
- `release/opensentinel_x.x.x_amd64.deb` - Debian package

## Project Structure

```
desktop/
├── main.ts              # Main Electron process
├── preload.ts           # Preload script (IPC bridge)
├── tray.ts              # System tray functionality
├── shortcuts.ts         # Global keyboard shortcuts
├── autolaunch.ts        # Auto-start on system boot
├── renderer/
│   ├── index.html       # Main window HTML
│   ├── popup.html       # Quick input popup HTML
│   ├── main.tsx         # Main window React entry
│   ├── popup.tsx        # Popup React entry
│   ├── app.tsx          # Main app component
│   ├── styles.css       # Global styles
│   └── components/
│       ├── TitleBar.tsx # Custom title bar (Windows)
│       ├── Chat.tsx     # Chat interface
│       ├── Settings.tsx # Settings panel
│       └── QuickInput.tsx # Quick input popup
├── assets/
│   ├── icon.png         # App icon (256x256+)
│   ├── icon.ico         # Windows icon
│   ├── tray.png         # Linux tray icon (22x22)
│   └── tray.ico         # Windows tray icon (16x16)
├── package.json
├── tsconfig.json        # Renderer TypeScript config
├── tsconfig.main.json   # Main process TypeScript config
└── vite.config.ts       # Vite config for renderer
```

## Configuration

Settings are stored using electron-store:

- **Windows**: `%APPDATA%/opensentinel-desktop/config.json`
- **Linux**: `~/.config/opensentinel-desktop/config.json`

### Available Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `apiUrl` | `http://localhost:8030` | OpenSentinel API server URL |
| `autoLaunch` | `false` | Start with system |
| `minimizeToTray` | `true` | Minimize to tray instead of closing |
| `globalShortcut` | `CommandOrControl+Shift+M` | Quick input hotkey |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` | Open quick input popup |
| `Ctrl+Shift+O` | Show main window |
| `Escape` | Close quick input popup |
| `Enter` | Send message |
| `Shift+Enter` | New line in message |

## Icons

Before building, add your icon files to the `assets/` directory:

1. **icon.png** - Main application icon (256x256 or larger)
2. **icon.ico** - Windows icon (multi-resolution ICO file)
3. **tray.png** - Linux tray icon (22x22 pixels)
4. **tray.ico** - Windows tray icon (16x16 pixels)

You can use tools like:
- [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
- [png2ico](https://www.winterdrache.de/freeware/png2ico/)
- Online converters

## API Integration

The desktop app connects to the OpenSentinel API server. Make sure the server is running:

```bash
# From the main OpenSentinel directory
bun run start
```

The app uses these API endpoints:

- `GET /health` - Health check
- `GET /api/system/status` - System status
- `POST /api/chat/tools` - Chat with tool execution
- `POST /api/ask` - Quick question (used by popup)

## Troubleshooting

### App doesn't start

1. Check if OpenSentinel server is running
2. Verify the API URL in settings
3. Check the developer console (View > Toggle Developer Tools)

### Global shortcuts don't work

- Some shortcuts may conflict with other applications
- Try changing the shortcut in settings
- On Linux, you may need to run with elevated permissions for some shortcuts

### Tray icon doesn't appear

- On Linux, ensure you have a system tray available
- Some desktop environments require extensions for tray support

### Auto-start not working

- **Windows**: Check startup programs in Task Manager
- **Linux**: Check `~/.config/autostart/` for the .desktop file

## License

MIT
