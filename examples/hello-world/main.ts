// ============================================================
// Buntron Example - Hello World
// ============================================================

import {
  BuntronApp,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  shell,
  Notification,
} from "../../src/index";
import { resolve } from "path";

const app = new BuntronApp();

async function createMainWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: "Buntron - Hello World",
    center: true,
    backgroundColor: "#0f0f13",
    webPreferences: {
      devTools: true,
    },
  });

  await win.loadFile(resolve(__dirname, "index.html"));
  return win;
}

async function main() {
  // Single instance check
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.log("Another instance is already running.");
    process.exit(0);
  }

  // Start app
  await app.start();
  console.log("App started!");

  // Create main window
  const mainWindow = await createMainWindow();

  // Create system tray
  const tray = new Tray("", "Buntron Example");
  tray.setContextMenu([
    { id: "show", label: "Show Window" },
    { type: "separator" },
    { id: "quit", label: "Quit" },
  ]);

  tray.on("menu-click", (id: string) => {
    if (id === "show") mainWindow.show();
    else if (id === "quit") app.quit();
  });

  tray.on("double-click", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // IPC handlers
  ipcMain.handle("ping", async (_event, msg) => {
    return `Pong: ${msg} (from Bun ${Bun.version})`;
  });

  ipcMain.handle("get-system-info", async () => {
    return {
      bunVersion: Bun.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  });

  ipcMain.handle("show-dialog", async () => {
    const result = await dialog.showMessageBox({
      title: "Buntron Dialog",
      message: "Hello from Buntron!",
      detail: "This is a native Win32 dialog.",
      type: "info",
      buttons: ["OK"],
    });
    return result;
  });

  ipcMain.handle("open-file", async () => {
    return dialog.showOpenDialog({
      title: "Select a file",
      filters: [
        { name: "All Files", extensions: ["*"] },
        { name: "Images", extensions: ["png", "jpg", "gif"] },
        { name: "Documents", extensions: ["pdf", "txt", "doc"] },
      ],
    });
  });

  ipcMain.handle("show-notification", async (_event, title, body) => {
    const notif = new Notification({ title, body });
    notif.show();
    return true;
  });

  ipcMain.handle("open-url", async (_event, url) => {
    await shell.openExternal(url);
    return true;
  });

  // Quit when all windows closed
  app.on("window-all-closed", () => {
    tray.destroy();
    app.quit();
  });

  console.log("Main window created. App is running.");
}

main().catch(console.error);
