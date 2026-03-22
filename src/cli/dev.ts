// ============================================================
// Buntron CLI - Dev Command
// ============================================================
// Starts the application in development mode.
//
// For static projects:
//   Runs main.ts directly, content server handles renderer.
//
// For framework projects (React/Vue via Vite):
//   1. Starts Vite dev server (HMR, fast refresh)
//   2. Sets BUNTRON_DEV_URL env var
//   3. Runs main.ts (which calls loadURL instead of loadFile)
// ============================================================

import { resolve, join, extname } from "path";
import { existsSync, watch } from "fs";
import { detectFramework, type FrameworkInfo } from "./framework";

let devServerProc: ReturnType<typeof Bun.spawn> | null = null;

export async function runDev(args: string[]) {
  const cwd = process.cwd();
  const mainFile = findMainFile(cwd, args[0]);

  if (!mainFile) {
    console.error("Error: Could not find main entry file.");
    console.error("Specify it in package.json 'main' or pass as argument: buntron dev src/main.ts");
    process.exit(1);
  }

  const fw = detectFramework(cwd);

  console.log(`
╔══════════════════════════════════════════════════╗
║          🚀 Buntron Dev Mode                     ║
╚══════════════════════════════════════════════════╝
`);
  console.log(`  Main:      ${mainFile}`);
  if (fw.type !== "static") {
    console.log(`  Renderer:  ${fw.framework} (${fw.type})`);
  } else {
    console.log(`  Renderer:  Static HTML`);
  }
  console.log("  Starting...\n");

  process.env.NODE_ENV = "development";
  process.env.BUNTRON_DEV = "1";
  process.env.BUNTRON_HMR = "1";

  // ── Start framework dev server if needed ─────────────────
  if (fw.type === "vite") {
    const devUrl = await startViteDevServer(cwd, fw);
    process.env.BUNTRON_DEV_URL = devUrl;
    console.log(`\n  Renderer dev server: ${devUrl}\n`);
  }

  // ── Setup cleanup ────────────────────────────────────────
  const cleanup = () => {
    if (devServerProc) {
      try { devServerProc.kill(); } catch {}
      devServerProc = null;
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(); });
  process.on("SIGTERM", () => { cleanup(); process.exit(); });

  // ── Watch for main process changes ───────────────────────
  setupWatcher(cwd, fw);

  // ── Run main process ─────────────────────────────────────
  try {
    await import(resolve(mainFile));
  } catch (err) {
    console.error("Failed to start:", err);
    cleanup();
    process.exit(1);
  }
}

// ── Vite Dev Server ──────────────────────────────────────────

async function startViteDevServer(cwd: string, fw: FrameworkInfo): Promise<string> {
  const viteEntry = resolve(cwd, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(viteEntry)) {
    console.error("  Error: vite not found in node_modules. Run: bun install");
    process.exit(1);
  }

  console.log("  Starting Vite dev server...\n");

  const proc = Bun.spawn(["bun", viteEntry, "--port", String(fw.devPort)], {
    cwd,
    stdout: "pipe",
    stderr: "inherit",
  });

  devServerProc = proc;

  return new Promise<string>((resolveUrl, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Vite dev server did not start within 30 seconds"));
    }, 30000);

    let output = "";
    let resolved = false;

    const reader = proc.stdout.getReader();

    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) {
          if (!resolved) reject(new Error("Vite dev server exited unexpectedly"));
          return;
        }
        const text = new TextDecoder().decode(value);
        output += text;
        process.stdout.write(text);

        if (!resolved) {
          // Vite outputs "Local:   http://localhost:5173/"
          const match = output.match(/Local:\s+(https?:\/\/localhost:\d+)/);
          if (match) {
            resolved = true;
            clearTimeout(timeout);
            resolveUrl(match[1]);
          }
        }
        pump();
      });
    }
    pump();
  });
}

// ── File Watcher ─────────────────────────────────────────────

function setupWatcher(cwd: string, fw: FrameworkInfo) {
  const srcDir = join(cwd, "src");
  if (!existsSync(srcDir)) return;

  const rendererExts = new Set([".html", ".css", ".js", ".jsx", ".tsx", ".vue", ".svg", ".png", ".jpg"]);

  watch(srcDir, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;

    // Skip renderer files — handled by Vite HMR or content server
    if (filename.startsWith("renderer")) return;

    const ext = extname(filename).toLowerCase();
    if (ext === ".ts" || ext === ".tsx") {
      console.log(`\n  [DEV] ${filename} changed — restart the app (Ctrl+C → bun run dev)\n`);
    }
  });
}

// ── Find Main File ───────────────────────────────────────────

function findMainFile(cwd: string, explicit?: string): string | null {
  if (explicit) {
    const p = resolve(cwd, explicit);
    if (existsSync(p)) return p;
  }

  try {
    const pkg = require(resolve(cwd, "package.json"));
    if (pkg.main) {
      const p = resolve(cwd, pkg.main);
      if (existsSync(p)) return p;
    }
  } catch {}

  for (const f of ["src/main.ts", "src/main.js", "src/index.ts", "main.ts", "index.ts"]) {
    const p = resolve(cwd, f);
    if (existsSync(p)) return p;
  }

  return null;
}
