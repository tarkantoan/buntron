// ============================================================
// Buntron - Screen Module
// ============================================================

import { User32 } from "../native/user32";
import { Gdi32, LOGPIXELSX } from "../native/gdi32";
import {
  SM_CXSCREEN,
  SM_CYSCREEN,
  SM_CXFULLSCREEN,
  SM_CYFULLSCREEN,
} from "../native/types";
import type { ScreenInfo } from "../native/types";

class ScreenModule {
  /**
   * Get primary screen info
   */
  getPrimaryDisplay(): ScreenInfo {
    const width = User32.getSystemMetrics(SM_CXSCREEN);
    const height = User32.getSystemMetrics(SM_CYSCREEN);
    const availWidth = User32.getSystemMetrics(SM_CXFULLSCREEN);
    const availHeight = User32.getSystemMetrics(SM_CYFULLSCREEN);

    // Get DPI scale factor
    let scaleFactor = 1;
    try {
      const hdc = User32.getDC(0);
      if (hdc) {
        scaleFactor = Gdi32.getDpiScale(hdc);
        User32.releaseDC(0, hdc);
      }
    } catch {}

    return {
      width,
      height,
      availWidth,
      availHeight,
      scaleFactor,
    };
  }

  /**
   * Get screen size
   */
  getScreenSize(): { width: number; height: number } {
    return {
      width: User32.getSystemMetrics(SM_CXSCREEN),
      height: User32.getSystemMetrics(SM_CYSCREEN),
    };
  }

  /**
   * Get cursor screen position
   */
  getCursorScreenPoint(): { x: number; y: number } {
    // Use PowerShell to get cursor position (FFI for GetCursorPos needs struct)
    const proc = Bun.spawnSync([
      "powershell.exe",
      "-NoProfile",
      "-Command",
      "[System.Windows.Forms.Cursor]::Position | ConvertTo-Json",
    ]);
    try {
      const pos = JSON.parse(proc.stdout.toString());
      return { x: pos.X || 0, y: pos.Y || 0 };
    } catch {
      return { x: 0, y: 0 };
    }
  }

  /**
   * Get DPI scale factor
   */
  getDpiScale(): number {
    try {
      const hdc = User32.getDC(0);
      if (hdc) {
        const scale = Gdi32.getDpiScale(hdc);
        User32.releaseDC(0, hdc);
        return scale;
      }
    } catch {}
    return 1;
  }
}

export const screen = new ScreenModule();
export default screen;
