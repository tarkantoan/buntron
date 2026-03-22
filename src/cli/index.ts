#!/usr/bin/env bun
// ============================================================
// Buntron CLI - Entry Point
// ============================================================

import { resolve } from "path";

const args = process.argv.slice(2);
const command = args[0] || "help";

async function main() {
  switch (command) {
    case "init":
    case "create":
      const { runInit } = await import("./init");
      await runInit(args.slice(1));
      break;

    case "dev":
    case "start":
      const { runDev } = await import("./dev");
      await runDev(args.slice(1));
      break;

    case "build":
      const { runBuild } = await import("./build");
      await runBuild(args.slice(1));
      break;

    case "package":
    case "pack":
      const { runPackage } = await import("./package-cmd");
      await runPackage(args.slice(1));
      break;

    case "setup":
      const { runSetup } = await import("../../scripts/setup");
      await runSetup();
      break;

    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;

    case "version":
    case "--version":
    case "-v":
      printVersion();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════╗
║              🚀 Buntron CLI                      ║
║   Electron-like Framework Powered by Bun         ║
╚══════════════════════════════════════════════════╝

Usage: buntron <command> [options]

Commands:
  init [name]         Create a new Buntron project
  dev                 Start development mode with HMR
  build               Production build → dist/
  build --exe         Standalone EXE → release/
  build --exe --debug Debug EXE (console + DevTools)
  package             Alias for build --exe
  setup               Download WebView2 SDK & compile host
  help                Show this help message
  version             Show version

Init Templates:
  --react             Vite + React + TypeScript
  --vue               Vite + Vue + TypeScript
  (default)           Static HTML/CSS/JS

Build Options:
  --exe               Compile into standalone .exe
  --debug             Keep console window + enable DevTools (EXE only)
  --outdir <dir>      Custom output directory

Examples:
  buntron init my-app            Static HTML project
  buntron init my-app --react    React + Vite project
  buntron init my-app --vue      Vue + Vite project
  buntron dev                    Start dev server
  buntron build                  Production build
  buntron build --exe            Standalone EXE
  buntron build --exe --debug    Debug EXE with console
`);
}

function printVersion() {
  try {
    const pkg = require("../../package.json");
    console.log(`buntron v${pkg.version}`);
  } catch {
    console.log("buntron v1.0.0");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
