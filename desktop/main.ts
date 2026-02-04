import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  Notification,
  shell,
} from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { createTray, destroyTray } from './tray';
import { registerShortcuts, unregisterShortcuts } from './shortcuts';
import { setupAutoLaunch } from './autolaunch';

// Store for app settings
interface StoreSchema {
  apiUrl: string;
  autoLaunch: boolean;
  minimizeToTray: boolean;
  showInTaskbar: boolean;
  globalShortcut: string;
  windowBounds: {
    x?: number;
    y?: number;
    width: number;
    height: number;
  };
  popupBounds: {
    x?: number;
    y?: number;
    width: number;
    height: number;
  };
}

const store = new Store<StoreSchema>({
  defaults: {
    apiUrl: 'http://localhost:8030',
    autoLaunch: false,
    minimizeToTray: true,
    showInTaskbar: true,
    globalShortcut: 'CommandOrControl+Shift+M',
    windowBounds: {
      width: 900,
      height: 700,
    },
    popupBounds: {
      width: 600,
      height: 80,
    },
  },
});

let mainWindow: BrowserWindow | null = null;
let popupWindow: BrowserWindow | null = null;
let isQuitting = false;

// Check if running in development
const isDev = !app.isPackaged;

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function getRendererPath(): string {
  if (isDev) {
    return 'http://localhost:5173';
  }
  return `file://${path.join(__dirname, 'renderer', 'index.html')}`;
}

function getPopupPath(): string {
  if (isDev) {
    return 'http://localhost:5173/popup.html';
  }
  return `file://${path.join(__dirname, 'renderer', 'popup.html')}`;
}

export function createMainWindow(): BrowserWindow {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 600,
    minHeight: 400,
    show: false,
    frame: true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  mainWindow.loadURL(getRendererPath());

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Save window bounds on resize/move
  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
  });

  mainWindow.on('move', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return mainWindow;
}

export function createPopupWindow(): BrowserWindow {
  const bounds = store.get('popupBounds');
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  // Center horizontally, position near top of screen
  const x = bounds.x ?? Math.round((screenWidth - bounds.width) / 2);
  const y = bounds.y ?? 150;

  popupWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  popupWindow.loadURL(getPopupPath());

  popupWindow.on('blur', () => {
    popupWindow?.hide();
  });

  popupWindow.on('closed', () => {
    popupWindow = null;
  });

  return popupWindow;
}

export function togglePopup(): void {
  if (popupWindow?.isVisible()) {
    popupWindow.hide();
  } else {
    if (!popupWindow) {
      createPopupWindow();
    }
    popupWindow?.show();
    popupWindow?.focus();
  }
}

export function showMainWindow(): void {
  if (!mainWindow) {
    createMainWindow();
  }
  mainWindow?.show();
  mainWindow?.focus();
}

export function hideMainWindow(): void {
  mainWindow?.hide();
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getStore(): Store<StoreSchema> {
  return store;
}

export function quitApp(): void {
  isQuitting = true;
  app.quit();
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Settings
  ipcMain.handle('get-settings', () => {
    return {
      apiUrl: store.get('apiUrl'),
      autoLaunch: store.get('autoLaunch'),
      minimizeToTray: store.get('minimizeToTray'),
      showInTaskbar: store.get('showInTaskbar'),
      globalShortcut: store.get('globalShortcut'),
    };
  });

  ipcMain.handle('set-setting', (_event, key: keyof StoreSchema, value: unknown) => {
    store.set(key, value);

    // Handle specific setting changes
    if (key === 'autoLaunch') {
      setupAutoLaunch(value as boolean);
    }
    if (key === 'globalShortcut') {
      unregisterShortcuts();
      registerShortcuts();
    }

    return true;
  });

  // Window controls
  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    mainWindow?.close();
  });

  ipcMain.on('hide-popup', () => {
    popupWindow?.hide();
  });

  ipcMain.on('show-main-window', () => {
    showMainWindow();
  });

  // Notifications
  ipcMain.on('show-notification', (_event, options: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      });
      notification.on('click', () => {
        showMainWindow();
      });
      notification.show();
    }
  });

  // API URL getter
  ipcMain.handle('get-api-url', () => {
    return store.get('apiUrl');
  });

  // App info
  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      platform: process.platform,
    };
  });

  // Theme
  ipcMain.handle('get-native-theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });
}

// App lifecycle
app.whenReady().then(() => {
  setupIpcHandlers();
  createMainWindow();
  createPopupWindow();
  createTray();
  registerShortcuts();

  // Setup auto-launch based on settings
  if (store.get('autoLaunch')) {
    setupAutoLaunch(true);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      showMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // On Windows/Linux, keep app running in tray
    if (!store.get('minimizeToTray')) {
      app.quit();
    }
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  unregisterShortcuts();
  destroyTray();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

// Export for other modules
export { store };
