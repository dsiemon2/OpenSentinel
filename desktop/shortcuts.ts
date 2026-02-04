import { globalShortcut, app } from 'electron';
import { togglePopup, showMainWindow, getStore } from './main';

interface ShortcutConfig {
  accelerator: string;
  callback: () => void;
  description: string;
}

const shortcuts: ShortcutConfig[] = [];

export function registerShortcuts(): boolean {
  const store = getStore();
  const mainShortcut = store.get('globalShortcut') || 'CommandOrControl+Shift+M';

  // Clear existing shortcuts config
  shortcuts.length = 0;

  // Define shortcuts
  shortcuts.push(
    {
      accelerator: mainShortcut,
      callback: () => {
        togglePopup();
      },
      description: 'Toggle quick input popup',
    },
    {
      accelerator: 'CommandOrControl+Shift+O',
      callback: () => {
        showMainWindow();
      },
      description: 'Show main window',
    }
  );

  let allRegistered = true;

  for (const shortcut of shortcuts) {
    try {
      const registered = globalShortcut.register(shortcut.accelerator, shortcut.callback);
      if (!registered) {
        console.warn(`Failed to register shortcut: ${shortcut.accelerator}`);
        allRegistered = false;
      } else {
        console.log(`Registered shortcut: ${shortcut.accelerator} - ${shortcut.description}`);
      }
    } catch (error) {
      console.error(`Error registering shortcut ${shortcut.accelerator}:`, error);
      allRegistered = false;
    }
  }

  return allRegistered;
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
  console.log('All global shortcuts unregistered');
}

export function isShortcutRegistered(accelerator: string): boolean {
  return globalShortcut.isRegistered(accelerator);
}

export function registerCustomShortcut(
  accelerator: string,
  callback: () => void
): boolean {
  try {
    // First unregister if already registered
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }

    const registered = globalShortcut.register(accelerator, callback);
    if (registered) {
      shortcuts.push({
        accelerator,
        callback,
        description: 'Custom shortcut',
      });
    }
    return registered;
  } catch (error) {
    console.error(`Error registering custom shortcut ${accelerator}:`, error);
    return false;
  }
}

export function unregisterCustomShortcut(accelerator: string): boolean {
  try {
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
      // Remove from shortcuts array
      const index = shortcuts.findIndex((s) => s.accelerator === accelerator);
      if (index !== -1) {
        shortcuts.splice(index, 1);
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error unregistering shortcut ${accelerator}:`, error);
    return false;
  }
}

export function getRegisteredShortcuts(): { accelerator: string; description: string }[] {
  return shortcuts.map((s) => ({
    accelerator: s.accelerator,
    description: s.description,
  }));
}

// Validate shortcut format
export function isValidShortcut(accelerator: string): boolean {
  // Basic validation for Electron accelerator format
  const modifiers = ['Command', 'Cmd', 'Control', 'Ctrl', 'CommandOrControl', 'CmdOrCtrl', 'Alt', 'Option', 'AltGr', 'Shift', 'Super', 'Meta'];
  const specialKeys = ['Plus', 'Space', 'Tab', 'Capslock', 'Numlock', 'Scrolllock', 'Backspace', 'Delete', 'Insert', 'Return', 'Enter', 'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown', 'Escape', 'Esc', 'VolumeUp', 'VolumeDown', 'VolumeMute', 'MediaNextTrack', 'MediaPreviousTrack', 'MediaStop', 'MediaPlayPause', 'PrintScreen'];
  const functionKeys = Array.from({ length: 24 }, (_, i) => `F${i + 1}`);
  const numpadKeys = Array.from({ length: 10 }, (_, i) => `num${i}`).concat(['numdec', 'numadd', 'numsub', 'nummult', 'numdiv']);

  const parts = accelerator.split('+').map((p) => p.trim());

  if (parts.length < 2) {
    return false; // Need at least modifier + key
  }

  // Check if all but the last part are modifiers
  for (let i = 0; i < parts.length - 1; i++) {
    if (!modifiers.includes(parts[i])) {
      return false;
    }
  }

  // Check if last part is a valid key
  const lastKey = parts[parts.length - 1];
  const validKeys = [...specialKeys, ...functionKeys, ...numpadKeys];

  // Single character keys (A-Z, 0-9)
  if (lastKey.length === 1) {
    return /^[A-Za-z0-9]$/.test(lastKey);
  }

  return validKeys.includes(lastKey);
}

// Lifecycle
app.on('will-quit', () => {
  unregisterShortcuts();
});
