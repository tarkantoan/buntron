// ============================================================
// Buntron - IPC Main Module
// ============================================================
// Equivalent to Electron's ipcMain.
// Handles IPC communication from renderer processes.
// ============================================================

import { BuntronApp } from "./app";

type IPCHandler = (event: IPCMainEvent, ...args: any[]) => any;

export interface IPCMainEvent {
  sender: {
    id: number;
    send: (channel: string, ...args: any[]) => void;
  };
  reply: (channel: string, ...args: any[]) => void;
  returnValue: any;
}

class IPCMainModule {
  /**
   * Register a handler for invoke-style IPC (renderer calls ipcRenderer.invoke)
   */
  handle(channel: string, handler: IPCHandler): void {
    const app = BuntronApp.getInstance();
    if (!app) throw new Error("App not initialized");
    app.ipc.handle(channel, handler);
  }

  /**
   * Register a one-time handler for invoke-style IPC
   */
  handleOnce(channel: string, handler: IPCHandler): void {
    const app = BuntronApp.getInstance();
    if (!app) throw new Error("App not initialized");
    app.ipc.handleOnce(channel, handler);
  }

  /**
   * Remove a handler
   */
  removeHandler(channel: string): void {
    const app = BuntronApp.getInstance();
    if (!app) return;
    app.ipc.removeHandler(channel);
  }

  /**
   * Listen for send-style IPC messages (renderer calls ipcRenderer.send)
   */
  on(channel: string, listener: IPCHandler): this {
    const app = BuntronApp.getInstance();
    if (!app) throw new Error("App not initialized");
    app.ipc.on(`ipc:${channel}`, listener);
    return this;
  }

  /**
   * Listen once for a send-style IPC message
   */
  once(channel: string, listener: IPCHandler): this {
    const app = BuntronApp.getInstance();
    if (!app) throw new Error("App not initialized");
    app.ipc.once(`ipc:${channel}`, listener);
    return this;
  }

  /**
   * Remove a listener
   */
  removeListener(channel: string, listener: IPCHandler): this {
    const app = BuntronApp.getInstance();
    if (!app) return this;
    app.ipc.removeListener(`ipc:${channel}`, listener);
    return this;
  }

  /**
   * Remove all listeners for a channel
   */
  removeAllListeners(channel?: string): this {
    const app = BuntronApp.getInstance();
    if (!app) return this;
    if (channel) {
      app.ipc.removeAllListeners(`ipc:${channel}`);
    }
    return this;
  }

  /**
   * Send a message to a specific window's renderer
   */
  sendTo(windowId: number, channel: string, ...args: any[]): void {
    const app = BuntronApp.getInstance();
    if (!app) return;
    app.ipc.sendToWindow(windowId, channel, ...args);
  }

  /**
   * Send a message to all renderer windows
   */
  sendToAll(channel: string, ...args: any[]): void {
    const app = BuntronApp.getInstance();
    if (!app) return;
    app.ipc.sendToAll(channel, ...args);
  }
}

/** Singleton ipcMain instance */
export const ipcMain = new IPCMainModule();
export default ipcMain;
