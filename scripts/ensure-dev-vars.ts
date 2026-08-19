// DEC-187
// Restores zero-setup local dev after .dev.vars became untracked
// (DEC-183 committed it; operator commit 629d57e untracked it because a
// real secret had landed in the local file). This script never re-tracks
// .dev.vars — it only ensures a local copy exists by cloning the
// checked-in .dev.vars.example the first time a contributor runs the
// dev server. It must NEVER read or log the contents of an existing
// .dev.vars (it may contain a real local secret).
//
// PORT COUPLING (DEC-296) — the copied PUBLIC_BASE_URL is the DEFAULT dev
// port, and this script only ever seeds .dev.vars once. Anything serving
// this checkout on a different port (a snapshot/eval runner, a parallel
// lane, `--port` because 8787 was busy) must set PUBLIC_BASE_URL to ITS OWN
// origin, or every emailed absolute link the app renders ({portal_link},
// claim links, password resets) points at a port nothing is listening on —
// which reads as a product bug rather than a setup one. Either pass
// `--var PUBLIC_BASE_URL:http://localhost:<port>` on the wrangler dev
// invocation (the recipe under README "Deploying"), or edit the
// already-created .dev.vars and RESTART wrangler dev: it does not pick up
// .dev.vars edits while running. Do not "fix" this by changing the shipped
// default in .dev.vars.example — the default port is the right default, and
// deployed origins take their value from wrangler.jsonc's vars block.
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
