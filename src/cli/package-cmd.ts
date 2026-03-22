// ============================================================
// Buntron CLI - Package Command
// ============================================================
// Packages the application into a distributable folder
// with all necessary runtime dependencies.
// ============================================================

import { resolve, join, basename } from "path";
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync } from "fs";
import { getPaths } from "../host/compiler";

export async function runPackage(args: string[]) {
  const cwd = process.cwd();
  let appName = "buntron-app";
  let appVersion = "1.0.0";

  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf-8"));
    appName = pkg.name || appName;
    appVersion = pkg.version || appVersion;
  } catch {}

  const outDir = resolve(
    cwd,
    args.includes("--outdir")
      ? args[args.indexOf("--outdir") + 1]
      : `release/${appName}-win32`,
  );

  console.log(`\n📦 Packaging: ${appName} v${appVersion}\n`);

  // Step 1: Build the app first
  console.log("  [1/5] Building application...");
  const buildDir = resolve(cwd, "dist");

  const { runBuild } = await import("./build");
  // Manually build since runBuild would exit
  const mainFile = findMainFile(cwd);
  if (!mainFile) {
    console.error("Error: Cannot find main file");
    process.exit(1);
  }

  mkdirSync(buildDir, { recursive: true });
  const buildResult = await Bun.build({
    entrypoints: [resolve(cwd, mainFile)],
    outdir: buildDir,
    target: "bun",
    minify: true,
  });

  if (!buildResult.success) {
    console.error("Build failed");
    process.exit(1);
  }

  // Copy renderer
  for (const dir of ["src/renderer", "public", "assets"]) {
    const srcDir = resolve(cwd, dir);
    if (existsSync(srcDir)) {
      cpSync(srcDir, join(buildDir, dir), { recursive: true });
    }
  }

  console.log("  ✅ Built");

  // Step 2: Create release directory
  console.log("  [2/5] Creating release directory...");
  mkdirSync(outDir, { recursive: true });

  // Step 3: Copy built app
  console.log("  [3/5] Copying application files...");
  cpSync(buildDir, join(outDir, "app"), { recursive: true });

  // Step 4: Copy Buntron runtime
  console.log("  [4/5] Copying runtime...");

  // Find buntron root
  const buntronRoot = findBuntronRoot();
  if (!buntronRoot) {
    console.error("Error: Cannot find buntron package");
    process.exit(1);
  }

  const paths = getPaths(buntronRoot);

  // Copy host executable
  if (existsSync(paths.hostExe)) {
    cpSync(paths.hostExe, join(outDir, "runtime", "BuntronHost.exe"));
  }

  // Copy WebView2 DLLs
  const dllDir = paths.buildDir;
  if (existsSync(dllDir)) {
    const runtimeDir = join(outDir, "runtime");
    mkdirSync(runtimeDir, { recursive: true });
    cpSync(dllDir, runtimeDir, { recursive: true });
  }

  // Step 5: Create launcher
  console.log("  [5/5] Creating launcher...");

  const launcherScript = `@echo off
set BUNTRON_ROOT=%~dp0runtime
set NODE_ENV=production
cd /d "%~dp0app"
bun run main.js
`;
  writeFileSync(join(outDir, `${appName}.bat`), launcherScript);

  // Also create a PowerShell launcher
  const psLauncher = `
$env:BUNTRON_ROOT = Join-Path $PSScriptRoot "runtime"
$env:NODE_ENV = "production"
Set-Location (Join-Path $PSScriptRoot "app")
bun run main.js
`;
  writeFileSync(join(outDir, `${appName}.ps1`), psLauncher);

  // Create package info
  writeFileSync(
    join(outDir, "app.json"),
    JSON.stringify(
      {
        name: appName,
        version: appVersion,
        runtime: "bun",
        framework: "buntron",
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`
✅ Package complete!
📁 Output: ${outDir}

Contents:
  ${appName}.bat       - Windows launcher
  ${appName}.ps1       - PowerShell launcher
  app/                  - Application files
  runtime/              - Buntron runtime
  app.json              - Package metadata

Requirements:
  - Bun runtime (https://bun.sh)
  - WebView2 Runtime (included in Windows 10/11)
`);
}

function findMainFile(cwd: string): string | null {
  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf-8"));
    if (pkg.main) return pkg.main;
  } catch {}

  const candidates = [
    "src/main.ts",
    "src/main.js",
    "src/index.ts",
    "src/index.js",
  ];
  for (const c of candidates) {
    if (existsSync(resolve(cwd, c))) return c;
  }
  return null;
}

function findBuntronRoot(): string | null {
  // Try node_modules
  const candidates = [
    resolve(process.cwd(), "node_modules", "buntron"),
    resolve(__dirname, "..", ".."),
  ];

  for (const dir of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
      if (pkg.name === "buntron") return dir;
    } catch {}
  }

  return null;
}
