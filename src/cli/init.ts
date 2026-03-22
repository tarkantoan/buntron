// ============================================================
// Buntron CLI - Init Command
// ============================================================
// Scaffolds a new Buntron project with template support.
//
//   buntron init my-app              → static HTML/CSS/JS
//   buntron init my-app --react      → Vite + React + TypeScript
//   buntron init my-app --vue        → Vite + Vue + TypeScript
//   buntron init my-app --template X → explicit template
// ============================================================

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join, basename } from "path";

type Template = "static" | "react" | "vue";

export async function runInit(args: string[]) {
  // ── Parse args ─────────────────────────────────────────────
  let template: Template = "static";
  const cleanArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--react") template = "react";
    else if (a === "--vue") template = "vue";
    else if (a === "--template" && args[i + 1]) {
      template = args[++i] as Template;
    } else {
      cleanArgs.push(a);
    }
  }

  if (!["static", "react", "vue"].includes(template)) {
    console.error(`Unknown template: ${template}`);
    console.error("Available: static, react, vue");
    process.exit(1);
  }

  const input = cleanArgs[0] || "my-buntron-app";
  const initInPlace = input === ".";
  const targetDir = resolve(process.cwd(), input);
  const projectName = initInPlace ? basename(process.cwd()) : input;

  console.log(`\n⚡ Creating Buntron project: ${projectName}  [${template}]\n`);

  if (!initInPlace && existsSync(targetDir)) {
    console.error(`Error: Directory '${projectName}' already exists.`);
    process.exit(1);
  }

  // ── Create directories ─────────────────────────────────────
  const dirs = ["", "src", "src/renderer", "assets"];
  for (const dir of dirs) {
    mkdirSync(join(targetDir, dir), { recursive: true });
  }

  // ── Write common files ─────────────────────────────────────
  writePackageJson(targetDir, projectName, template);
  writeTsConfig(targetDir, template);
  writeGitignore(targetDir);
  writeMainTs(targetDir, projectName);
  writePreloadTs(targetDir, projectName);

  // ── Write template-specific files ──────────────────────────
  switch (template) {
    case "react":
      writeViteConfig(targetDir, "react");
      writeReactRenderer(targetDir, projectName);
      break;
    case "vue":
      writeViteConfig(targetDir, "vue");
      writeVueRenderer(targetDir, projectName);
      break;
    default:
      writeStaticRenderer(targetDir, projectName);
      break;
  }

  // ── Success message ────────────────────────────────────────
  const tmplLabel =
    template === "react"
      ? "React + Vite"
      : template === "vue"
        ? "Vue + Vite"
        : "Static HTML";

  console.log(`✅ Project created successfully!  [${tmplLabel}]

📁 ${projectName}/
├── src/
│   ├── main.ts            # Buntron main process
│   ├── preload.ts         # Preload script (IPC bridge)
│   └── renderer/          # ${tmplLabel} renderer
│       └── index.html
${template !== "static" ? "├── vite.config.ts         # Vite configuration\n" : ""}├── package.json
├── tsconfig.json
└── .gitignore

Next steps:
  ${initInPlace ? "" : `cd ${projectName}\n  `}bun install
  bun run dev
`);
}

// ═══════════════════════════════════════════════════════════════
//  Common Files
// ═══════════════════════════════════════════════════════════════

function writePackageJson(dir: string, name: string, template: Template) {
  const base: any = {
    name,
    version: "1.0.0",
    private: true,
    type: "module",
    main: "src/main.ts",
    scripts: {
      dev: "buntron dev",
      build: "buntron build",
      "build:exe": "buntron build --exe",
      "build:debug": "buntron build --exe --debug",
    },
    dependencies: {
      buntron: "github:tarkantoan/buntron",
    } as Record<string, string>,
    devDependencies: {} as Record<string, string>,
  };

  if (template === "react") {
    base.dependencies["react"] = "^19.0.0";
    base.dependencies["react-dom"] = "^19.0.0";
    base.devDependencies["@types/react"] = "^19.0.0";
    base.devDependencies["@types/react-dom"] = "^19.0.0";
    base.devDependencies["@vitejs/plugin-react"] = "^4.3.0";
    base.devDependencies["vite"] = "^6.0.0";
    base.devDependencies["typescript"] = "^5.7.0";
  } else if (template === "vue") {
    base.dependencies["vue"] = "^3.5.0";
    base.devDependencies["@vitejs/plugin-vue"] = "^5.2.0";
    base.devDependencies["vite"] = "^6.0.0";
    base.devDependencies["typescript"] = "^5.7.0";
    base.devDependencies["vue-tsc"] = "^2.2.0";
  }

  if (Object.keys(base.devDependencies).length === 0) {
    delete base.devDependencies;
  }

  writeFileSync(join(dir, "package.json"), JSON.stringify(base, null, 2));
}

