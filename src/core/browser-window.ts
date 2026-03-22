// ============================================================
// Buntron - BrowserWindow Class
// ============================================================
// Equivalent to Electron's BrowserWindow.
// Creates and controls native windows with WebView2 content.
// ============================================================

import { EventEmitter } from "events";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { BuntronApp } from "./app";
import type {
  BrowserWindowOptions,
  WebPreferences,
  WindowState,
} from "../native/types";

let windowIdCounter = 0;

export class BrowserWindow extends EventEmitter {
  /** Internal window ID (Buntron-side) */
  readonly id: number;
  /** Host-side window ID */
  private hostWindowId: number = -1;
  /** Native window handle (HWND) */
  private hwnd: number = 0;
  /** Window options */
  private options: Required<BrowserWindowOptions>;
  /** WebContents equivalent */
  readonly webContents: WebContents;
  /** Current state */
  private _state: WindowState = "normal";
  private _isDestroyed: boolean = false;
  private _title: string;
  private _url: string = "";

  /** Static: all open windows */
  private static allWindows: Map<number, BrowserWindow> = new Map();

  constructor(options: BrowserWindowOptions = {}) {
    super();

    this.id = ++windowIdCounter;
    this.options = {
      width: options.width ?? 800,
      height: options.height ?? 600,
      x: options.x ?? -1,
      y: options.y ?? -1,
      minWidth: options.minWidth ?? 0,
      minHeight: options.minHeight ?? 0,
      maxWidth: options.maxWidth ?? 0,
      maxHeight: options.maxHeight ?? 0,
      title: options.title ?? "Buntron",
      icon: options.icon ?? "",
      show: options.show ?? true,
      center: options.center ?? true,
      resizable: options.resizable ?? true,
      minimizable: options.minimizable ?? true,
      maximizable: options.maximizable ?? true,
      closable: options.closable ?? true,
      alwaysOnTop: options.alwaysOnTop ?? false,
      fullscreen: options.fullscreen ?? false,
      frame: options.frame ?? true,
      transparent: options.transparent ?? false,
      backgroundColor: options.backgroundColor ?? "#FFFFFF",
      webPreferences: {
        preload: options.webPreferences?.preload ?? "",
        nodeIntegration: options.webPreferences?.nodeIntegration ?? false,
        contextIsolation: options.webPreferences?.contextIsolation ?? true,
        devTools: options.webPreferences?.devTools ?? true,
        javascript: options.webPreferences?.javascript ?? true,
        webSecurity: options.webPreferences?.webSecurity ?? true,
        zoomFactor: options.webPreferences?.zoomFactor ?? 1.0,
      },
    };

    this._title = this.options.title;
    this.webContents = new WebContents(this);

    BrowserWindow.allWindows.set(this.id, this);

    const app = BuntronApp.getInstance();
    if (app) {
      app._windowCreated();
    }
  }

  /**
   * Create the native window via the host process
   */
  async create(url?: string): Promise<void> {
    const app = BuntronApp.getInstance();
    if (!app) throw new Error("BuntronApp not initialized");
    if (!app.isReady) throw new Error("App not ready. Call app.start() first");

    this._url = url || "";

    // Build preload script
    let preloadScript = this.buildPreloadScript(app);

    // If URL is a file path, serve it through content server
    let navigateUrl = this._url;
    if (
      this._url &&
      !this._url.startsWith("http://") &&
      !this._url.startsWith("https://")
    ) {
      const filePath = resolve(this._url);
      if (existsSync(filePath)) {
        navigateUrl = app.contentServer.serveFile(filePath);
      }
    }

    // Create window via host
    const result = await app.host.sendCommand("createWindow", {
      width: this.options.width,
      height: this.options.height,
      x: this.options.x,
      y: this.options.y,
      minWidth: this.options.minWidth,
      minHeight: this.options.minHeight,
      maxWidth: this.options.maxWidth,
      maxHeight: this.options.maxHeight,
      title: this.options.title,
      show: this.options.show,
      center: this.options.center,
      resizable: this.options.resizable,
      minimizable: this.options.minimizable,
      maximizable: this.options.maximizable,
      alwaysOnTop: this.options.alwaysOnTop,
      fullscreen: this.options.fullscreen,
      frame: this.options.frame,
      backgroundColor: this.options.backgroundColor,
      url: navigateUrl || "about:blank",
      preloadScript,
      devTools: this.options.webPreferences.devTools,
    });

    this.hostWindowId = result.windowId;
    this.hwnd = result.handle || 0;

    // Listen for host events for this window
    this.setupHostEventListeners(app);

    this.emit("ready-to-show");
    if (this.options.show) {
      this.emit("show");
    }
  }

