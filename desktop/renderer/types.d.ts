// Type definitions for the OpenSentinel preload API

interface OpenSentinelAPI {
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

declare global {
  interface Window {
    opensentinel: OpenSentinelAPI;
  }
}

export {};
