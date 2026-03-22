// ============================================================
// Buntron CLI - Init Command
// ============================================================

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join, basename } from "path";

export async function runInit(args: string[]) {
  const input = args[0] || "my-buntron-app";
  const initInPlace = input === ".";
  const targetDir = resolve(process.cwd(), input);
  const projectName = initInPlace ? basename(process.cwd()) : input;

  console.log(`\n🚀 Creating Buntron project: ${projectName}\n`);

  if (!initInPlace && existsSync(targetDir)) {
    console.error(`Error: Directory '${projectName}' already exists.`);
    process.exit(1);
  }

  // Create directory structure
  const dirs = ["", "src", "src/renderer", "assets"];

  for (const dir of dirs) {
    mkdirSync(join(targetDir, dir), { recursive: true });
  }

  // package.json
  writeFileSync(
    join(targetDir, "package.json"),
    JSON.stringify(
      {
        name: projectName,
        version: "1.0.0",
        private: true,
        type: "module",
        main: "src/main.ts",
        scripts: {
          dev: "buntron dev",
          build: "buntron build",
          "build:exe": "buntron build --exe",
          package: "buntron package",
        },
        dependencies: {
          buntron: "github:tarkantoan/buntron",
        },
      },
      null,
      2,
    ),
  );

  // tsconfig.json
  writeFileSync(
    join(targetDir, "tsconfig.json"),
    JSON.stringify(
      {
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
      },
      null,
      2,
    ),
  );

  // Main process entry
  writeFileSync(
    join(targetDir, "src", "main.ts"),
    `// ============================================================
// ${projectName} - Main Process
// ============================================================
import { BuntronApp, BrowserWindow, ipcMain } from "buntron";
import { resolve } from "path";

const isDev = process.env.NODE_ENV !== "production";
const app = new BuntronApp();

async function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: "${projectName}",
    webPreferences: {
      preload: resolve(__dirname, "preload.ts"),
      devTools: isDev,
    },
  });

  await win.loadFile(resolve(__dirname, "renderer", "index.html"));

  // Open DevTools in development
  if (isDev) {
    win.webContents.openDevTools();
  }

  win.on("closed", () => {
    console.log("Window closed");
  });

  return win;
}

async function main() {
  // Start the application
  await app.start();

  console.log("Buntron app is ready!");

  // Create the main window
  const mainWindow = await createWindow();

  // Handle IPC messages from renderer
  ipcMain.handle("ping", async (event, message) => {
    console.log("Received ping:", message);
    return "pong: " + message;
  });

  ipcMain.handle("get-app-info", async () => {
    return {
      name: app.name,
      version: app.version,
      platform: process.platform,
      arch: process.arch,
    };
  });

  // Quit when all windows are closed
  app.on("window-all-closed", () => {
    app.quit();
  });
}

main().catch(console.error);
`,
  );

  // Preload script
  writeFileSync(
    join(targetDir, "src", "preload.ts"),
    `// ============================================================
// ${projectName} - Preload Script
// ============================================================
// This script runs in the renderer context before the page loads.
// Use it to expose safe APIs to the renderer via contextBridge pattern.

console.log("[Preload] Buntron preload script loaded");
console.log("[Preload] Window ID:", window.buntron?.windowId);
`,
  );

  // Renderer HTML
  writeFileSync(
    join(targetDir, "src", "renderer", "index.html"),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>⚡ ${projectName}</h1>
      <p class="subtitle">Powered by Buntron + Bun</p>
    </header>

    <main>
      <div class="card">
        <h2>Welcome to Buntron!</h2>
        <p>Edit <code>src/renderer/index.html</code> to get started.</p>
        <p>Main process: <code>src/main.ts</code></p>
      </div>

      <div class="card">
        <h2>IPC Test</h2>
        <button id="pingBtn">Send Ping</button>
        <button id="infoBtn">Get App Info</button>
        <pre id="output">Click a button to test IPC...</pre>
      </div>

      <div class="card stats">
        <div class="stat">
          <span class="label">Platform</span>
          <span id="platform" class="value">-</span>
        </div>
        <div class="stat">
          <span class="label">Window ID</span>
          <span id="windowId" class="value">-</span>
        </div>
      </div>
    </main>

    <footer>
      <p>Built with ❤️ using Buntron</p>
    </footer>
  </div>

  <script src="renderer.js"></script>
</body>
</html>
`,
  );

  // Renderer CSS
  writeFileSync(
    join(targetDir, "src", "renderer", "styles.css"),
    `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg: #0f0f13;
  --surface: #1a1a24;
  --border: #2a2a3a;
  --text: #e4e4ef;
  --text-muted: #888899;
  --accent: #7c5cfc;
  --accent-hover: #9b80ff;
  --success: #4caf9e;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

#app {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 24px;
}

header {
  text-align: center;
  margin-bottom: 40px;
}

header h1 {
  font-size: 2.4rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--success));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.subtitle {
  color: var(--text-muted);
  font-size: 1.1rem;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}

