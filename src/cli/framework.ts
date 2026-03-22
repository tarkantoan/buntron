// ============================================================
// Buntron CLI - Framework Detection
// ============================================================
// Auto-detects the frontend framework/bundler used in a project
// to configure dev server and build pipeline appropriately.
// ============================================================

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export interface FrameworkInfo {
  type: "vite" | "webpack" | "static";
  framework: "react" | "vue" | "svelte" | "solid" | "vanilla" | "static";
  devPort: number;
  rendererDir: string; // where renderer source lives
  buildOutDir: string; // where framework build outputs
}

export function detectFramework(cwd: string): FrameworkInfo {
  // Read package.json
  let deps: Record<string, string> = {};
  let devDeps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf-8"));
    deps = pkg.dependencies || {};
    devDeps = pkg.devDependencies || {};
  } catch {}

  const allDeps = { ...deps, ...devDeps };

  // Detect UI framework
  let framework: FrameworkInfo["framework"] = "static";
  if (allDeps["react"]) framework = "react";
  else if (allDeps["vue"]) framework = "vue";
  else if (allDeps["svelte"]) framework = "svelte";
  else if (allDeps["solid-js"]) framework = "solid";
  else if (allDeps["vite"]) framework = "vanilla";

  // Detect bundler
  const hasViteConfig = ["vite.config.ts", "vite.config.js", "vite.config.mjs"]
    .some(f => existsSync(resolve(cwd, f)));

  const hasViteDep = !!allDeps["vite"];

  if (hasViteConfig || hasViteDep) {
    return {
      type: "vite",
      framework,
      devPort: 5173,
      rendererDir: "src/renderer",
      buildOutDir: "dist/renderer",
    };
  }

  const hasWebpack = existsSync(resolve(cwd, "webpack.config.js"))
    || existsSync(resolve(cwd, "webpack.config.ts"))
    || !!allDeps["webpack"];

  if (hasWebpack) {
    return {
      type: "webpack",
      framework,
      devPort: 8080,
      rendererDir: "src/renderer",
      buildOutDir: "dist/renderer",
    };
  }

  return {
    type: "static",
    framework: "static",
    devPort: 0,
    rendererDir: "src/renderer",
    buildOutDir: "",
  };
}