  /**
   * Create window and load a URL
   */
  async loadURL(url: string): Promise<void> {
    if (this.hostWindowId < 0) {
      await this.create(url);
    } else {
      this._url = url;
      const app = BuntronApp.getInstance()!;
      await app.host.sendCommand("navigate", {
        windowId: this.hostWindowId,
        url,
      });
    }
  }

  /**
   * Load a local HTML file
   */
  async loadFile(filePath: string): Promise<void> {
    const app = BuntronApp.getInstance()!;
    const absPath = resolve(filePath);

    if (!existsSync(absPath)) {
      throw new Error(`File not found: ${absPath}`);
    }

    const url = app.contentServer.serveFile(absPath);

    if (this.hostWindowId < 0) {
      await this.create(url);
    } else {
      this._url = url;
      await app.host.sendCommand("navigate", {
        windowId: this.hostWindowId,
        url,
      });
    }
  }

  // ---- Window manipulation ----

  show(): void {
    this.sendCmd("show");
    this._state = "normal";
    this.emit("show");
  }

  hide(): void {
    this.sendCmd("hide");
    this._state = "hidden";
    this.emit("hide");
  }

  close(): void {
    this.sendCmd("closeWindow");
  }

  destroy(): void {
    this.sendCmd("destroyWindow");
    this._isDestroyed = true;
  }

  minimize(): void {
    this.sendCmd("minimize");
    this._state = "minimized";
    this.emit("minimize");
  }

  maximize(): void {
    this.sendCmd("maximize");
    this._state = "maximized";
    this.emit("maximize");
  }

  restore(): void {
    this.sendCmd("restore");
    this._state = "normal";
    this.emit("restore");
  }

  focus(): void {
    this.sendCmd("focus");
    this.emit("focus");
  }

  setTitle(title: string): void {
    this._title = title;
    this.sendCmd("setTitle", { title });
  }

  getTitle(): string {
    return this._title;
  }

  setSize(width: number, height: number): void {
    this.sendCmd("setSize", { width, height });
  }

  getSize(): [number, number] {
    return [this.options.width, this.options.height];
  }

  setPosition(x: number, y: number): void {
    this.sendCmd("setPosition", { x, y });
  }

  setMinimumSize(width: number, height: number): void {
    this.sendCmd("setMinSize", { width, height });
  }

  setMaximumSize(width: number, height: number): void {
    this.sendCmd("setMaxSize", { width, height });
  }

  setResizable(resizable: boolean): void {
    this.sendCmd("setResizable", { resizable });
  }

  setAlwaysOnTop(flag: boolean): void {
    this.sendCmd("setAlwaysOnTop", { onTop: flag });
  }

  setFullScreen(flag: boolean): void {
    this.sendCmd("setFullscreen", { fullscreen: flag });
    this._state = flag ? "fullscreen" : "normal";
  }

  isFullScreen(): boolean {
    return this._state === "fullscreen";
  }

  isMinimized(): boolean {
    return this._state === "minimized";
  }

  isMaximized(): boolean {
    return this._state === "maximized";
  }

  isVisible(): boolean {
    return this._state !== "hidden";
  }

  isDestroyed(): boolean {
    return this._isDestroyed;
  }

  setOpacity(opacity: number): void {
    this.sendCmd("setOpacity", { opacity });
  }

  flashFrame(flag: boolean): void {
    this.sendCmd("flashFrame", { flash: flag });
  }

  /**
   * Get native window handle
   */
  getNativeWindowHandle(): number {
    return this.hwnd;
  }

  /**
   * Get detailed window info from host
   */
  async getWindowInfo(): Promise<any> {
    const app = BuntronApp.getInstance();
    if (!app || this.hostWindowId < 0) return null;
    return app.host.sendCommand("getWindowInfo", {
      windowId: this.hostWindowId,
    });
  }

  // ---- Static methods ----

  /**
   * Get all open browser windows
   */
  static getAllWindows(): BrowserWindow[] {
    return Array.from(BrowserWindow.allWindows.values());
  }

