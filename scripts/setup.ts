// ============================================================
// Buntron - Setup Script
// ============================================================
// Post-install script that:
// 1. Downloads the WebView2 SDK NuGet package
// 2. Extracts necessary DLLs
// 3. Compiles the C# host application
// ============================================================

import { resolve, dirname } from "path";
import { existsSync, mkdirSync } from "fs";
import {
  compileHost,
  downloadWebView2SDK,
  isHostReady,
  getPaths,
  findCscExe,
} from "../src/host/compiler";

export async function runSetup() {
  console.log(`
╔══════════════════════════════════════════════════╗
║            🔧 Buntron Setup                      ║
╚══════════════════════════════════════════════════╝
`);

  // Determine buntron root
  const buntronRoot = resolve(
    dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
    "..",
  );

  console.log(`[Setup] Buntron root: ${buntronRoot}`);

  const paths = getPaths(buntronRoot);

  // Step 1: Check for C# compiler
  console.log("\n[Step 1/3] Checking for C# compiler...");
  const csc = findCscExe();
  if (csc) {
    console.log(`  ✅ Found: ${csc}`);
  } else {
    console.error(`  ❌ csc.exe not found!`);
    console.error(
      `  .NET Framework 4.x is required to compile the Buntron host.`,
    );
    console.error(`  It should be pre-installed on Windows 7/8/10/11.`);
    console.error(`  Try installing .NET Framework from:`);
    console.error(`  https://dotnet.microsoft.com/download/dotnet-framework`);
    process.exit(1);
  }

  // Step 2: Download WebView2 SDK
  console.log("\n[Step 2/3] Checking WebView2 SDK...");
  if (existsSync(paths.webview2CoreDll)) {
    console.log("  ✅ WebView2 SDK already present");
  } else {
    console.log("  Downloading WebView2 SDK...");
    const success = await downloadWebView2SDK(paths.sdkDir);
    if (!success) {
      console.error("  ❌ Failed to download WebView2 SDK");
      console.error("  You can manually download it from:");
      console.error("  https://www.nuget.org/packages/Microsoft.Web.WebView2");
      process.exit(1);
    }
    console.log("  ✅ WebView2 SDK downloaded");
  }

  // Step 3: Compile host
  console.log("\n[Step 3/3] Compiling host application...");
  if (isHostReady(buntronRoot)) {
    console.log("  ✅ Host already compiled");
  } else {
    const success = await compileHost(buntronRoot);
    if (!success) {
      console.error("  ❌ Host compilation failed");
      process.exit(1);
    }
    console.log("  ✅ Host compiled successfully");
  }

  // Check WebView2 Runtime
  console.log("\n[Info] Checking WebView2 Runtime...");
  const hasRuntime = checkWebView2Runtime();
  if (hasRuntime) {
    console.log("  ✅ WebView2 Runtime is installed");
  } else {
    console.warn("  ⚠️  WebView2 Runtime not detected");
    console.warn("  It's included in Windows 10/11 with Edge.");
    console.warn(
      "  Download: https://developer.microsoft.com/en-us/microsoft-edge/webview2/",
    );
  }

  console.log(`
╔══════════════════════════════════════════════════╗
║            ✅ Setup Complete!                     ║
╚══════════════════════════════════════════════════╝

Buntron is ready to use. Create your first app:

  buntron init my-app
  cd my-app
  bun install
  bun run dev
`);
}

function checkWebView2Runtime(): boolean {
  // Check if WebView2 runtime is installed
  const regPaths = [
    "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
  ];

  for (const regPath of regPaths) {
    try {
      const proc = Bun.spawnSync(["reg", "query", regPath, "/v", "pv"]);
      if (proc.exitCode === 0) return true;
    } catch {}
  }

  // Also check for Evergreen runtime
  const evergreenPath = resolve(
    process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
    "Microsoft",
    "EdgeWebView",
    "Application",
  );
  return existsSync(evergreenPath);
}

// Run if executed directly
if (import.meta.main) {
  runSetup().catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
}
