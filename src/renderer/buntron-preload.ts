// ============================================================
// Buntron Renderer Preload Script
// ============================================================
// This file is injected into every WebView2 renderer.
// It's also available as a standalone module for TypeScript
// type checking in renderer code.
//
// The actual runtime injection happens in browser-window.ts
// (buildPreloadScript method). This file provides TypeScript
// declarations for the renderer-side API.
// ============================================================

/**
 * @fileoverview
 * In the renderer process, you can access Buntron APIs via:
 *
 * ```js
 * const { ipcRenderer } = window.buntron;
 *
 * // Send a message to main process
 * ipcRenderer.send('my-channel', data);
 *
 * // Invoke and wait for response
 * const result = await ipcRenderer.invoke('get-data', query);
 *
 * // Listen for messages from main process
 * ipcRenderer.on('update', (event, data) => {
 *   console.log('Received:', data);
 * });
 * ```
 */

// This is a type declaration file for the renderer
// The actual API is injected at runtime by the preload system

export interface BuntronIpcRenderer {
  /**
   * Send an asynchronous message to main process
   */
  send(channel: string, ...args: any[]): void;

  /**
   * Send and wait for a response from main process
   */
  invoke(channel: string, ...args: any[]): Promise<any>;

  /**
   * Listen for messages from main process
   */
  on(
    channel: string,
    listener: (event: any, ...args: any[]) => void,
  ): BuntronIpcRenderer;

  /**
   * Listen once for a message from main process
   */
  once(
    channel: string,
    listener: (event: any, ...args: any[]) => void,
  ): BuntronIpcRenderer;

  /**
   * Remove a specific listener
   */
  removeListener(channel: string, listener: Function): BuntronIpcRenderer;

  /**
   * Remove all listeners for a channel
   */
  removeAllListeners(channel?: string): BuntronIpcRenderer;
}

export interface BuntronRendererAPI {
  /** IPC renderer for communicating with main process */
  ipcRenderer: BuntronIpcRenderer;
  /** This window's ID */
  windowId: number;
  /** Platform identifier */
  platform: "win32";
}

// Global type augmentation
declare global {
  interface Window {
    buntron: BuntronRendererAPI;
  }
}

export {};
