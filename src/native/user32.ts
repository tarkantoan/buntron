// ============================================================
// Buntron - user32.dll FFI Bindings
// ============================================================

import { FFIType } from "bun:ffi";
import { loadLibrary, toWideString, fromWideString } from "./ffi-helpers";
import type { HWND, DWORD, BOOL, UINT } from "./types";

const user32 = loadLibrary("user32.dll", {
  MessageBoxW: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u32],
    returns: FFIType.i32,
  },
  GetSystemMetrics: {
    args: [FFIType.i32],
    returns: FFIType.i32,
  },
  SetForegroundWindow: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  ShowWindow: {
    args: [FFIType.ptr, FFIType.i32],
    returns: FFIType.bool,
  },
  SetWindowTextW: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.bool,
  },
  GetWindowTextW: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.i32],
    returns: FFIType.i32,
  },
  GetWindowRect: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.bool,
  },
  MoveWindow: {
    args: [
      FFIType.ptr,
      FFIType.i32,
      FFIType.i32,
      FFIType.i32,
      FFIType.i32,
      FFIType.bool,
    ],
    returns: FFIType.bool,
  },
  SetWindowPos: {
    args: [
      FFIType.ptr,
      FFIType.ptr,
      FFIType.i32,
      FFIType.i32,
      FFIType.i32,
      FFIType.i32,
      FFIType.u32,
    ],
    returns: FFIType.bool,
  },
  IsWindowVisible: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  IsIconic: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  IsZoomed: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  DestroyWindow: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  GetDesktopWindow: {
    args: [],
    returns: FFIType.ptr,
  },
  GetForegroundWindow: {
    args: [],
    returns: FFIType.ptr,
  },
  RegisterHotKey: {
    args: [FFIType.ptr, FFIType.i32, FFIType.u32, FFIType.u32],
    returns: FFIType.bool,
  },
  UnregisterHotKey: {
    args: [FFIType.ptr, FFIType.i32],
    returns: FFIType.bool,
  },
  GetDC: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  ReleaseDC: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  GetWindowLongW: {
    args: [FFIType.ptr, FFIType.i32],
    returns: FFIType.i32,
  },
  SetWindowLongW: {
    args: [FFIType.ptr, FFIType.i32, FFIType.i32],
    returns: FFIType.i32,
  },
  OpenClipboard: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },
  CloseClipboard: {
    args: [],
    returns: FFIType.bool,
  },
  EmptyClipboard: {
    args: [],
    returns: FFIType.bool,
  },
  GetClipboardData: {
    args: [FFIType.u32],
    returns: FFIType.ptr,
  },
  SetClipboardData: {
    args: [FFIType.u32, FFIType.ptr],
    returns: FFIType.ptr,
  },
  MonitorFromWindow: {
    args: [FFIType.ptr, FFIType.u32],
    returns: FFIType.ptr,
  },
  GetMonitorInfoW: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.bool,
  },
  FlashWindow: {
    args: [FFIType.ptr, FFIType.bool],
    returns: FFIType.bool,
  },
  SetLayeredWindowAttributes: {
    args: [FFIType.ptr, FFIType.u32, FFIType.u8, FFIType.u32],
    returns: FFIType.bool,
  },
});

export class User32 {
  /**
   * Show a message box
   */
  static messageBox(
    hwnd: number | null,
    text: string,
    caption: string,
    type: number,
  ): number {
    const textBuf = toWideString(text);
    const captionBuf = toWideString(caption);
    return user32.symbols.MessageBoxW(hwnd, textBuf, captionBuf, type);
  }

  /**
   * Get system metrics (screen size, etc.)
   */
  static getSystemMetrics(index: number): number {
    return user32.symbols.GetSystemMetrics(index);
  }

  /**
   * Bring window to foreground
   */
  static setForegroundWindow(hwnd: number): boolean {
    return !!user32.symbols.SetForegroundWindow(hwnd);
  }

  /**
   * Show/hide window
   */
  static showWindow(hwnd: number, cmdShow: number): boolean {
    return !!user32.symbols.ShowWindow(hwnd, cmdShow);
  }

  /**
   * Set window title text
   */
  static setWindowText(hwnd: number, text: string): boolean {
    return !!user32.symbols.SetWindowTextW(hwnd, toWideString(text));
  }