.card h2 {
  font-size: 1.2rem;
  margin-bottom: 12px;
  color: var(--accent);
}

.card p {
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 8px;
}

code {
  background: rgba(124, 92, 252, 0.12);
  color: var(--accent);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 0.9em;
}

button {
  background: var(--accent);
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 8px;
  margin-bottom: 12px;
}

button:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(124, 92, 252, 0.3);
}

button:active {
  transform: translateY(0);
}

pre {
  background: #12121a;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 0.85rem;
  color: var(--success);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.stats {
  display: flex;
  gap: 20px;
}

.stat {
  flex: 1;
  text-align: center;
}

.stat .label {
  display: block;
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.stat .value {
  display: block;
  color: var(--success);
  font-size: 1.1rem;
  font-weight: 600;
  font-family: 'Cascadia Code', monospace;
}

footer {
  text-align: center;
  margin-top: 40px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.card {
  animation: fadeIn 0.4s ease-out;
}

.card:nth-child(2) { animation-delay: 0.1s; }
.card:nth-child(3) { animation-delay: 0.2s; }
`,
  );

  // Renderer JavaScript
  writeFileSync(
    join(targetDir, "src", "renderer", "renderer.js"),
    `// ============================================================
// Renderer Process
// ============================================================

const output = document.getElementById("output");
const platformEl = document.getElementById("platform");
const windowIdEl = document.getElementById("windowId");

// Wait for Buntron IPC to be ready
function whenReady(callback) {
  if (window.buntron) {
    callback();
  } else {
    window.addEventListener("buntron-ipc-ready", callback);
  }
}

whenReady(function() {
  const { ipcRenderer, windowId, platform } = window.buntron;

  // Display info
  platformEl.textContent = platform;
  windowIdEl.textContent = windowId;

  // Ping button
  document.getElementById("pingBtn").addEventListener("click", async function() {
    output.textContent = "Sending ping...";
    try {
      const result = await ipcRenderer.invoke("ping", "Hello from renderer!");
      output.textContent = "Response: " + result;
    } catch (err) {
      output.textContent = "Error: " + err.message;
    }
  });

  // Info button
  document.getElementById("infoBtn").addEventListener("click", async function() {
    output.textContent = "Getting app info...";
    try {
      const info = await ipcRenderer.invoke("get-app-info");
      output.textContent = JSON.stringify(info, null, 2);
    } catch (err) {
      output.textContent = "Error: " + err.message;
    }
  });

  // Listen for messages from main
  ipcRenderer.on("message", function(event, data) {
    output.textContent = "Message from main: " + JSON.stringify(data);
  });

  console.log("[Renderer] Ready! Window ID:", windowId);
});
`,
  );

  // .gitignore
  writeFileSync(
    join(targetDir, ".gitignore"),
    `node_modules/
dist/
build/
*.exe
.DS_Store
Thumbs.db
`,
  );

  console.log(`✅ Project created successfully!

📁 ${projectName}/
├── src/
│   ├── main.ts            # Main process
│   ├── preload.ts          # Preload script
│   └── renderer/
│       ├── index.html      # UI markup
│       ├── styles.css      # Styles
│       └── renderer.js     # UI logic
├── package.json
├── tsconfig.json
└── .gitignore

Next steps:
  cd ${projectName}
  bun install
  bun run dev
`);
}
