// ============================================================
// Buntron CLI - Dev Command
// ============================================================
// Starts the application in development mode with:
// - Hot Module Reload (HMR)
// - File watching
// - Auto-restart on main process changes
// ============================================================

import { resolve, join, extname } from "path";
import { existsSync, watch } from "fs";
import { BuntronApp } from "../core/app";

export async function runDev(args: string[]) {
  const cwd = process.cwd();
  const mainFile = findMainFile(cwd, args[0]);

  if (!mainFile) {
    console.error("Error: Could not find main entry file.");
    console.error(
      "Specify it in package.json 'main' or pass as argument: buntron dev src/main.ts",
    );
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════╗
║          🚀 Buntron Dev Mode                     ║
╚══════════════════════════════════════════════════╝
`);
  console.log(`Main: ${mainFile}`);
  console.log("Starting...\n");

  process.env.NODE_ENV = "development";
  process.env.BUNTRON_DEV = "1";

  // Start file watcher for HMR
  const watchDirs = [
    join(cwd, "src"),
    join(cwd, "public"),
    join(cwd, "assets"),
  ].filter((d) => existsSync(d));

  let restartTimer: Timer | null = null;
  let app: BuntronApp | null = null;

  const rendererExtensions = new Set([
    ".html",
    ".css",
    ".js",
    ".svg",
    ".png",
    ".jpg",
  ]);

  for (const dir of watchDirs) {
    watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const ext = extname(filename).toLowerCase();

      if (rendererExtensions.has(ext)) {
        // Hot reload renderer files
        console.log(`[HMR] ${filename} changed, reloading...`);
        if (app) {
          app.contentServer.notifyHMR(filename);
        }
      } else if (ext === ".ts" || ext === ".tsx") {
        // Restart main process on TypeScript changes
        console.log(`[DEV] ${filename} changed, restarting...`);
        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = setTimeout(async () => {
          try {
            if (app) {
              await app.quit();
            }
          } catch {}
          // Re-spawn the process
          const proc = Bun.spawn(["bun", "run", mainFile], {
            cwd,
            stdio: ["inherit", "inherit", "inherit"],
            env: { ...process.env },
          });
        }, 300);
      }
    });
  }

  // Import and run the main file
  try {
    // Enable HMR on the content server
    process.env.BUNTRON_HMR = "1";

    await import(resolve(mainFile));
  } catch (err) {
    console.error("Failed to start:", err);
    process.exit(1);
  }
}

function findMainFile(cwd: string, explicit?: string): string | null {
  if (explicit) {
    const path = resolve(cwd, explicit);
    if (existsSync(path)) return path;
  }

  // Try package.json main
  try {
    const pkg = require(resolve(cwd, "package.json"));
    if (pkg.main) {
      const mainPath = resolve(cwd, pkg.main);
      if (existsSync(mainPath)) return mainPath;
    }
  } catch {}

  // Try common paths
  const candidates = [
    "src/main.ts",
    "src/main.js",
    "src/index.ts",
    "src/index.js",
    "main.ts",
    "main.js",
    "index.ts",
    "index.js",
  ];

  for (const candidate of candidates) {
    const path = resolve(cwd, candidate);
    if (existsSync(path)) return path;
  }

  return null;
}
