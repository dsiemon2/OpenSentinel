import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for exposed API
interface MoltbotAPI {
  // Settings
  getSettings: () => Promise<{
    apiUrl: string;
    autoLaunch: boolean;
    minimizeToTray: boolean;
    showInTaskbar: boolean;
    globalShortcut: string;
  }>;
  setSetting: (key: string, value: unknown) => Promise<boolean>;
  getApiUrl: () => Promise<string>;

  // Window controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  hidePopup: () => void;
  showMainWindow: () => void;

  // Notifications
  showNotification: (options: { title: string; body: string }) => void;

  // App info
  getAppInfo: () => Promise<{
    version: string;
    name: string;
    platform: string;
  }>;

  // Theme
  getNativeTheme: () => Promise<'dark' | 'light'>;

  // Platform info
  platform: string;
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const api: MoltbotAPI = {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('set-setting', key, value),
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  hidePopup: () => ipcRenderer.send('hide-popup'),
  showMainWindow: () => ipcRenderer.send('show-main-window'),

  // Notifications
  showNotification: (options: { title: string; body: string }) => {
    ipcRenderer.send('show-notification', options);
  },

  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Theme
  getNativeTheme: () => ipcRenderer.invoke('get-native-theme'),

  // Platform info
  platform: process.platform,
};

contextBridge.exposeInMainWorld('moltbot', api);

// Type declaration for TypeScript
declare global {
  interface Window {
    moltbot: MoltbotAPI;
  }
}
