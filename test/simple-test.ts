// ============================================================
// Buntron - Simple Test App
// ============================================================

import { resolve, join, dirname } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";

// Determine buntron root
const buntronRoot = resolve(
  dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
  "..",
);
const hostExe = join(buntronRoot, "native", "build", "BuntronHost.exe");

if (!existsSync(hostExe)) {
  console.error("Host not compiled! Run: bun run scripts/setup.ts");
  process.exit(1);
}

// Create a temporary HTML file
const tmpDir = join(buntronRoot, ".tmp-test");
mkdirSync(tmpDir, { recursive: true });

const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Buntron Test</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0f0f13, #1a1a2e, #16213e);
      color: #e0e0ff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .container {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 48px;
      backdrop-filter: blur(10px);
    }
    h1 {
      font-size: 48px;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #7c5cfc, #00d4ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p { color: #9896a8; font-size: 16px; margin: 8px 0; }
    .badge {
      display: inline-block;
      margin-top: 16px;
      padding: 6px 16px;
      background: rgba(124, 92, 252, 0.2);
      border: 1px solid rgba(124, 92, 252, 0.4);
      border-radius: 20px;
      font-size: 14px;
      color: #9b82fc;
    }
    .icon { font-size: 72px; margin-bottom: 20px; }
    button {
      margin-top: 24px;
      padding: 12px 32px;
      font-size: 15px;
      background: #7c5cfc;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #9b82fc; }
    #counter { font-size: 20px; margin-top: 16px; color: #7c5cfc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚡</div>
    <h1>Buntron</h1>
    <p>Electron-like framework powered by Bun</p>
    <p>WebView2 + Win32 + Bun Runtime</p>
    <div class="badge">It works! 🎉</div>
    <br>
    <button onclick="count()">Click me!</button>
    <div id="counter">Clicks: 0</div>
  </div>
  <script>
    let clicks = 0;
    function count() {
      clicks++;
      document.getElementById('counter').textContent = 'Clicks: ' + clicks;
    }
  </script>
</body>
</html>`;

const htmlPath = join(tmpDir, "test.html");
writeFileSync(htmlPath, htmlContent, "utf-8");

// Start a simple HTTP server to serve the HTML
const server = Bun.serve({
  port: 0,
  fetch(req) {
    return new Response(htmlContent, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});

const url = `http://localhost:${server.port}/`;
console.log(`[Test] Content server running at ${url}`);

// Spawn the C# host process
const userDataDir = join(tmpDir, "webview-data");
mkdirSync(userDataDir, { recursive: true });

const hostProc = Bun.spawn([hostExe, userDataDir], {
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
});

console.log("[Test] Host started, PID:", hostProc.pid);

// Read stdout line by line
const decoder = new TextDecoder();
let buffer = "";

async function readStdout() {
  const reader = hostProc.stdout.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.substring(0, newlineIdx).trim();
        buffer = buffer.substring(newlineIdx + 1);
        if (line) {
          try {
            const msg = JSON.parse(line);
            handleHostMessage(msg);
          } catch (e) {
            console.log("[Host raw]:", line);
          }
        }
      }
    }
  } catch (e) {
    console.log("[Test] Stdout reader ended");
  }
}

async function readStderr() {
  const reader = hostProc.stderr.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text.trim()) console.error("[Host stderr]:", text.trim());
    }
  } catch {}
}

let requestId = 1;

function sendCommand(cmd: string, params: any = {}): number {
  const id = requestId++;
  const msg = JSON.stringify({ cmd, id, params }) + "\n";
  hostProc.stdin.write(msg);
  return id;
}

function handleHostMessage(msg: any) {
  console.log(
    `[Host] ${msg.event}`,
    msg.windowId !== undefined ? `(win: ${msg.windowId})` : "",
    msg.requestId !== undefined ? `(req: ${msg.requestId})` : "",
  );

  if (msg.event === "ready") {
    console.log("[Test] Host is ready! Creating window...");

    // Create a window
    sendCommand("createWindow", {
      width: 700,
      height: 500,
      title: "Buntron Test - It Works! ⚡",
      center: true,
      backgroundColor: "#0f0f13",
      url: url,
      devTools: true,
    });
  }

  if (msg.event === "reply" && msg.windowId) {
    console.log(`[Test] ✅ Window created! ID: ${msg.windowId}`);
    console.log("[Test] ============================================");
    console.log("[Test] Buntron is working! You should see a window.");
    console.log("[Test] Close the window to exit.");
    console.log("[Test] ============================================");
  }

  if (msg.event === "windowClosed") {
    console.log("[Test] Window closed. Shutting down...");
    sendCommand("quit");
    setTimeout(() => {
      server.stop();
      process.exit(0);
    }, 500);
  }

  if (msg.event === "allWindowsClosed") {
    console.log("[Test] All windows closed.");
    server.stop();
    process.exit(0);
  }
}

// Start reading
readStdout();
readStderr();

// Handle process exit
process.on("SIGINT", () => {
  console.log("[Test] SIGINT received, shutting down...");
  sendCommand("quit");
  setTimeout(() => process.exit(0), 1000);
});

console.log("[Test] Waiting for host ready signal...");
