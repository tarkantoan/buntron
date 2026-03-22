// ============================================================
// Buntron CLI - Package Command
// ============================================================
// Alias for `buntron build --exe` — produces standalone EXE.
// ============================================================

import { runBuild } from "./build";

export async function runPackage(args: string[]) {
  // Forward to build --exe
  const buildArgs = args.includes("--exe") ? args : ["--exe", ...args];
  await runBuild(buildArgs);
}