  /**
   * Get focused window
   */
  static getFocusedWindow(): BrowserWindow | null {
    // This is approximate - we track focus via events
    for (const win of BrowserWindow.allWindows.values()) {
      // Return first visible non-minimized window
      if (win._state === "normal" || win._state === "maximized") {
        return win;
      }
    }
    return null;
  }

  /**
   * Get window by ID
   */
  static fromId(id: number): BrowserWindow | null {
    return BrowserWindow.allWindows.get(id) || null;
  }

  // ---- Private ----

  private sendCmd(cmd: string, params: Record<string, any> = {}): void {
    const app = BuntronApp.getInstance();
    if (!app || this.hostWindowId < 0 || this._isDestroyed) return;
    app.host.sendCommandFire(cmd, { windowId: this.hostWindowId, ...params });
  }

  private buildPreloadScript(app: BuntronApp): string {
    const ipcPort = app.getIpcPort();
    const ipcToken = app.getIpcToken();
    const windowId = this.id;

    // Base preload: inject buntron IPC client
    let script = `
(function() {
  'use strict';
  
  const BUNTRON_IPC_PORT = ${ipcPort};
  const BUNTRON_IPC_TOKEN = '${ipcToken}';
  const BUNTRON_WINDOW_ID = ${windowId};
  
  let _ws = null;
  let _ready = false;
  let _messageId = 0;
  let _pendingInvokes = new Map();
  let _listeners = new Map();
  
  function connect() {
    const url = 'ws://127.0.0.1:' + BUNTRON_IPC_PORT + '/buntron-ipc?token=' + BUNTRON_IPC_TOKEN + '&windowId=' + BUNTRON_WINDOW_ID;
    _ws = new WebSocket(url);
    
    _ws.onopen = function() {
      _ready = true;
      window.dispatchEvent(new CustomEvent('buntron-ipc-ready'));
    };
    
    _ws.onmessage = function(evt) {
      try {
        var msg = JSON.parse(evt.data);
        handleMessage(msg);
      } catch(e) {}
    };
    
    _ws.onclose = function() {
      _ready = false;
      setTimeout(connect, 1000);
    };
    
    _ws.onerror = function() {};
  }
  
  function handleMessage(msg) {
    if (msg.type === 'reply' && _pendingInvokes.has(msg.id)) {
      var pending = _pendingInvokes.get(msg.id);
      _pendingInvokes.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error));
      else pending.resolve(msg.args ? msg.args[0] : undefined);
      return;
    }
    
    if (msg.type === 'event' && msg.channel) {
      var handlers = _listeners.get(msg.channel);
      if (handlers) {
        var event = { sender: { id: BUNTRON_WINDOW_ID } };
        handlers.forEach(function(fn) {
          try { fn(event, ...(msg.args || [])); } catch(e) { console.error(e); }
        });
      }
    }
  }
  
  // Buntron IPC Renderer API
  var ipcRenderer = {
    send: function(channel) {
      if (!_ready) return;
      var args = Array.prototype.slice.call(arguments, 1);
      _ws.send(JSON.stringify({
        id: ++_messageId,
        channel: channel,
        args: args,
        type: 'send'
      }));
    },
    
    invoke: function(channel) {
      var args = Array.prototype.slice.call(arguments, 1);
      return new Promise(function(resolve, reject) {
        if (!_ready) { reject(new Error('IPC not ready')); return; }
        var id = ++_messageId;
        _pendingInvokes.set(id, { resolve: resolve, reject: reject });
        _ws.send(JSON.stringify({
          id: id,
          channel: channel,
          args: args,
          type: 'invoke'
        }));
        setTimeout(function() {
          if (_pendingInvokes.has(id)) {
            _pendingInvokes.delete(id);
            reject(new Error('IPC invoke timeout'));
          }
        }, 30000);
      });
    },
    
    on: function(channel, listener) {
      if (!_listeners.has(channel)) _listeners.set(channel, new Set());
      _listeners.get(channel).add(listener);
      return ipcRenderer;
    },
    
    once: function(channel, listener) {
      var wrapper = function() {
        ipcRenderer.removeListener(channel, wrapper);
        listener.apply(null, arguments);
      };
      return ipcRenderer.on(channel, wrapper);
    },
    
    removeListener: function(channel, listener) {
      var handlers = _listeners.get(channel);
      if (handlers) handlers.delete(listener);
      return ipcRenderer;
    },
    
    removeAllListeners: function(channel) {
      if (channel) _listeners.delete(channel);
      else _listeners.clear();
      return ipcRenderer;
    }
  };
  
  // Expose to window
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'buntron', {
      value: Object.freeze({
        ipcRenderer: Object.freeze(ipcRenderer),
        windowId: BUNTRON_WINDOW_ID,
        platform: 'win32'
      }),
      writable: false,
      configurable: false
    });
  }
  
  connect();
})();
`;

    // Add user preload if specified
    if (this.options.webPreferences.preload) {
      try {
        const preloadPath = resolve(this.options.webPreferences.preload);
        if (existsSync(preloadPath)) {
          const userPreload = readFileSync(preloadPath, "utf-8");
          script += `\n;(function() { ${userPreload} })();\n`;
        }
      } catch {}
    }

    return script;
  }

