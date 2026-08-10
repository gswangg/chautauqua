// scripts/seed-r2.ts (task w6-e, DEC-048): reads .seed-assets/manifest.json
// (written by scripts/seed.ts) and puts each {r2Key, path} entry into the
// local wrangler R2 bucket, so every file/resource/headshot row seed.ts
// inserts has matching bytes a judge can actually download.
//
// This is scripts/ tooling, not src/ pure-core, so node: imports are fine
// (DEC-002's pure-core rule scopes to src/{auth,domain,forms,mail,lib}).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const MANIFEST_PATH = join(REPO_ROOT, ".seed-assets", "manifest.json");

const R2_BUCKET = "chautauqua-files";

interface ManifestEntry {
  r2Key: string;
  path: string;
  contentType: string;
}

function main(): void {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      `seed-r2: manifest not found at ${MANIFEST_PATH} — run scripts/seed.ts first`,
    );
  }
  const manifest: ManifestEntry[] = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  if (manifest.length === 0) {
    throw new Error("seed-r2: manifest is empty — expected at least one seeded asset");
  }

  for (const entry of manifest) {
    if (!existsSync(entry.path)) {
      throw new Error(`seed-r2: asset file missing for ${entry.r2Key}: ${entry.path}`);
    }
    // Fail loudly (execFileSync throws on nonzero exit / spawn failure) —
    // no swallowed errors here, a broken local R2 put should stop the seed.
    execFileSync(
      "npx",
      ["wrangler", "r2", "object", "put", `${R2_BUCKET}/${entry.r2Key}`, "--local", "--file", entry.path],
      { cwd: REPO_ROOT, stdio: "inherit" },
    );
  }

  // eslint-disable-next-line no-console
  console.log(`seed-r2: put ${manifest.length} object(s) into local R2 bucket '${R2_BUCKET}'`);
}

main();
