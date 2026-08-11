// DEC-187
// Restores zero-setup local dev after .dev.vars became untracked
// (DEC-183 committed it; operator commit 629d57e untracked it because a
// real secret had landed in the local file). This script never re-tracks
// .dev.vars — it only ensures a local copy exists by cloning the
// checked-in .dev.vars.example the first time a contributor runs the
// dev server. It must NEVER read or log the contents of an existing
// .dev.vars (it may contain a real local secret).
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function ensureDevVars(rootDir: string): "created" | "exists" {
  const devVarsPath = join(rootDir, ".dev.vars");
  if (existsSync(devVarsPath)) {
    return "exists";
  }
  const examplePath = join(rootDir, ".dev.vars.example");
  if (!existsSync(examplePath)) {
    throw new Error(
      `ensure-dev-vars: ${examplePath} is missing; cannot create .dev.vars`,
    );
  }
  copyFileSync(examplePath, devVarsPath);
  console.log("ensure-dev-vars: created .dev.vars from .dev.vars.example");
  return "created";
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureDevVars(REPO_ROOT);
}
