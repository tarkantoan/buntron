// ============================================================
// Buntron - Main Exports
// ============================================================
// This is the main entry point for the Buntron framework.
// Import everything from here: import { BuntronApp, BrowserWindow } from "buntron";
// ============================================================

// Core
export { BuntronApp } from "./core/app";
export { BrowserWindow, WebContents } from "./core/browser-window";
export { ipcMain } from "./core/ipc-main";
export type { IPCMainEvent } from "./core/ipc-main";
export { dialog } from "./core/dialog";
export { Tray } from "./core/tray";
export { Menu, MenuItem } from "./core/menu";
export { Notification } from "./core/notification";
export { shell } from "./core/shell";
export { clipboard } from "./core/clipboard";
export { screen } from "./core/screen";
export { globalShortcut } from "./core/global-shortcut";
export { powerMonitor } from "./core/power-monitor";

// Native
export { User32 } from "./native/user32";
export { Kernel32 } from "./native/kernel32";
export { Shell32 } from "./native/shell32";
export { Gdi32 } from "./native/gdi32";

// Types
export type {
  BrowserWindowOptions,
  WebPreferences,
  DialogOptions,
  FileDialogOptions,
  FileFilter,
  TrayOptions,
  MenuTemplate,
  NotificationOptions,
  WindowRect,
  ScreenInfo,
  WindowState,
  IPCMessage,
  HostCommand,
  HostEvent,
} from "./native/types";

// Renderer types (for type checking in renderer code)
export type {
  BuntronIpcRenderer,
  BuntronRendererAPI,
} from "./renderer/buntron-preload";

// Server
export { ContentServer } from "./server/content-server";

// IPC
export { IPCWebSocketServer } from "./ipc/ws-server";
export { ChannelManager } from "./ipc/channels";

// Version
export const VERSION = "1.0.0";
export const PLATFORM = "win32";