function writeTsConfig(dir: string, template: Template) {
  const cfg: any = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      types: ["bun-types"],
    },
    include: ["src/**/*.ts"],
  };

  if (template === "react") {
    cfg.compilerOptions.jsx = "react-jsx";
    cfg.include = ["src/**/*.ts", "src/**/*.tsx"];
  } else if (template === "vue") {
    cfg.compilerOptions.jsx = "preserve";
    cfg.include = ["src/**/*.ts", "src/**/*.vue"];
  }

  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(cfg, null, 2));
}

function writeGitignore(dir: string) {
  writeFileSync(
    join(dir, ".gitignore"),
    `node_modules/
dist/
release/
*.exe
.DS_Store
Thumbs.db
`,
  );
}

function writeMainTs(dir: string, name: string) {
  writeFileSync(
    join(dir, "src", "main.ts"),
    `// ============================================================
// ${name} - Main Process
// ============================================================
import { BuntronApp, BrowserWindow, ipcMain } from "buntron";
import { resolve } from "path";

const isDev = process.env.NODE_ENV !== "production";
const isDebug = process.env.BUNTRON_DEBUG === "1";
const appRoot = process.env.BUNTRON_ROOT || __dirname;
const app = new BuntronApp();

async function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: "${name}",
    webPreferences: {
      preload: resolve(appRoot, isDev ? "preload.ts" : "preload.js"),
      devTools: isDev || isDebug,
    },
  });

  // Dev mode: load from framework dev server (Vite etc.)
  // Production: load built renderer files from disk
  const devUrl = process.env.BUNTRON_DEV_URL;
  if (devUrl) {
    await win.loadURL(devUrl);
  } else {
    await win.loadFile(resolve(appRoot, "renderer", "index.html"));
  }

  if (isDev || isDebug) {
    win.webContents.openDevTools();
  }

  win.on("closed", () => console.log("Window closed"));
  return win;
}

async function main() {
  await app.start();
  console.log("${name} is ready!");

  const mainWindow = await createWindow();

  ipcMain.handle("ping", async (event, message) => {
    return "pong: " + message;
  });

  ipcMain.handle("get-app-info", async () => ({
    name: "${name}",
    version: "1.0.0",
    platform: process.platform,
    isDev,
    isDebug,
  }));

  app.on("window-all-closed", () => app.quit());
}

main().catch(console.error);
`,
  );
}

function writePreloadTs(dir: string, name: string) {
  writeFileSync(
    join(dir, "src", "preload.ts"),
    `// ============================================================
// ${name} - Preload Script
// ============================================================
// Runs in the renderer context before page scripts.
// window.buntron is available after this loads.

console.log("[Preload] Buntron preload loaded");
`,
  );
}

// ═══════════════════════════════════════════════════════════════
//  Vite Config (React / Vue)
// ═══════════════════════════════════════════════════════════════

function writeViteConfig(dir: string, template: "react" | "vue") {
  const plugin =
    template === "react"
      ? `import react from "@vitejs/plugin-react";\n`
      : `import vue from "@vitejs/plugin-vue";\n`;

  const pluginCall = template === "react" ? "react()" : "vue()";

  writeFileSync(
    join(dir, "vite.config.ts"),
    `import { defineConfig } from "vite";
${plugin}
export default defineConfig({
  root: "src/renderer",
  plugins: [${pluginCall}],
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
`,
  );
}

// ═══════════════════════════════════════════════════════════════
//  React Template
// ═══════════════════════════════════════════════════════════════

