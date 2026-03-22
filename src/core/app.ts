// ============================================================
// Buntron - Main Application Class
// ============================================================
// Equivalent to Electron's `app` module.
// Manages application lifecycle, windows, and global state.
// ============================================================

import { EventEmitter } from "events";
import { resolve, dirname } from "path";
import { HostProcessManager } from "../host/process-manager";
import { IPCWebSocketServer } from "../ipc/ws-server";
import { ContentServer } from "../server/content-server";
import { Kernel32 } from "../native/kernel32";
import { Shell32 } from "../native/shell32";

export class BuntronApp extends EventEmitter {
  private static instance: BuntronApp | null = null;

  /** Host process manager */
  readonly host: HostProcessManager;
  /** IPC WebSocket server */
  readonly ipc: IPCWebSocketServer;
  /** Content HTTP server */
  readonly contentServer: ContentServer;

  private _isReady: boolean = false;
  private _isQuitting: boolean = false;
  private _readyPromise: Promise<void>;
  private _readyResolve!: () => void;
  private _appName: string = "Buntron";
  private _appVersion: string = "1.0.0";
  private _appPath: string;
  private _userDataPath: string;
  private _singleInstanceMutex: number | null = null;
  private _windowCount: number = 0;

  constructor(appPath?: string) {
    super();

    if (BuntronApp.instance) {
      throw new Error(
        "Only one BuntronApp instance can exist. Use BuntronApp.getInstance()",
      );
    }
    BuntronApp.instance = this;

    this._appPath = appPath || process.cwd();
    const buntronRoot = this.findBuntronRoot();

    this._userDataPath = resolve(
      process.env.LOCALAPPDATA || process.env.APPDATA || "",
      "Buntron",
      this._appName,
    );

    this.host = new HostProcessManager(
      buntronRoot,
      resolve(this._userDataPath, "WebView2Data"),
    );
    this.ipc = new IPCWebSocketServer();
    this.contentServer = new ContentServer();

    this._readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve;
    });

    // Listen for host events
    this.setupHostEvents();
  }

  /**
   * Get the singleton app instance
   */
  static getInstance(): BuntronApp | null {
    return BuntronApp.instance;
  }

  /**
   * Initialize and start all subsystems
   */
  async start(): Promise<void> {
    if (this._isReady) return;

    this.emit("will-start");

    try {
      // Start IPC server
      const ipcPort = await this.ipc.start();

      // Start content server
      await this.contentServer.start();

      // Start host process
      await this.host.start();

      this._isReady = true;
      this._readyResolve();

      this.emit("ready");
    } catch (err) {
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * Wait until app is ready
   */
  async whenReady(): Promise<void> {
    return this._readyPromise;
  }

  /**
   * Check if app is ready
   */
  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Quit the application
   */
  async quit(): Promise<void> {
    if (this._isQuitting) return;
    this._isQuitting = true;

    this.emit("before-quit");

    // Cleanup
    try {
      await this.host.shutdown();
    } catch {}

    this.ipc.stop();
    this.contentServer.stop();

    // Release single instance mutex
    if (this._singleInstanceMutex) {
      Kernel32.releaseMutex(this._singleInstanceMutex);
      Kernel32.closeHandle(this._singleInstanceMutex);
      this._singleInstanceMutex = null;
    }

    this.emit("quit");
    BuntronApp.instance = null;

    // Exit process
    process.exit(0);
  }

  /**
   * Request single instance lock
   */
  requestSingleInstanceLock(): boolean {
    const mutexName = `Buntron_${this._appName}_SingleInstance`;
    const { handle, alreadyExists } = Kernel32.createMutex(mutexName);

    if (alreadyExists) {
      Kernel32.closeHandle(handle);
      return false;
    }

    this._singleInstanceMutex = handle;
    return true;
  }

  /**
   * Get/set application name
   */
  get name(): string {
    return this._appName;
  }

  set name(value: string) {
    this._appName = value;
  }

  /**
   * Get/set application version
   */
  get version(): string {
    return this._appVersion;
  }

  set version(value: string) {
    this._appVersion = value;
  }

  /**
   * Get application path
   */
  getAppPath(): string {
    return this._appPath;
  }

  /**
   * Get user data path
   */
  getUserDataPath(): string {
    return this._userDataPath;
  }

  /**
   * Set user data path (before start)
   */
  setUserDataPath(path: string): void {
    if (this._isReady)
      throw new Error("Cannot set user data path after app is ready");
    this._userDataPath = path;
  }

  /**
   * Get special folder paths
   */
  getPath(
    name: "appData" | "documents" | "desktop" | "temp" | "home" | "userData",
  ): string {
    switch (name) {
      case "appData":
        return Shell32.getAppDataPath();
      case "documents":
        return Shell32.getDocumentsPath();
      case "desktop":
        return Shell32.getDesktopPath();
      case "temp":
        return Kernel32.getTempPath();
      case "home":
        return process.env.USERPROFILE || "";
      case "userData":
        return this._userDataPath;
      default:
        throw new Error(`Unknown path name: ${name}`);
    }
  }

  /**
   * Track window count
   */
  _windowCreated(): void {
    this._windowCount++;
  }

  _windowDestroyed(): void {
    this._windowCount--;
    if (this._windowCount <= 0) {
      this.emit("window-all-closed");
    }
  }

  /**
   * Get IPC port
   */
  getIpcPort(): number {
    return this.ipc.getPort();
  }

  /**
   * Get IPC auth token
   */
  getIpcToken(): string {
    return this.ipc.getToken();
  }

  /**
   * Get content server port
   */
  getContentPort(): number {
    return this.contentServer.getPort();
  }

  // ---- Private ----

  private findBuntronRoot(): string {
    // 1) Check BUNTRON_ROOT env var (set by production builds/launchers)
    if (process.env.BUNTRON_ROOT) {
      return resolve(process.env.BUNTRON_ROOT);
    }

    // 2) For EXE builds: check if runtime/ folder exists next to the executable
    const exeDir = dirname(process.execPath);
    const runtimeHostExe = resolve(exeDir, "runtime", "BuntronHost.exe");
    if (require("fs").existsSync(runtimeHostExe)) {
      return exeDir;
    }

    // 3) Walk up from import.meta.url to find buntron package (dev/node_modules)
    let dir = dirname(new URL(import.meta.url).pathname);
    if (process.platform === "win32" && dir.startsWith("/")) {
      dir = dir.substring(1);
    }

    for (let i = 0; i < 10; i++) {
      try {
        const pkgPath = resolve(dir, "package.json");
        const pkg = require(pkgPath);
        if (pkg.name === "buntron") return dir;
      } catch {}
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    // 4) Fallback
    return resolve(
      dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
      "..",
      "..",
    );
  }

  private setupHostEvents(): void {
    this.host.on("allWindowsClosed", () => {
      this._windowCount = 0;
      this.emit("window-all-closed");
    });

    this.host.on("error", (err: Error) => {
      this.emit("error", err);
    });

    this.host.on("exit", (code: number) => {
      if (!this._isQuitting) {
        this.emit("host-crashed", code);
      }
    });

    this.host.on("stderr", (text: string) => {
      if (process.env.BUNTRON_DEBUG) {
        console.error("[Host]", text);
      }
    });
  }
}

export default BuntronApp;
