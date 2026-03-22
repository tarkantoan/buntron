// ============================================================
// Buntron - Global Shortcut Module
// ============================================================

import { EventEmitter } from "events";
import {
  MOD_ALT,
  MOD_CONTROL,
  MOD_SHIFT,
  MOD_WIN,
  MOD_NOREPEAT,
  VK_F1,
  VK_F2,
  VK_F3,
  VK_F4,
  VK_F5,
  VK_F6,
  VK_F7,
  VK_F8,
  VK_F9,
  VK_F10,
  VK_F11,
  VK_F12,
  VK_RETURN,
  VK_ESCAPE,
  VK_TAB,
  VK_SPACE,
} from "../native/types";
import { User32 } from "../native/user32";

type ShortcutCallback = () => void;

// Map common key names to virtual key codes
const KEY_MAP: Record<string, number> = {
  F1: VK_F1,
  F2: VK_F2,
  F3: VK_F3,
  F4: VK_F4,
  F5: VK_F5,
  F6: VK_F6,
  F7: VK_F7,
  F8: VK_F8,
  F9: VK_F9,
  F10: VK_F10,
  F11: VK_F11,
  F12: VK_F12,
  Enter: VK_RETURN,
  Return: VK_RETURN,
  Escape: VK_ESCAPE,
  Esc: VK_ESCAPE,
  Tab: VK_TAB,
  Space: VK_SPACE,
};

// Add A-Z
for (let i = 65; i <= 90; i++) {
  KEY_MAP[String.fromCharCode(i)] = i;
  KEY_MAP[String.fromCharCode(i).toLowerCase()] = i;
}

// Add 0-9
for (let i = 48; i <= 57; i++) {
  KEY_MAP[String.fromCharCode(i)] = i;
}

class GlobalShortcutModule extends EventEmitter {
  private shortcuts: Map<string, { id: number; callback: ShortcutCallback }> =
    new Map();
  private nextId: number = 1;

  /**
   * Register a global shortcut
   * @param accelerator - e.g., "Ctrl+Shift+I", "Alt+F4", "CommandOrControl+Q"
   * @param callback - Function to call when shortcut is pressed
   */
  register(accelerator: string, callback: ShortcutCallback): boolean {
    const parsed = this.parseAccelerator(accelerator);
    if (!parsed) return false;

    const id = this.nextId++;
    const success = User32.registerHotKey(
      null,
      id,
      parsed.modifiers | MOD_NOREPEAT,
      parsed.vk,
    );

    if (success) {
      this.shortcuts.set(accelerator, { id, callback });
      return true;
    }

    return false;
  }

  /**
   * Unregister a global shortcut
   */
  unregister(accelerator: string): void {
    const shortcut = this.shortcuts.get(accelerator);
    if (shortcut) {
      User32.unregisterHotKey(null, shortcut.id);
      this.shortcuts.delete(accelerator);
    }
  }

  /**
   * Unregister all global shortcuts
   */
  unregisterAll(): void {
    for (const [accel, shortcut] of this.shortcuts) {
      User32.unregisterHotKey(null, shortcut.id);
    }
    this.shortcuts.clear();
  }

  /**
   * Check if a shortcut is registered
   */
  isRegistered(accelerator: string): boolean {
    return this.shortcuts.has(accelerator);
  }

  /**
   * Parse an Electron-style accelerator string
   */
  private parseAccelerator(
    accelerator: string,
  ): { modifiers: number; vk: number } | null {
    const parts = accelerator.split("+").map((p) => p.trim());
    let modifiers = 0;
    let vk = 0;

    for (const part of parts) {
      const lower = part.toLowerCase();
      switch (lower) {
        case "ctrl":
        case "control":
        case "commandorcontrol":
        case "cmdorctrl":
          modifiers |= MOD_CONTROL;
          break;
        case "alt":
        case "option":
          modifiers |= MOD_ALT;
          break;
        case "shift":
          modifiers |= MOD_SHIFT;
          break;
        case "super":
        case "meta":
        case "win":
        case "cmd":
        case "command":
          modifiers |= MOD_WIN;
          break;
        default:
          const keyCode = KEY_MAP[part] || KEY_MAP[part.toUpperCase()];
          if (keyCode) {
            vk = keyCode;
          } else {
            console.warn(`[Buntron] Unknown key: ${part}`);
            return null;
          }
      }
    }

    if (vk === 0) return null;
    return { modifiers, vk };
  }
}

export const globalShortcut = new GlobalShortcutModule();
export default globalShortcut;
