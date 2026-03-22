// ============================================================
// Buntron - C# Host Compiler
// ============================================================
// Compiles the C# WebView2 host application using csc.exe
// Downloads WebView2 SDK NuGet package if not present
// ============================================================

import { existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

const WEBVIEW2_NUGET_VERSION = "1.0.2739.15";
const WEBVIEW2_NUGET_URL = `https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/${WEBVIEW2_NUGET_VERSION}`;

/** Paths relative to buntron package root */
function getPaths(buntronRoot: string) {
  const nativeDir = join(buntronRoot, "native");
  const sdkDir = join(nativeDir, "webview2-sdk");
  const buildDir = join(nativeDir, "build");

  return {
    nativeDir,
    sdkDir,
    buildDir,
    hostCs: join(buntronRoot, "src", "host", "webview-host.cs"),
    hostExe: join(buildDir, "BuntronHost.exe"),
    // WebView2 SDK DLLs (NuGet package uses net462)
    webview2CoreDll: join(
      sdkDir,
      "lib",
      "net462",
      "Microsoft.Web.WebView2.Core.dll",
    ),
    webview2WinFormsDll: join(
      sdkDir,
      "lib",
      "net462",
      "Microsoft.Web.WebView2.WinForms.dll",
    ),
    webview2LoaderX86: join(
      sdkDir,
      "build",
      "native",
      "x86",
      "WebView2Loader.dll",
    ),
    webview2LoaderX64: join(
      sdkDir,
      "build",
      "native",
      "x64",
      "WebView2Loader.dll",
    ),
  };
}

/**
 * Find csc.exe from .NET Framework
 */
function findCscExe(): string | null {
  const candidates = [
    "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe",
    "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe",
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // Try dotnet-based Roslyn
  const dotnetPaths = [
    join(process.env.ProgramFiles || "", "dotnet", "sdk"),
    join(process.env["ProgramFiles(x86)"] || "", "dotnet", "sdk"),
  ];

  for (const basePath of dotnetPaths) {
    if (existsSync(basePath)) {
      // Find latest SDK
      try {
        const entries = require("fs").readdirSync(basePath);
        const latest = entries.sort().pop();
        if (latest) {
          const roslynCsc = join(
            basePath,
            latest,
            "Roslyn",
            "bincore",
            "csc.dll",
          );
          if (existsSync(roslynCsc)) return roslynCsc;
        }
      } catch {}
    }
  }

  return null;
}

/**
 * Download and extract WebView2 NuGet package
 */
async function downloadWebView2SDK(sdkDir: string): Promise<boolean> {
  console.log("[Buntron] Downloading WebView2 SDK...");

  try {
    mkdirSync(sdkDir, { recursive: true });

    // Use .zip extension — Expand-Archive rejects .nupkg
    const zipPath = join(sdkDir, "webview2.zip");

    // Download using fetch (Bun built-in)
    const response = await fetch(WEBVIEW2_NUGET_URL, {
      redirect: "follow",
      headers: { "User-Agent": "Buntron/1.0" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await Bun.write(zipPath, arrayBuffer);

    console.log(
      `[Buntron] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`,
    );
    console.log("[Buntron] Extracting WebView2 SDK...");

    // NuGet packages are ZIP files; extract with PowerShell
    const proc = Bun.spawnSync([
      "powershell.exe",
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${sdkDir}' -Force`,
    ]);

    if (proc.exitCode !== 0) {
      const stderr = proc.stderr.toString().trim();
      throw new Error(`Extraction failed: ${stderr}`);
    }

    // Clean up zip
    try {
      require("fs").unlinkSync(zipPath);
    } catch {}

    console.log("[Buntron] WebView2 SDK extracted successfully.");
    return true;
  } catch (err) {
    console.error(
      `[Buntron] Failed to download WebView2 SDK: ${(err as Error).message}`,
    );
    return false;
  }
}

/**
 * Compile the C# host application
 */
async function compileHost(buntronRoot: string): Promise<boolean> {
  const paths = getPaths(buntronRoot);

  console.log("[Buntron] Compiling host application...");

  // Ensure build directory exists
  mkdirSync(paths.buildDir, { recursive: true });

  // Find compiler
  const cscExe = findCscExe();
  if (!cscExe) {
    console.error(
      "[Buntron] ERROR: csc.exe not found. .NET Framework 4.x is required.",
    );
    return false;
  }

  console.log(`[Buntron] Using compiler: ${cscExe}`);

  // Check if WebView2 SDK is available
  if (!existsSync(paths.webview2CoreDll)) {
    const downloaded = await downloadWebView2SDK(paths.sdkDir);
    if (!downloaded) {
      console.error("[Buntron] Cannot compile without WebView2 SDK.");
      return false;
    }
  }

  // Determine arch for WebView2Loader.dll
  const isX64 = process.arch === "x64";
  const loaderSrc = isX64 ? paths.webview2LoaderX64 : paths.webview2LoaderX86;
  const loaderDst = join(paths.buildDir, "WebView2Loader.dll");

  // Copy WebView2Loader.dll to build dir
  if (existsSync(loaderSrc)) {
    await Bun.write(loaderDst, Bun.file(loaderSrc));
  }

  // Copy managed DLLs to build dir
  for (const dll of [paths.webview2CoreDll, paths.webview2WinFormsDll]) {
    if (existsSync(dll)) {
      const dstPath = join(paths.buildDir, require("path").basename(dll));
      await Bun.write(dstPath, Bun.file(dll));
    }
  }

  // Build compiler arguments
  const args = [
    "/target:winexe",
    "/platform:anycpu",
    "/optimize+",
    "/nologo",
    `/out:${paths.hostExe}`,
    `/reference:${paths.webview2CoreDll}`,
    `/reference:${paths.webview2WinFormsDll}`,
    "/reference:System.Windows.Forms.dll",
    "/reference:System.Drawing.dll",
    "/reference:System.Web.Extensions.dll",
    paths.hostCs,
  ];

  // Compile
  const proc = Bun.spawnSync([cscExe, ...args]);

  if (proc.exitCode !== 0) {
    const stderr = proc.stderr.toString();
    const stdout = proc.stdout.toString();
    console.error(`[Buntron] Compilation failed (exit code ${proc.exitCode}):`);
    if (stderr) console.error(stderr);
    if (stdout) console.error(stdout);
    return false;
  }

  console.log("[Buntron] Host compiled successfully.");
  return true;
}

/**
 * Check if host is compiled and up to date
 */
function isHostReady(buntronRoot: string): boolean {
  const paths = getPaths(buntronRoot);
  return existsSync(paths.hostExe);
}

/**
 * Get path to compiled host executable
 */
function getHostExePath(buntronRoot: string): string {
  return getPaths(buntronRoot).hostExe;
}

/**
 * Ensure host is compiled (compile if needed)
 * Supports both development layout (native/build/) and production layout (runtime/)
 */
async function ensureHost(buntronRoot: string): Promise<string> {
  // 1) Check production layout: <root>/runtime/BuntronHost.exe
  const prodHostExe = join(buntronRoot, "runtime", "BuntronHost.exe");
  if (existsSync(prodHostExe)) {
    return prodHostExe;
  }

  // 2) Check standard layout: <root>/native/build/BuntronHost.exe
  const paths = getPaths(buntronRoot);
  if (isHostReady(buntronRoot)) {
    return paths.hostExe;
  }

  // 3) Try to compile
  const success = await compileHost(buntronRoot);
  if (!success) {
    throw new Error("[Buntron] Failed to build host application");
  }

  return paths.hostExe;
}

export {
  compileHost,
  isHostReady,
  getHostExePath,
  ensureHost,
  downloadWebView2SDK,
  findCscExe,
  getPaths,
};