  private setupHostEventListeners(app: BuntronApp): void {
    const hostWindowId = this.hostWindowId;

    app.host.on("windowClosed", (evt: any) => {
      if (evt.windowId === hostWindowId) {
        this._isDestroyed = true;
        BrowserWindow.allWindows.delete(this.id);
        app._windowDestroyed();
        this.emit("closed");
      }
    });

    app.host.on("windowResized", (evt: any) => {
      if (evt.windowId === hostWindowId) {
        this.options.width = evt.width;
        this.options.height = evt.height;
        if (evt.state === "minimized") this._state = "minimized";
        else if (evt.state === "maximized") this._state = "maximized";
        else this._state = "normal";
        this.emit("resize", evt.width, evt.height);
      }
    });

    app.host.on("windowMoved", (evt: any) => {
      if (evt.windowId === hostWindowId) {
        this.options.x = evt.x;
        this.options.y = evt.y;
        this.emit("move", evt.x, evt.y);
      }
    });

    app.host.on("windowFocused", (evt: any) => {
      if (evt.windowId === hostWindowId) {
        this.emit("focus");
      }
    });

    app.host.on("windowBlurred", (evt: any) => {
      if (evt.windowId === hostWindowId) {
        this.emit("blur");
      }
    });

    app.host.on("navigationCompleted", (evt: any) => {
      if (evt.windowId === hostWindowId) {
        this.emit("did-finish-load", evt.isSuccess);
      }
    });

    app.host.on("titleChanged", (evt: any) => {
      if (evt.windowId === hostWindowId) {
        this._title = evt.title;
        this.emit("page-title-updated", evt.title);
      }
    });

    // Handle web messages (IPC from renderer via postMessage)
    app.host.on("webMessage", (evt: any) => {
      if (evt.windowId === hostWindowId) {
        this.webContents.emit("ipc-message", evt.message);
      }
    });
  }
}

/**
 * WebContents - controls the web page in a BrowserWindow
 */
export class WebContents extends EventEmitter {
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    super();
    this.window = window;
  }

  /**
   * Execute JavaScript in the renderer
   */
  async executeJavaScript(code: string): Promise<any> {
    const app = BuntronApp.getInstance();
    if (!app) throw new Error("App not initialized");

    const result = await app.host.sendCommand("executeJs", {
      windowId: (this.window as any).hostWindowId,
      code,
    });

    // Parse JSON result from WebView2
    try {
      return JSON.parse(result.result);
    } catch {
      return result.result;
    }
  }

  /**
   * Navigate to a URL
   */
  async loadURL(url: string): Promise<void> {
    await this.window.loadURL(url);
  }

  /**
   * Open DevTools
   */
  openDevTools(): void {
    const app = BuntronApp.getInstance();
    if (!app) return;
    app.host.sendCommandFire("openDevTools", {
      windowId: (this.window as any).hostWindowId,
    });
  }

  /**
   * Close DevTools
   */
  closeDevTools(): void {
    // WebView2 doesn't support programmatically closing DevTools
    // This is a no-op
  }

  /**
   * Send a message to the renderer via IPC
   */
  send(channel: string, ...args: any[]): void {
    const app = BuntronApp.getInstance();
    if (!app) return;
    app.ipc.sendToWindow(this.window.id, channel, ...args);
  }

  /**
   * Post a message to the WebView2
   */
  postMessage(message: any): void {
    const app = BuntronApp.getInstance();
    if (!app) return;
    app.host.sendCommandFire("postMessage", {
      windowId: (this.window as any).hostWindowId,
      message: JSON.stringify(message),
    });
  }

  /**
   * Get the window ID
   */
  get id(): number {
    return this.window.id;
  }
}

export default BrowserWindow;