function writeReactRenderer(dir: string, name: string) {
  const rendererDir = join(dir, "src", "renderer");

  // index.html (Vite entry)
  writeFileSync(
    join(rendererDir, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
`,
  );

  // main.tsx (React entry)
  writeFileSync(
    join(rendererDir, "main.tsx"),
    `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  );

  // App.tsx
  writeFileSync(
    join(rendererDir, "App.tsx"),
    `import React, { useState, useEffect } from "react";

function App() {
  const [count, setCount] = useState(0);
  const [pong, setPong] = useState("");
  const [appInfo, setAppInfo] = useState<any>(null);

  useEffect(() => {
    // Wait for Buntron IPC bridge
    const init = () => {
      if (window.buntron) {
        window.buntron.ipc.invoke("get-app-info").then(setAppInfo).catch(() => {});
      }
    };
    if (window.buntron) init();
    else window.addEventListener("buntron-ipc-ready", init);
    return () => window.removeEventListener("buntron-ipc-ready", init);
  }, []);

  const handlePing = async () => {
    if (!window.buntron) return;
    const result = await window.buntron.ipc.invoke("ping", \`count=\${count}\`);
    setPong(result);
  };

  return (
    <div className="app">
      <header>
        <h1>⚡ ${name}</h1>
        <p className="subtitle">Buntron + React</p>
      </header>

      <div className="cards">
        <div className="card">
          <h2>Counter</h2>
          <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
        </div>

        <div className="card">
          <h2>IPC Test</h2>
          <button onClick={handlePing}>Send Ping</button>
          {pong && <pre>{pong}</pre>}
        </div>

        {appInfo && (
          <div className="card">
            <h2>App Info</h2>
            <pre>{JSON.stringify(appInfo, null, 2)}</pre>
          </div>
        )}
      </div>

      <footer>Built with Buntron + React</footer>
    </div>
  );
}

export default App;
`,
  );

  // App.css
  writeFileSync(join(rendererDir, "App.css"), CSS_THEME);

  // TypeScript declaration for window.buntron
  writeFileSync(join(rendererDir, "buntron.d.ts"), BUNTRON_DTS);
}

// ═══════════════════════════════════════════════════════════════
//  Vue Template
// ═══════════════════════════════════════════════════════════════

function writeVueRenderer(dir: string, name: string) {
  const rendererDir = join(dir, "src", "renderer");

  // index.html
  writeFileSync(
    join(rendererDir, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
`,
  );

  // main.ts (Vue entry)
  writeFileSync(
    join(rendererDir, "main.ts"),
    `import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

createApp(App).mount("#app");
`,
  );

  // App.vue
  writeFileSync(
    join(rendererDir, "App.vue"),
    `<script setup lang="ts">
import { ref, onMounted } from "vue";

const count = ref(0);
const pong = ref("");
const appInfo = ref<any>(null);

const handlePing = async () => {
  if (!window.buntron) return;
  pong.value = await window.buntron.ipc.invoke("ping", \`count=\${count.value}\`);
};

onMounted(() => {
  const init = () => {
    if (window.buntron) {
      window.buntron.ipc.invoke("get-app-info").then((info: any) => {
        appInfo.value = info;
      });
    }
  };
  if (window.buntron) init();
  else window.addEventListener("buntron-ipc-ready", init);
});
</script>

<template>
  <div class="app">
    <header>
      <h1>⚡ ${name}</h1>
      <p class="subtitle">Buntron + Vue</p>
    </header>

    <div class="cards">
      <div class="card">
        <h2>Counter</h2>
        <button @click="count++">Count: {{ count }}</button>
      </div>

      <div class="card">
        <h2>IPC Test</h2>
        <button @click="handlePing">Send Ping</button>
        <pre v-if="pong">{{ pong }}</pre>
      </div>

      <div class="card" v-if="appInfo">
        <h2>App Info</h2>
        <pre>{{ JSON.stringify(appInfo, null, 2) }}</pre>
      </div>
    </div>

    <footer>Built with Buntron + Vue</footer>
  </div>
</template>

<style scoped>
@import "./style.css";
</style>
`,
  );

  // style.css
  writeFileSync(join(rendererDir, "style.css"), CSS_THEME);

  // TypeScript declarations
  writeFileSync(join(rendererDir, "buntron.d.ts"), BUNTRON_DTS);
  writeFileSync(
    join(rendererDir, "env.d.ts"),
    `/// <reference types="vite/client" />
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
`,
  );
}

// ═══════════════════════════════════════════════════════════════
//  Static Template
// ═══════════════════════════════════════════════════════════════

function writeStaticRenderer(dir: string, name: string) {
  const rendererDir = join(dir, "src", "renderer");

  writeFileSync(
    join(rendererDir, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="app">
    <header>
      <h1>⚡ ${name}</h1>
      <p class="subtitle">Powered by Buntron + Bun</p>
    </header>

    <div class="cards">
      <div class="card">
        <h2>Welcome to Buntron!</h2>
        <p>Edit <code>src/renderer/index.html</code> to customise the UI.</p>
        <p>Main process: <code>src/main.ts</code></p>
      </div>

      <div class="card">
        <h2>IPC Test</h2>
        <button id="pingBtn">Send Ping</button>
        <button id="infoBtn">Get App Info</button>
        <pre id="output">Click a button to test IPC...</pre>
      </div>
    </div>

    <footer>Built with Buntron</footer>
  </div>
  <script src="renderer.js"></script>
</body>
</html>
`,
  );

  writeFileSync(join(rendererDir, "styles.css"), CSS_THEME);

  writeFileSync(
    join(rendererDir, "renderer.js"),
    `// Renderer process
function whenReady(fn) {
  if (window.buntron) fn();
  else window.addEventListener("buntron-ipc-ready", fn);
}

whenReady(function () {
  var ipc = window.buntron.ipc;
  var output = document.getElementById("output");

  document.getElementById("pingBtn").addEventListener("click", async function () {
    output.textContent = "Sending ping...";
    try {
      var result = await ipc.invoke("ping", "Hello from renderer!");
      output.textContent = "Response: " + result;
    } catch (e) {
      output.textContent = "Error: " + e.message;
    }
  });

  document.getElementById("infoBtn").addEventListener("click", async function () {
    output.textContent = "Getting app info...";
    try {
      var info = await ipc.invoke("get-app-info");
      output.textContent = JSON.stringify(info, null, 2);
    } catch (e) {
      output.textContent = "Error: " + e.message;
    }
  });
});
`,
  );
}

// ═══════════════════════════════════════════════════════════════
//  Shared Constants
// ═══════════════════════════════════════════════════════════════

const CSS_THEME = `* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #0f0f13;
  --surface: #1a1a24;
  --border: #2a2a3a;
  --text: #e4e4ef;
  --text-muted: #888899;
  --accent: #7c5cfc;
  --accent-hover: #9b80ff;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

.app {
  max-width: 680px;
  margin: 0 auto;
  padding: 48px 24px;
}

header {
  text-align: center;
  margin-bottom: 36px;
}

header h1 {
  font-size: 2.2rem;
  background: linear-gradient(135deg, var(--accent), #4caf9e);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: var(--text-muted);
  margin-top: 4px;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}

.card h2 {
  font-size: 1.1rem;
  color: var(--accent);
  margin-bottom: 12px;
}

.card p {
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 6px;
}

code {
  background: rgba(124, 92, 252, 0.12);
  color: var(--accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

button {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  margin-right: 8px;
  margin-bottom: 8px;
}

button:hover {
  background: var(--accent-hover);
}

pre {
  background: #12121a;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  font-family: "Cascadia Code", "Fira Code", monospace;
  font-size: 0.85rem;
  color: #4caf9e;
  margin-top: 8px;
  overflow-x: auto;
  white-space: pre-wrap;
}

footer {
  text-align: center;
  margin-top: 40px;
  color: var(--text-muted);
  font-size: 0.85rem;
}
`;

const BUNTRON_DTS = `export {};

declare global {
  interface Window {
    buntron: {
      ipc: BuntronIPC;
      ipcRenderer: BuntronIPC;
      windowId: string;
      platform: string;
    };
  }
}

interface BuntronIPC {
  invoke(channel: string, ...args: any[]): Promise<any>;
  send(channel: string, ...args: any[]): void;
  on(channel: string, handler: (...args: any[]) => void): void;
  once(channel: string, handler: (...args: any[]) => void): void;
  removeListener(channel: string, handler: (...args: any[]) => void): void;
  removeAllListeners(channel: string): void;
}
`;