  /**
   * Get window rectangle
   */
  static getWindowRect(hwnd: number): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } {
    const buf = Buffer.alloc(16);
    const { ptr } = require("bun:ffi");
    user32.symbols.GetWindowRect(hwnd, ptr(buf));
    return {
      left: buf.readInt32LE(0),
      top: buf.readInt32LE(4),
      right: buf.readInt32LE(8),
      bottom: buf.readInt32LE(12),
    };
  }

  /**
   * Move and resize window
   */
  static moveWindow(
    hwnd: number,
    x: number,
    y: number,
    w: number,
    h: number,
    repaint = true,
  ): boolean {
    return !!user32.symbols.MoveWindow(hwnd, x, y, w, h, repaint);
  }

  /**
   * Set window position and z-order
   */
  static setWindowPos(
    hwnd: number,
    hwndInsertAfter: number,
    x: number,
    y: number,
    cx: number,
    cy: number,
    flags: number,
  ): boolean {
    return !!user32.symbols.SetWindowPos(
      hwnd,
      hwndInsertAfter,
      x,
      y,
      cx,
      cy,
      flags,
    );
  }

  /**
   * Check if window is visible
   */
  static isWindowVisible(hwnd: number): boolean {
    return !!user32.symbols.IsWindowVisible(hwnd);
  }

  /**
   * Check if window is minimized
   */
  static isIconic(hwnd: number): boolean {
    return !!user32.symbols.IsIconic(hwnd);
  }

  /**
   * Check if window is maximized
   */
  static isZoomed(hwnd: number): boolean {
    return !!user32.symbols.IsZoomed(hwnd);
  }

  /**
   * Destroy a window
   */
  static destroyWindow(hwnd: number): boolean {
    return !!user32.symbols.DestroyWindow(hwnd);
  }

  /**
   * Get desktop window handle
   */
  static getDesktopWindow(): number {
    return user32.symbols.GetDesktopWindow();
  }

  /**
   * Get foreground window handle
   */
  static getForegroundWindow(): number {
    return user32.symbols.GetForegroundWindow();
  }

  /**
   * Register global hotkey
   */
  static registerHotKey(
    hwnd: number | null,
    id: number,
    modifiers: number,
    vk: number,
  ): boolean {
    return !!user32.symbols.RegisterHotKey(hwnd, id, modifiers, vk);
  }

  /**
   * Unregister global hotkey
   */
  static unregisterHotKey(hwnd: number | null, id: number): boolean {
    return !!user32.symbols.UnregisterHotKey(hwnd, id);
  }

  /**
   * Get window style
   */
  static getWindowLong(hwnd: number, index: number): number {
    return user32.symbols.GetWindowLongW(hwnd, index);
  }

  /**
   * Set window style
   */
  static setWindowLong(hwnd: number, index: number, newLong: number): number {
    return user32.symbols.SetWindowLongW(hwnd, index, newLong);
  }

  /**
   * Open clipboard
   */
  static openClipboard(hwnd: number | null): boolean {
    return !!user32.symbols.OpenClipboard(hwnd);
  }

  /**
   * Close clipboard
   */
  static closeClipboard(): boolean {
    return !!user32.symbols.CloseClipboard();
  }

  /**
   * Empty clipboard
   */
  static emptyClipboard(): boolean {
    return !!user32.symbols.EmptyClipboard();
  }

  /**
   * Get clipboard data handle
   */
  static getClipboardData(format: number): number {
    return user32.symbols.GetClipboardData(format);
  }

  /**
   * Set clipboard data
   */
  static setClipboardData(format: number, hMem: number): number {
    return user32.symbols.SetClipboardData(format, hMem);
  }

  /**
   * Flash window taskbar button
   */
  static flashWindow(hwnd: number, invert: boolean): boolean {
    return !!user32.symbols.FlashWindow(hwnd, invert);
  }

  /**
   * Set window opacity
   */
  static setLayeredWindowAttributes(
    hwnd: number,
    crKey: number,
    alpha: number,
    flags: number,
  ): boolean {
    return !!user32.symbols.SetLayeredWindowAttributes(
      hwnd,
      crKey,
      alpha,
      flags,
    );
  }
}

export default User32;
