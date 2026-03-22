<div align="center">

# ⚡ Buntron

**Build native Windows desktop apps with Bun + WebView2**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D4.svg)](#requirements)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-f472b6.svg)](https://bun.sh)
[![WebView2](https://img.shields.io/badge/Renderer-WebView2-00C853.svg)](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

An Electron-like desktop framework for Windows, powered by [Bun](https://bun.sh) instead of Node.js.
Build native apps using HTML, CSS, and TypeScript — with blazing-fast startup, tiny footprint,
and a familiar Electron-style API.

</div>

---

## Why Buntron?

| Feature         | Buntron         | Electron              |
| --------------- | --------------- | --------------------- |
| **Runtime**     | Bun             | Node.js               |
| **Renderer**    | WebView2 (Edge) | Chromium (bundled)    |
| **Bundle size** | ~5-15 MB        | ~150-200+ MB          |
| **Startup**     | ~200ms          | ~1-3s                 |
| **Memory**      | ~30-50 MB       | ~100-300+ MB          |
| **Platform**    | Windows         | Windows, macOS, Linux |

- **No bundled Chromium** — uses the system WebView2 (pre-installed on Windows 10/11)
- **Bun runtime** — starts in milliseconds, native TypeScript support
- **Familiar API** — same patterns as Electron (`BrowserWindow`, `ipcMain`, `dialog`, etc.)
- **Tiny footprint** — 10-30x smaller than Electron apps

---

## Features

- 🚀 **Bun-powered** — 3-5x faster startup than Node.js
- 🌐 **WebView2 rendering** — Edge Chromium engine, always up-to-date
- ⚛️ **Framework support** — React, Vue, Svelte, Solid, or plain HTML/CSS/JS
- 🪟 **Native Win32 FFI** — Direct bindings to user32, kernel32, shell32, gdi32
- 📡 **IPC system** — WebSocket-based main↔renderer communication
- 🔥 **HMR** — Hot Module Reload via Vite during development
- 📦 **CLI tooling** — Scaffolding, dev server, 3 build modes (dev/debug/production)
- 🎨 **Rich API** — Dialogs, tray icons, menus, notifications, clipboard, global shortcuts
- 🏗️ **Zero npm dependencies** — Only needs Bun, .NET Framework (built-in), and WebView2 Runtime

---

## Requirements

| Requirement          | Details                                         |
| -------------------- | ----------------------------------------------- |
| **OS**               | Windows 10/11                                   |
| **Bun**              | v1.0+ ([install](https://bun.sh))               |
| **.NET Framework**   | 4.x (pre-installed on all modern Windows)       |
| **WebView2 Runtime** | Included with Windows 10 (1803+) and Windows 11 |

---

## Quick Start

```bash
# Install Buntron in your project
bun add github:tarkantoan/buntron

# Create a new app (pick a template)
bunx buntron init my-app             # Static HTML/CSS/JS
bunx buntron init my-app --react      # React + Vite + TypeScript
bunx buntron init my-app --vue        # Vue + Vite + TypeScript
cd my-app
bun install

# Start development (with Vite HMR for React/Vue)
bun run dev

# Build for production (dist/ folder, requires Bun to run)
bun run build

# Build standalone EXE (release/ folder, no Bun needed)
bun run build:exe

# Build debug EXE (with console window + DevTools)
bun run build:debug
```

---

## Architecture

Buntron uses a three-process architecture:

```
┌──────────────────────────────────────────────────┐
│                   Bun (Main Process)             │
│                                                  │
│  • App lifecycle        • IPC handlers           │
│  • Native FFI calls     • File system access     │
│  • WebSocket IPC server • Content HTTP server    │
│                                                  │
│        ┌──── stdin/stdout JSON ────┐             │
│        ▼                           ▼             │
│  ┌─────────────┐          ┌──────────────┐       │
│  │  C# Host    │          │  C# Host     │       │
│  │  (Window 1) │          │  (Window N)  │       │
│  │  WebView2   │          │  WebView2    │       │
│  └──────┬──────┘          └──────┬───────┘       │
│         │    WebSocket IPC       │               │
│         ▼                        ▼               │
│  ┌─────────────┐          ┌──────────────┐       │
│  │  Renderer 1 │          │  Renderer N  │       │
│  │  HTML/CSS/JS│          │  HTML/CSS/JS │       │
│  └─────────────┘          └──────────────┘       │
└──────────────────────────────────────────────────┘
```

1. **Main Process (Bun)** — Your TypeScript/JavaScript code runs here. Manages windows, handles IPC, accesses native APIs.
2. **Host Process (C#)** — Manages native windows with WebView2 controls. Communicates with Bun via JSON over stdin/stdout.
3. **Renderer Process (WebView2)** — Your HTML/CSS/JS UI. Communicates with main via WebSocket IPC.

---

## API Reference

### `BuntronApp`

The main application class. Controls lifecycle and global state.

```ts
import { BuntronApp } from "buntron";

const app = new BuntronApp();

await app.start(); // Initialize the framework
await app.whenReady(); // Wait until host process is ready

app.on("ready", () => {});
app.on("window-all-closed", () => app.quit());

app.requestSingleInstanceLock(); // Prevent multiple instances
app.getPath("documents"); // Get special folder paths
app.quit(); // Graceful shutdown
```

**Events:** `ready`, `window-all-closed`, `before-quit`, `will-quit`, `quit`, `second-instance`

**Methods:**
| Method | Description |
|---|---|
| `start()` | Start the app (compiles host if needed, starts servers) |
| `whenReady()` | Returns a promise that resolves when the app is ready |
| `quit()` | Quit the application |
| `requestSingleInstanceLock()` | Request single-instance mutex lock |
| `getPath(name)` | Get path to special directory (`documents`, `desktop`, `appData`, `temp`, etc.) |
| `getWindowCount()` | Get number of open windows |

---

### `BrowserWindow`

Create and control native windows.

```ts
import { BrowserWindow } from "buntron";

const win = new BrowserWindow({
  width: 1024,
  height: 768,
  title: "My App",
  center: true,
  frame: true,
  resizable: true,
  backgroundColor: "#1a1a2e",
  minWidth: 400,
  minHeight: 300,
  webPreferences: {
    devTools: process.env.NODE_ENV !== "production",
  },
});

// Load content
await win.loadFile("./renderer/index.html");
// or
await win.loadURL("https://example.com");

// Window manipulation
win.show();
win.hide();
win.minimize();
win.maximize();
win.restore();
win.focus();
win.close();

// Properties
win.setTitle("New Title");
win.setSize(800, 600);
win.setPosition(100, 100);
win.setFullScreen(true);
win.setAlwaysOnTop(true);
win.setOpacity(0.9);
win.flashFrame(true);

// Events
win.on("closed", () => console.log("Window closed"));
win.on("focus", () => console.log("Window focused"));
win.on("blur", () => console.log("Window blurred"));
win.on("maximize", () => console.log("Maximized"));
win.on("minimize", () => console.log("Minimized"));
win.on("resize", (w, h) => console.log(`Resized: ${w}x${h}`));
win.on("move", (x, y) => console.log(`Moved: ${x},${y}`));

// Static methods
BrowserWindow.getAllWindows();
BrowserWindow.getFocusedWindow();
BrowserWindow.fromId(1);
```

**Constructor Options:**

| Option                    | Type    | Default   | Description                  |
| ------------------------- | ------- | --------- | ---------------------------- |
| `width`                   | number  | 800       | Window width in pixels       |
| `height`                  | number  | 600       | Window height in pixels      |
| `x`                       | number  | -         | X position                   |
| `y`                       | number  | -         | Y position                   |
| `title`                   | string  | "Buntron" | Window title                 |
| `show`                    | boolean | true      | Show window on creation      |
| `center`                  | boolean | false     | Center on screen             |
| `frame`                   | boolean | true      | Show window frame            |
| `resizable`               | boolean | true      | Allow resizing               |
| `minimizable`             | boolean | true      | Allow minimizing             |
| `maximizable`             | boolean | true      | Allow maximizing             |
| `fullscreen`              | boolean | false     | Start in fullscreen          |
| `alwaysOnTop`             | boolean | false     | Keep on top of other windows |
| `backgroundColor`         | string  | "#FFFFFF" | Background color (hex)       |
| `opacity`                 | number  | 1.0       | Window opacity (0-1)         |
| `minWidth`                | number  | 0         | Minimum width                |
| `minHeight`               | number  | 0         | Minimum height               |
| `maxWidth`                | number  | 0         | Maximum width (0=unlimited)  |
| `maxHeight`               | number  | 0         | Maximum height (0=unlimited) |
| `webPreferences.devTools` | boolean | false     | Enable DevTools              |

---

### `ipcMain`

Handle IPC messages from renderer processes (main process side).

```ts
import { ipcMain } from "buntron";

// Handle invoke calls (returns response)
ipcMain.handle("get-data", async (event, ...args) => {
  return { items: [1, 2, 3] };
});

// Handle one-time invoke
ipcMain.handleOnce("init", async (event) => {
  return { ready: true };
});

// Listen for messages (no response)
ipcMain.on("log", (event, message) => {
  console.log("Renderer says:", message);
});

// Send to specific window
ipcMain.sendTo(windowId, "update", data);

// Send to all windows
ipcMain.sendToAll("broadcast", data);

// Remove handler
ipcMain.removeHandler("get-data");
```

---

### Renderer API (`window.buntron`)

The preload script exposes `window.buntron` in the renderer:

```js
// Invoke a handler in main process (returns promise)
const result = await window.buntron.ipc.invoke("channel-name", arg1, arg2);

// Send a message (fire-and-forget)
window.buntron.ipc.send("channel-name", data);

// Listen for messages from main
window.buntron.ipc.on("event-name", (data) => {
  console.log("Got event:", data);
});

// Listen once
window.buntron.ipc.once("init", (config) => {
  console.log("Config:", config);
});

// Remove listener
window.buntron.ipc.removeListener("event-name", handler);
window.buntron.ipc.removeAllListeners("event-name");
```

---

### `dialog`

Show native dialogs.

```ts
import { dialog } from "buntron";

// Message box
const buttonIndex = await dialog.showMessageBox({
  title: "Confirm",
  message: "Are you sure?",
  detail: "This action cannot be undone.",
  type: "warning", // "info" | "warning" | "error" | "question"
  buttons: ["Yes", "No"],
});

// Error box
dialog.showErrorBox("Error", "Something went wrong!");

// Open file dialog
const files = await dialog.showOpenDialog({
  title: "Select files",
  defaultPath: "C:\\Users",
  multiSelections: true,
  filters: [
    { name: "Images", extensions: ["png", "jpg", "gif"] },
    { name: "All Files", extensions: ["*"] },
  ],
});

// Save file dialog
const savePath = await dialog.showSaveDialog({
  title: "Save as",
  defaultPath: "document.txt",
  filters: [{ name: "Text", extensions: ["txt"] }],
});
```

---

### `Tray`

Create system tray icons.

```ts
import { Tray } from "buntron";

const tray = new Tray("path/to/icon.ico", "Tooltip text");

tray.setContextMenu([
  { id: "open", label: "Open App" },
  { type: "separator" },
  { id: "quit", label: "Quit" },
]);

tray.on("click", () => console.log("Tray clicked"));
tray.on("double-click", () => mainWindow.show());
tray.on("menu-click", (menuId) => {
  if (menuId === "quit") app.quit();
});

tray.setToolTip("Updated tooltip");
tray.displayBalloon("Title", "Balloon message");
tray.destroy();
```

---

### `Menu` & `MenuItem`

Build application menus.

```ts
import { Menu, MenuItem } from "buntron";

const menu = Menu.buildFromTemplate([
  {
    label: "File",
    submenu: [
      { label: "New", accelerator: "Ctrl+N", click: () => createWindow() },
      { label: "Open", accelerator: "Ctrl+O", click: () => openFile() },
      { type: "separator" },
      { label: "Exit", accelerator: "Alt+F4", click: () => app.quit() },
    ],
  },
  {
    label: "Help",
    submenu: [{ label: "About", click: () => showAbout() }],
  },
]);

// Programmatic menu building
const menu = new Menu();
menu.append(new MenuItem({ label: "Item 1", click: () => {} }));
menu.append(new MenuItem({ type: "separator" }));
menu.append(new MenuItem({ label: "Item 2", type: "checkbox", checked: true }));
```

---

### `Notification`

Show Windows toast notifications.

```ts
import { Notification } from "buntron";

const notif = new Notification({
  title: "Hello!",
  body: "This is a notification from Buntron.",
  silent: false,
});

notif.show();
notif.on("click", () => mainWindow.focus());
notif.on("close", () => console.log("Notification closed"));
```

---

### `shell`

Open external resources.

```ts
import { shell } from "buntron";

await shell.openExternal("https://bun.sh");
await shell.openPath("C:\\Users\\Documents");
shell.showItemInFolder("C:\\Users\\file.txt");
shell.beep();
await shell.trashItem("C:\\Users\\old-file.txt");
```

---

### `clipboard`

Read/write system clipboard.

```ts
import { clipboard } from "buntron";

clipboard.writeText("Hello from Buntron!");
const text = clipboard.readText();
clipboard.clear();
```

---

### `screen`

Get display information.

```ts
import { screen } from "buntron";

const display = screen.getPrimaryDisplay();
// { width, height, scaleFactor }

const size = screen.getScreenSize();
// { width, height }

const cursor = screen.getCursorScreenPoint();
// { x, y }

const dpi = screen.getDpiScale();
```

---

### `globalShortcut`

Register global keyboard shortcuts.

```ts
import { globalShortcut } from "buntron";

// Electron-style accelerator strings
globalShortcut.register("Ctrl+Shift+I", () => {
  console.log("Shortcut triggered!");
});

globalShortcut.register("Alt+Space", () => {
  toggleWindow();
});

const isRegistered = globalShortcut.isRegistered("Ctrl+Shift+I");

globalShortcut.unregister("Ctrl+Shift+I");
globalShortcut.unregisterAll();
```

---

### `powerMonitor`

Monitor system power state.

```ts
import { powerMonitor } from "buntron";

powerMonitor.start();

powerMonitor.on("on-ac", () => console.log("Plugged in"));
powerMonitor.on("on-battery", () => console.log("On battery"));
powerMonitor.on("low-battery", () => console.log("Battery low!"));

const state = powerMonitor.getSystemPowerState();
// { acPower, batteryLife, batteryPercent, charging }

powerMonitor.stop();
```

---

## CLI Commands

```
buntron init [name]            Create a new project (static HTML template)
buntron init [name] --react    Create with React + Vite + TypeScript
buntron init [name] --vue      Create with Vue + Vite + TypeScript
buntron dev                    Start development (with Vite HMR for frameworks)
buntron build                  Production build → dist/ (requires Bun to run)
buntron build --exe            Standalone EXE build → release/ (no Bun needed)
buntron build --exe --debug    Debug EXE build → release/ (console + DevTools)
buntron package                Alias for build --exe
buntron setup                  Run setup / install WebView2 SDK
buntron help                   Show help
buntron version                Show version
```

### `buntron init [name]`

Scaffolds a new project. Supports three templates:

| Flag       | Template                   | Includes                           |
| ---------- | -------------------------- | ---------------------------------- |
| *(none)*   | Static HTML/CSS/JS         | Plain renderer files               |
| `--react`  | React + Vite + TypeScript  | Vite, React 19, JSX, HMR          |
| `--vue`    | Vue + Vite + TypeScript    | Vite, Vue 3, SFC support, HMR     |

**Static template:**
```
my-app/
├── src/
│   ├── main.ts           # Main process entry
│   ├── preload.ts        # Preload script
│   └── renderer/
│       ├── index.html    # UI entry point
│       ├── styles.css    # Styles
│       └── renderer.js   # Renderer script
├── assets/
├── package.json
└── tsconfig.json
```

**React / Vue template:**
```
my-app/
├── src/
│   ├── main.ts           # Main process entry
│   ├── preload.ts        # Preload script
│   ├── buntron.d.ts      # Type definitions
│   └── renderer/
│       ├── index.html
│       ├── index.css
│       ├── App.tsx / App.vue
│       └── main.tsx / main.ts
├── assets/
├── vite.config.ts
├── package.json
└── tsconfig.json
```

Use `buntron init .` to scaffold in the current directory.

### `buntron dev`

Starts the app in development mode:

- **Framework projects (React/Vue):** Starts Vite dev server with HMR, loads `http://localhost:5173` in WebView2
- **Static projects:** Serves files directly with file watcher
- Auto-restarts main process on TypeScript changes
- DevTools enabled (if `devTools: isDev` pattern is used)

### `buntron build`

Builds the app for production into `dist/`:

- **Framework projects:** Runs Vite build for renderer → `dist/renderer/`
- **Static projects:** Copies renderer files → `dist/renderer/`
- Bundles main process with `Bun.build()`
- Builds preload script
- Copies Buntron runtime (BuntronHost.exe + DLLs)
- Creates `.bat` and `.ps1` launchers
- Requires Bun installed on the target machine to run

```
dist/
├── main.js              # Bundled main process
├── preload.js           # Preload script
├── renderer/            # Built renderer files
├── runtime/             # BuntronHost.exe + DLLs
├── assets/
├── myapp.bat            # Windows launcher
└── myapp.ps1            # PowerShell launcher
```

### `buntron build --exe`

Builds a standalone production EXE into `release/`:

- Everything from `buntron build`, plus:
- Compiles into a single `.exe` with `bun build --compile`
- Patches PE header to GUI subsystem (no console window)
- Sets `BUNTRON_ROOT` and `NODE_ENV=production` automatically
- DevTools disabled

```
release/
├── myapp.exe            # Standalone EXE (~110 MB, includes Bun runtime)
├── renderer/            # Built renderer (React/Vue/static)
├── runtime/             # BuntronHost.exe + DLLs (~0.8 MB)
└── assets/
```

Distribute: ZIP the `release/` folder. Target needs WebView2 Runtime (pre-installed on Win10/11).

### `buntron build --exe --debug`

Builds a debug EXE into `release/`:

- Same as `--exe` but **keeps console window** (no PE GUI patch)
- Enables **DevTools** (`BUNTRON_DEBUG=1`)
- Useful for debugging production builds

### `buntron package`

Alias for `buntron build --exe`.

---

## Project Structure

Buntron supports both static and framework-based projects.

### Static project (default)

```
my-app/
├── src/
│   ├── main.ts              # Main process (Bun)
│   ├── preload.ts           # Preload script
│   └── renderer/
│       ├── index.html       # HTML entry
│       ├── styles.css       # CSS
│       └── renderer.js      # Client-side JS
├── assets/
├── package.json
└── tsconfig.json
```

### React / Vue project

```
my-app/
├── src/
│   ├── main.ts              # Main process (Bun)
│   ├── preload.ts           # Preload script
│   ├── buntron.d.ts         # Buntron type definitions
│   └── renderer/
│       ├── index.html       # HTML entry
│       ├── index.css        # CSS
│       ├── App.tsx / App.vue # Root component
│       └── main.tsx / main.ts
├── assets/
├── vite.config.ts
├── package.json
└── tsconfig.json
```

### Main Process (`src/main.ts`)

The main process template works for all project types (static, React, Vue):

```ts
import { BuntronApp, BrowserWindow, ipcMain } from "buntron";
import { resolve } from "path";

const isDev = process.env.NODE_ENV !== "production";
const isDebug = process.env.BUNTRON_DEBUG === "1";
const appRoot = process.env.BUNTRON_ROOT || __dirname;
const devUrl = process.env.BUNTRON_DEV_URL;       // Set automatically in dev mode
const app = new BuntronApp();

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "My App",
    webPreferences: {
      preload: resolve(appRoot, isDev ? "preload.ts" : "preload.js"),
      devTools: isDev || isDebug,
    },
  });

  // Dev mode: load from Vite dev server | Production: load built files
  if (devUrl) {
    await win.loadURL(devUrl);
  } else {
    await win.loadFile(resolve(appRoot, "renderer", "index.html"));
  }

  if (isDev || isDebug) win.webContents.openDevTools();

  ipcMain.handle("greet", async (_event, name) => {
    return `Hello, ${name}!`;
  });
}

app.on("window-all-closed", () => app.quit());

await app.start();
await createWindow();
```

**Key environment variables:**

| Variable          | Set by          | Purpose                                     |
| ----------------- | --------------- | ------------------------------------------- |
| `BUNTRON_DEV_URL` | `buntron dev`   | Vite dev server URL (e.g. `http://localhost:5173`) |
| `BUNTRON_ROOT`    | `buntron build` | Root path for resolving files in production |
| `BUNTRON_DEBUG`   | `--debug` flag  | Enables DevTools in production EXE          |
| `NODE_ENV`        | build commands  | `"production"` in builds                    |

---

## Trade-offs

- **Windows only** (for now) — WebView2 and Win32 FFI are Windows-specific
- **WebView2 required** — Pre-installed on Windows 10/11, may need install on older systems
- **Newer ecosystem** — Bun is newer than Node.js, but rapidly maturing

---

## Troubleshooting

### WebView2 Runtime not found

WebView2 Runtime is included with Windows 10 (version 1803+) and Windows 11. If it's missing:

1. Download from [Microsoft WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)
2. Install the Evergreen Runtime
3. Run `bunx buntron setup` to verify

### C# compiler (csc.exe) not found

Buntron uses `csc.exe` from .NET Framework 4.x. It should be at:

```
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
```

or

```
C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe
```

If missing, install [.NET Framework 4.8](https://dotnet.microsoft.com/download/dotnet-framework) (usually pre-installed on Windows 10+).

### Host compilation fails

Run setup manually:

```bash
bunx buntron setup
```

This will:

1. Check for csc.exe
2. Download WebView2 SDK NuGet package
3. Compile the host process
4. Verify WebView2 Runtime

### Port conflicts

Buntron uses dynamic ports for the content server and WebSocket IPC. If you have conflicts, the framework will automatically find available ports.

---

## Development

### Building from source

```bash
git clone https://github.com/tarkantoan/buntron.git
cd buntron
bun install          # Downloads WebView2 SDK & compiles host automatically
```

### Running the example

```bash
cd examples/hello-world
bun run main.ts
```

### File structure

```
buntron/
├── src/
│   ├── native/          # Win32 FFI bindings
│   │   ├── types.ts     # Constants, interfaces
│   │   ├── ffi-helpers.ts
│   │   ├── user32.ts
│   │   ├── kernel32.ts
│   │   ├── shell32.ts
│   │   └── gdi32.ts
│   ├── host/            # C# WebView2 host
│   │   ├── webview-host.cs
│   │   ├── compiler.ts
│   │   └── process-manager.ts
│   ├── ipc/             # IPC system
│   │   ├── protocol.ts
│   │   ├── ws-server.ts
│   │   └── channels.ts
│   ├── core/            # Framework classes
│   │   ├── app.ts
│   │   ├── browser-window.ts
│   │   ├── ipc-main.ts
│   │   ├── dialog.ts
│   │   ├── tray.ts
│   │   ├── menu.ts
│   │   ├── notification.ts
│   │   ├── shell.ts
│   │   ├── clipboard.ts
│   │   ├── screen.ts
│   │   ├── global-shortcut.ts
│   │   └── power-monitor.ts
│   ├── server/
│   │   └── content-server.ts
│   ├── renderer/
│   │   └── buntron-preload.ts
│   ├── cli/
│   │   ├── index.ts
│   │   ├── init.ts
│   │   ├── dev.ts
│   │   ├── build.ts
│   │   ├── package-cmd.ts
│   │   └── framework.ts   # Framework auto-detection
│   └── index.ts         # Main exports
├── bin/
│   └── buntron.ts       # CLI entry point
├── scripts/
│   └── setup.ts         # Install/setup script
├── examples/
│   └── hello-world/
│       ├── main.ts
│       └── index.html
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
```

---

## License

[MIT](LICENSE)

---

<div align="center">

Built with ⚡ Bun + 🌐 WebView2 + 🪟 Win32

[GitHub](https://github.com/tarkantoan/buntron) · [Issues](https://github.com/tarkantoan/buntron/issues) · [Bun](https://bun.sh)

</div>
