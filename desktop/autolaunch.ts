import AutoLaunch from 'auto-launch';
import { app } from 'electron';

let autoLauncher: AutoLaunch | null = null;

function getAutoLauncher(): AutoLaunch {
  if (!autoLauncher) {
    autoLauncher = new AutoLaunch({
      name: 'Moltbot',
      path: app.getPath('exe'),
      isHidden: true, // Start minimized to tray
    });
  }
  return autoLauncher;
}

export async function setupAutoLaunch(enable: boolean): Promise<boolean> {
  try {
    const launcher = getAutoLauncher();

    if (enable) {
      const isEnabled = await launcher.isEnabled();
      if (!isEnabled) {
        await launcher.enable();
        console.log('Auto-launch enabled');
      }
    } else {
      const isEnabled = await launcher.isEnabled();
      if (isEnabled) {
        await launcher.disable();
        console.log('Auto-launch disabled');
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to setup auto-launch:', error);
    return false;
  }
}

export async function isAutoLaunchEnabled(): Promise<boolean> {
  try {
    const launcher = getAutoLauncher();
    return await launcher.isEnabled();
  } catch (error) {
    console.error('Failed to check auto-launch status:', error);
    return false;
  }
}

// Platform-specific notes:
// Windows: Uses registry (HKCU\Software\Microsoft\Windows\CurrentVersion\Run)
// Linux: Uses ~/.config/autostart/*.desktop files
// macOS: Uses Login Items (not supported in this app)

export function getAutoLaunchInfo(): {
  supported: boolean;
  method: string;
} {
  const platform = process.platform;

  switch (platform) {
    case 'win32':
      return {
        supported: true,
        method: 'Windows Registry',
      };
    case 'linux':
      return {
        supported: true,
        method: 'XDG Autostart',
      };
    case 'darwin':
      return {
        supported: false,
        method: 'Not supported (macOS)',
      };
    default:
      return {
        supported: false,
        method: 'Unknown platform',
      };
  }
}
