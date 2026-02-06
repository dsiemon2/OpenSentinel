import { Tray, Menu, nativeImage, app, NativeImage } from 'electron';
import * as path from 'path';
import {
  showMainWindow,
  hideMainWindow,
  togglePopup,
  quitApp,
  getMainWindow,
  getStore,
} from './main';

let tray: Tray | null = null;

function getIconPath(): string {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', iconName);
  }
  return path.join(__dirname, '..', 'assets', iconName);
}

function getTrayIconPath(): string {
  // Use smaller icon for tray
  const iconName = process.platform === 'win32' ? 'tray.ico' : 'tray.png';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', iconName);
  }
  const trayPath = path.join(__dirname, '..', 'assets', iconName);
  // Fallback to main icon if tray-specific icon doesn't exist
  try {
    require('fs').accessSync(trayPath);
    return trayPath;
  } catch {
    return getIconPath();
  }
}

export function createTray(): Tray {
  const iconPath = getTrayIconPath();
  let icon: NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
    // Resize for tray (16x16 on Windows, 22x22 on Linux)
    const size = process.platform === 'win32' ? 16 : 22;
    icon = icon.resize({ width: size, height: size });
  } catch (error) {
    console.error('Failed to load tray icon:', error);
    // Create a simple colored icon as fallback
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('OpenSentinel - AI Assistant');

  updateTrayMenu();

  // Double-click to show main window (Windows)
  tray.on('double-click', () => {
    showMainWindow();
  });

  // Single click behavior
  tray.on('click', () => {
    if (process.platform === 'linux') {
      // On Linux, single click should toggle the window
      const mainWindow = getMainWindow();
      if (mainWindow?.isVisible()) {
        hideMainWindow();
      } else {
        showMainWindow();
      }
    }
  });

  return tray;
}

export function updateTrayMenu(): void {
  if (!tray) return;

  const store = getStore();
  const mainWindow = getMainWindow();
  const isVisible = mainWindow?.isVisible() ?? false;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'OpenSentinel',
      enabled: false,
      icon: undefined, // Could add small icon here
    },
    { type: 'separator' },
    {
      label: 'Quick Input',
      accelerator: store.get('globalShortcut'),
      click: () => {
        togglePopup();
      },
    },
    {
      label: isVisible ? 'Hide Window' : 'Show Window',
      click: () => {
        if (isVisible) {
          hideMainWindow();
        } else {
          showMainWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        showMainWindow();
        // Could send IPC to navigate to settings
      },
    },
    { type: 'separator' },
    {
      label: 'Start with System',
      type: 'checkbox',
      checked: store.get('autoLaunch'),
      click: (menuItem) => {
        store.set('autoLaunch', menuItem.checked);
        const { setupAutoLaunch } = require('./autolaunch');
        setupAutoLaunch(menuItem.checked);
      },
    },
    {
      label: 'Minimize to Tray',
      type: 'checkbox',
      checked: store.get('minimizeToTray'),
      click: (menuItem) => {
        store.set('minimizeToTray', menuItem.checked);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit OpenSentinel',
      accelerator: process.platform === 'win32' ? 'Alt+F4' : 'CommandOrControl+Q',
      click: () => {
        quitApp();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

export function getTray(): Tray | null {
  return tray;
}

// Update tray menu when window visibility changes
export function onWindowVisibilityChange(): void {
  updateTrayMenu();
}
