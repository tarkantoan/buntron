// ============================================================
// Buntron CLI - Build Command
// ============================================================
// Builds the application for production distribution.
//
// buntron build            → dist/ folder (needs Bun to run)
// buntron build --exe      → release/ folder with standalone .exe
// ============================================================

import { resolve, join, dirname } from "path";
import {
  existsSync,
  mkdirSync,
  cpSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "fs";
import { getPaths } from "../host/compiler";

export async function runBuild(args: string[]) {
  const cwd = process.cwd();
  const isExe = args.includes("--exe");
  const defaultOutDir = isExe ? "release" : "dist";
  const outDir = resolve(
    cwd,
    args.includes("--outdir")
      ? args[args.indexOf("--outdir") + 1]
      : defaultOutDir,
  );

  // Read project info
  let appName = "buntron-app";
  let appVersion = "1.0.0";
  let mainFile = "src/main.ts";
  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf-8"));
    appName = pkg.name || appName;
    appVersion = pkg.version || appVersion;
    if (pkg.main) mainFile = pkg.main;
  } catch {}

  const mainPath = resolve(cwd, mainFile);
  if (!existsSync(mainPath)) {
    console.error(`Error: Main file not found: ${mainFile}`);
    process.exit(1);
  }

  // Find buntron package root (for host + DLLs)
  const buntronRoot = findBuntronRoot();
  if (!buntronRoot) {
    console.error("Error: Cannot find buntron package. Run: bun install");
    process.exit(1);
  }

  const paths = getPaths(buntronRoot);
  if (!existsSync(paths.hostExe)) {
    console.error("Error: BuntronHost.exe not found. Run: bunx buntron setup");
    process.exit(1);
  }

  const mode = isExe ? "EXE" : "Production";
  const totalSteps = isExe ? 6 : 5;

  console.log(`
╔══════════════════════════════════════════════════╗
║          ⚡ Buntron ${mode} Build${" ".repeat(25 - mode.length)}║
╚══════════════════════════════════════════════════╝

  App:     ${appName} v${appVersion}
  Entry:   ${mainFile}
  Output:  ${outDir}
  Mode:    ${isExe ? "Standalone EXE" : "Distributable (requires Bun)"}
`);

  mkdirSync(outDir, { recursive: true });

  // ── Step 1: Bundle main process ──────────────────────────
  console.log(`  [1/${totalSteps}] Bundling main process...`);

  const appDir = isExe ? join(outDir, "_build") : outDir;
  mkdirSync(appDir, { recursive: true });

  const buildResult = await Bun.build({
    entrypoints: [mainPath],
    outdir: appDir,
    target: "bun",
    minify: true,
    sourcemap: isExe ? "none" : "external",
  });

  if (!buildResult.success) {
    console.error("  ❌ Build failed:");
    for (const log of buildResult.logs) {
      console.error("    ", log);
    }
    process.exit(1);
  }
  console.log("  ✅ Main process bundled");

  // ── Step 2: Copy renderer files ──────────────────────────
  console.log(`  [2/${totalSteps}] Copying renderer files...`);

  let rendererCopied = false;
  for (const dir of ["src/renderer", "public", "assets"]) {
    const srcDir = resolve(cwd, dir);
    if (existsSync(srcDir)) {
      cpSync(srcDir, join(appDir, dir), { recursive: true });
      console.log(`    ✅ ${dir}/`);
      rendererCopied = true;
    }
  }
  if (!rendererCopied) {
    console.log("    ⚠️  No renderer files found");
  }

  // ── Step 3: Build preload script ─────────────────────────
  console.log(`  [3/${totalSteps}] Building preload script...`);

  let preloadBuilt = false;
  for (const preload of [
    "src/preload.ts",
    "src/preload.js",
    "preload.ts",
    "preload.js",
  ]) {
    const preloadPath = resolve(cwd, preload);
    if (existsSync(preloadPath)) {
      const preloadBuild = await Bun.build({
        entrypoints: [preloadPath],
        outdir: appDir,
        target: "browser",
        minify: true,
      });
      if (preloadBuild.success) {
        console.log("  ✅ Preload built");
        preloadBuilt = true;
      }
      break;
    }
  }
  if (!preloadBuilt) {
    console.log("    (no preload script)");
  }

  // ── Step 4: Copy runtime (BuntronHost.exe + DLLs) ───────
  console.log(`  [4/${totalSteps}] Copying Buntron runtime...`);

  const runtimeDir = join(outDir, "runtime");
  mkdirSync(runtimeDir, { recursive: true });

  // Copy host exe
  cpSync(paths.hostExe, join(runtimeDir, "BuntronHost.exe"));
  console.log("    ✅ BuntronHost.exe");

  // Copy all DLLs from build dir
  const buildFiles = readdirSync(paths.buildDir);
  const dlls = buildFiles.filter((f) => f.endsWith(".dll"));
  for (const dll of dlls) {
    cpSync(join(paths.buildDir, dll), join(runtimeDir, dll));
  }
  console.log(`    ✅ ${dlls.length} DLL(s)`);

  // ── Step 5: Create launchers ─────────────────────────────
  console.log(`  [5/${totalSteps}] Creating launchers...`);

  if (isExe) {
    // EXE build: launchers will be the exe itself
    console.log("    (EXE mode — standalone launcher)");
  } else {
    // Standard build: create .bat + .ps1 launchers
    const batContent = `@echo off
set BUNTRON_ROOT=%~dp0
set NODE_ENV=production
cd /d "%~dp0"
bun run main.js
`;
    writeFileSync(join(outDir, `${appName}.bat`), batContent);

    const ps1Content = `$env:BUNTRON_ROOT = $PSScriptRoot
$env:NODE_ENV = "production"
Set-Location $PSScriptRoot
bun run main.js
`;
    writeFileSync(join(outDir, `${appName}.ps1`), ps1Content);

    // Copy package.json (stripped)
    const distPkg = {
      name: appName,
      version: appVersion,
      main: "main.js",
    };
    writeFileSync(
      join(outDir, "package.json"),
      JSON.stringify(distPkg, null, 2),
    );

    console.log(`    ✅ ${appName}.bat`);
    console.log(`    ✅ ${appName}.ps1`);
  }

  // ── Step 6 (EXE only): Compile standalone EXE ───────────
  if (isExe) {
    console.log(`  [6/${totalSteps}] Compiling standalone EXE...`);

    // Generate a wrapper that sets BUNTRON_ROOT before running the app
    const wrapperSource = `
import { dirname } from "path";

// Set runtime path relative to exe location (exeDir has runtime/ subfolder)
const exeDir = dirname(process.execPath);
process.env.BUNTRON_ROOT = exeDir;
process.env.NODE_ENV = "production";

// Import the bundled app
await import("./main.js");
`;
    const wrapperPath = join(appDir, "_entry.ts");
    writeFileSync(wrapperPath, wrapperSource);

    const exeName = `${appName}.exe`;
    const exePath = join(outDir, exeName);

    const compileProc = Bun.spawnSync(
      [
        "bun",
        "build",
        "--compile",
        "--minify",
        "--target=bun-windows-x64",
        wrapperPath,
        "--outfile",
        exePath,
      ],
      {
        cwd: appDir,
        env: { ...process.env },
      },
    );

    if (compileProc.exitCode !== 0) {
      console.error("  ❌ EXE compilation failed:");
      console.error(compileProc.stderr.toString());
      process.exit(1);
    }

    // Patch PE header: change subsystem from CONSOLE (3) to WINDOWS_GUI (2)
    // so no console window appears when running the EXE
    try {
      const peBuffer = readFileSync(exePath);
      // e_lfanew at offset 0x3C points to PE signature
      const peOffset = peBuffer.readUInt32LE(0x3c);
      // Subsystem is at PE + 4 (COFF hdr) + 20 (COFF size) + 68 (optional hdr offset)
      const subsystemOffset = peOffset + 4 + 20 + 68;
      const currentSubsystem = peBuffer.readUInt16LE(subsystemOffset);
      if (currentSubsystem === 3) {
        // IMAGE_SUBSYSTEM_WINDOWS_CUI → IMAGE_SUBSYSTEM_WINDOWS_GUI
        peBuffer.writeUInt16LE(2, subsystemOffset);
        writeFileSync(exePath, peBuffer);
        console.log("    ✅ Patched as GUI application (no console window)");
      }
    } catch (e) {
      console.warn(
        "    ⚠️  Could not patch PE subsystem:",
        (e as Error).message,
      );
    }

    console.log(`    ✅ ${exeName} compiled`);

    // Cleanup temp build dir
    try {
      const rmSync = require("fs").rmSync;
      rmSync(appDir, { recursive: true, force: true });
    } catch {}

    // Also clean the wrapper
    try {
      unlinkSync(wrapperPath);
    } catch {}

    // Print summary
    const exeSize = (statSync(exePath).size / 1024 / 1024).toFixed(1);
    let runtimeSize = 0;
    for (const f of readdirSync(runtimeDir)) {
      runtimeSize += statSync(join(runtimeDir, f)).size;
    }
    const runtimeSizeMB = (runtimeSize / 1024 / 1024).toFixed(1);
    const totalMB = (parseFloat(exeSize) + parseFloat(runtimeSizeMB)).toFixed(
      1,
    );

    console.log(`
╔══════════════════════════════════════════════════╗
║          ✅ EXE Build Complete!                   ║
╚══════════════════════════════════════════════════╝

  📁 ${outDir}

  ${exeName.padEnd(25)} ${exeSize} MB (Bun + app)
  runtime/                   ${runtimeSizeMB} MB (WebView2 host + DLLs)
  ─────────────────────────────────
  Total                      ${totalMB} MB

  To run:   cd ${defaultOutDir} && .\\${exeName}
  Distribute: ZIP the '${defaultOutDir}' folder (requires WebView2 Runtime)
`);
  } else {
    // Standard build summary
    let totalSize = 0;
    function calcSize(dir: string) {
      for (const f of readdirSync(dir)) {
        const fp = join(dir, f);
        const st = statSync(fp);
        if (st.isDirectory()) calcSize(fp);
        else totalSize += st.size;
      }
    }
    calcSize(outDir);
    const totalMB = (totalSize / 1024 / 1024).toFixed(1);

    console.log(`
╔══════════════════════════════════════════════════╗
║          ✅ Build Complete!                       ║
╚══════════════════════════════════════════════════╝

  📁 ${outDir}   (${totalMB} MB)

  To run:   cd ${defaultOutDir} && bun run main.js
  Or use:   .\\${appName}.bat

  Requires: Bun runtime + WebView2 Runtime
`);
  }
}

// ── Helpers ──────────────────────────────────────────────────

function findBuntronRoot(): string | null {
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
