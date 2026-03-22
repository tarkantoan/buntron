// ============================================================
// Buntron CLI - Build Command
// ============================================================
// Builds the application for production distribution.
//
// buntron build                → dist/ folder (needs Bun to run)
// buntron build --exe          → release/ folder with standalone .exe
// buntron build --exe --debug  → debug EXE (console + DevTools)
//
// For framework projects (React/Vue via Vite), runs `vite build`
// to compile the renderer before bundling the main process.
// ============================================================

import { resolve, join } from "path";
import {
  existsSync,
  mkdirSync,
  cpSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmSync,
} from "fs";
import { getPaths } from "../host/compiler";
import { detectFramework, type FrameworkInfo } from "./framework";

export async function runBuild(args: string[]) {
  const cwd = process.cwd();
  const isExe = args.includes("--exe");
  const isDebug = args.includes("--debug");
  const defaultOutDir = isExe ? "release" : "dist";
  const outDir = resolve(
    cwd,
    args.includes("--outdir") ? args[args.indexOf("--outdir") + 1] : defaultOutDir,
  );

  // ── Read project info ──────────────────────────────────────
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

  // ── Find buntron package root ──────────────────────────────
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

  // ── Detect framework ───────────────────────────────────────
  const fw = detectFramework(cwd);

  const mode = isExe ? (isDebug ? "Debug EXE" : "EXE") : "Production";
  const totalSteps = isExe ? 7 : 6;

  console.log(`
╔══════════════════════════════════════════════════╗
║          ⚡ Buntron ${mode} Build${" ".repeat(Math.max(0, 25 - mode.length))}║
╚══════════════════════════════════════════════════╝

  App:       ${appName} v${appVersion}
  Entry:     ${mainFile}
  Output:    ${outDir}
  Mode:      ${isExe ? (isDebug ? "Debug EXE (console + DevTools)" : "Standalone EXE") : "Distributable (requires Bun)"}
  Renderer:  ${fw.type === "static" ? "Static HTML" : `${fw.framework} (${fw.type})`}
`);

  // ── Clean & prepare output dir ─────────────────────────────
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  // ── Step 1: Build renderer ─────────────────────────────────
  console.log(`  [1/${totalSteps}] Building renderer...`);

  const rendererOutDir = join(outDir, "renderer");

  if (fw.type === "vite") {
    await buildViteRenderer(cwd, rendererOutDir);
  } else {
    buildStaticRenderer(cwd, rendererOutDir);
  }

  // ── Step 2: Bundle main process ────────────────────────────
  console.log(`  [2/${totalSteps}] Bundling main process...`);

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
    for (const log of buildResult.logs) console.error("    ", log);
    process.exit(1);
  }
  console.log("  ✅ Main process bundled");

  // ── Step 3: Build preload ──────────────────────────────────
  console.log(`  [3/${totalSteps}] Building preload...`);

  let preloadBuilt = false;
  for (const preload of ["src/preload.ts", "src/preload.js", "preload.ts", "preload.js"]) {
    const preloadPath = resolve(cwd, preload);
    if (existsSync(preloadPath)) {
      const preloadBuild = await Bun.build({
        entrypoints: [preloadPath],
        outdir: outDir, // preload.js goes to outDir root (alongside renderer/)
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

  // ── Step 4: Copy runtime ───────────────────────────────────
  console.log(`  [4/${totalSteps}] Copying Buntron runtime...`);

  const runtimeDir = join(outDir, "runtime");
  mkdirSync(runtimeDir, { recursive: true });

  cpSync(paths.hostExe, join(runtimeDir, "BuntronHost.exe"));
  console.log("    ✅ BuntronHost.exe");

  const buildFiles = readdirSync(paths.buildDir);
  const dlls = buildFiles.filter((f) => f.endsWith(".dll"));
  for (const dll of dlls) {
    cpSync(join(paths.buildDir, dll), join(runtimeDir, dll));
  }
  console.log(`    ✅ ${dlls.length} DLL(s)`);

  // ── Step 5: Copy assets ────────────────────────────────────
  console.log(`  [5/${totalSteps}] Copying assets...`);

  const assetsSrc = resolve(cwd, "assets");
  if (existsSync(assetsSrc)) {
    cpSync(assetsSrc, join(outDir, "assets"), { recursive: true });
    console.log("    ✅ assets/");
  } else {
    console.log("    (no assets/)");
  }

  // ── Step 6: Create launchers ───────────────────────────────
  console.log(`  [6/${totalSteps}] Creating launchers...`);

  if (isExe) {
    console.log("    (EXE mode — standalone launcher)");
  } else {
    const batContent = `@echo off\nset BUNTRON_ROOT=%~dp0\nset NODE_ENV=production\ncd /d "%~dp0"\nbun run main.js\n`;
    writeFileSync(join(outDir, `${appName}.bat`), batContent);

    const ps1Content = `$env:BUNTRON_ROOT = $PSScriptRoot\n$env:NODE_ENV = "production"\nSet-Location $PSScriptRoot\nbun run main.js\n`;
    writeFileSync(join(outDir, `${appName}.ps1`), ps1Content);

    writeFileSync(
      join(outDir, "package.json"),
      JSON.stringify({ name: appName, version: appVersion, main: "main.js" }, null, 2),
    );

    console.log(`    ✅ ${appName}.bat`);
    console.log(`    ✅ ${appName}.ps1`);
  }

  // ── Step 7 (EXE only): Compile standalone EXE ─────────────
  if (isExe) {
    console.log(`  [7/${totalSteps}] Compiling standalone EXE...`);

    const debugEnv = isDebug ? `\nprocess.env.BUNTRON_DEBUG = "1";` : "";
    const wrapperSource = `
import { dirname } from "path";
const exeDir = dirname(process.execPath);
process.env.BUNTRON_ROOT = exeDir;
process.env.NODE_ENV = "production";${debugEnv}
await import("./main.js");
`;
    const wrapperPath = join(appDir, "_entry.ts");
    writeFileSync(wrapperPath, wrapperSource);

    const exeName = `${appName}.exe`;
    const exePath = join(outDir, exeName);

    const compileProc = Bun.spawnSync(
      ["bun", "build", "--compile", "--minify", "--target=bun-windows-x64", wrapperPath, "--outfile", exePath],
      { cwd: appDir, env: { ...process.env } },
    );

    if (compileProc.exitCode !== 0) {
      console.error("  ❌ EXE compilation failed:");
      console.error(compileProc.stderr.toString());
      process.exit(1);
    }

    // Patch PE header: CONSOLE(3) → GUI(2) — skip for debug builds
    if (!isDebug) {
      try {
        const peBuffer = readFileSync(exePath);
        const peOffset = peBuffer.readUInt32LE(0x3c);
        const subsystemOffset = peOffset + 4 + 20 + 68;
        if (peBuffer.readUInt16LE(subsystemOffset) === 3) {
          peBuffer.writeUInt16LE(2, subsystemOffset);
          writeFileSync(exePath, peBuffer);
          console.log("    ✅ Patched as GUI application (no console window)");
        }
      } catch (e) {
        console.warn("    ⚠️  Could not patch PE subsystem:", (e as Error).message);
      }
    } else {
      console.log("    ℹ️  Debug mode: console window kept");
    }

    console.log(`    ✅ ${exeName} compiled`);

    // Cleanup temp _build/
    try { rmSync(appDir, { recursive: true, force: true }); } catch {}

    // ── Summary ──────────────────────────────────────────────
    printExeSummary(outDir, exePath, exeName, runtimeDir, rendererOutDir, defaultOutDir, isDebug);
  } else {
    printDistSummary(outDir, appName, defaultOutDir);
  }
}

// ═══════════════════════════════════════════════════════════════
//  Renderer Build
// ═══════════════════════════════════════════════════════════════

async function buildViteRenderer(cwd: string, rendererOutDir: string) {
  const viteEntry = resolve(cwd, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(viteEntry)) {
    console.error("  ❌ vite not found in node_modules. Run: bun install");
    process.exit(1);
  }

  const result = Bun.spawnSync(
    ["bun", viteEntry, "build", "--outDir", resolve(rendererOutDir), "--emptyOutDir"],
    { cwd, stdout: "inherit", stderr: "inherit" },
  );

  if (result.exitCode !== 0) {
    console.error("  ❌ Vite renderer build failed");
    process.exit(1);
  }
  console.log("  ✅ Renderer built (Vite)");
}

function buildStaticRenderer(cwd: string, rendererOutDir: string) {
  mkdirSync(rendererOutDir, { recursive: true });

  let copied = false;
  for (const dir of ["src/renderer", "public"]) {
    const src = resolve(cwd, dir);
    if (existsSync(src)) {
      cpSync(src, rendererOutDir, { recursive: true });
      console.log(`    ✅ ${dir}/`);
      copied = true;
    }
  }
  if (!copied) {
    console.log("    ⚠️  No renderer files found");
  }
  console.log("  ✅ Renderer copied");
}

// ═══════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════

function printExeSummary(
  outDir: string, exePath: string, exeName: string,
  runtimeDir: string, rendererOutDir: string,
  defaultOutDir: string, isDebug: boolean,
) {
  const exeSize = (statSync(exePath).size / 1024 / 1024).toFixed(1);

  let runtimeSize = 0;
  for (const f of readdirSync(runtimeDir)) {
    runtimeSize += statSync(join(runtimeDir, f)).size;
  }

  let rendererSize = 0;
  if (existsSync(rendererOutDir)) {
    (function walk(dir: string) {
      for (const f of readdirSync(dir)) {
        const fp = join(dir, f);
        const st = statSync(fp);
        if (st.isDirectory()) walk(fp);
        else rendererSize += st.size;
      }
    })(rendererOutDir);
  }

  const runtimeMB = (runtimeSize / 1024 / 1024).toFixed(1);
  const rendererMB = (rendererSize / 1024 / 1024).toFixed(1);
  const totalMB = (parseFloat(exeSize) + parseFloat(runtimeMB) + parseFloat(rendererMB)).toFixed(1);

  const modeLabel = isDebug ? "Debug EXE" : "EXE";
  console.log(`
╔══════════════════════════════════════════════════╗
║          ✅ ${modeLabel} Build Complete!${" ".repeat(Math.max(0, 27 - modeLabel.length))}║
╚══════════════════════════════════════════════════╝

  📁 ${outDir}

  ${exeName.padEnd(25)} ${exeSize} MB
  renderer/                  ${rendererMB} MB
  runtime/                   ${runtimeMB} MB
  ─────────────────────────────────
  Total                      ${totalMB} MB
${isDebug ? "\n  ℹ️  Debug: console window + DevTools enabled" : ""}
  To run:   cd ${defaultOutDir} && .\\${exeName}
  Distribute: ZIP the '${defaultOutDir}' folder (requires WebView2 Runtime)
`);
}

function printDistSummary(outDir: string, appName: string, defaultOutDir: string) {
  let totalSize = 0;
  (function walk(dir: string) {
    for (const f of readdirSync(dir)) {
      const fp = join(dir, f);
      const st = statSync(fp);
      if (st.isDirectory()) walk(fp);
      else totalSize += st.size;
    }
  })(outDir);

  console.log(`
╔══════════════════════════════════════════════════╗
║          ✅ Build Complete!                       ║
╚══════════════════════════════════════════════════╝

  📁 ${outDir}   (${(totalSize / 1024 / 1024).toFixed(1)} MB)

  To run:   cd ${defaultOutDir} && bun run main.js
  Or use:   .\\${appName}.bat

  Requires: Bun runtime + WebView2 Runtime
`);
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

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
