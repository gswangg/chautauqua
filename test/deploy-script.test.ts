// task-w6-d: `npm run deploy` must apply D1 migrations before deploying the
// Worker (one idempotent command, operator-run only), and no CI workflow may
// invoke `wrangler deploy` -- deploys are never CI-run (see README.md
// "Deploying" / "Stage 2").

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

describe("deploy script", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const deployScript: string = pkg.scripts.deploy;

  it("applies D1 migrations before invoking wrangler deploy", () => {
    expect(deployScript).toBeTruthy();
    const migrationsIdx = deployScript.indexOf("wrangler d1 migrations apply chautauqua --remote");
    const deployIdx = deployScript.indexOf("wrangler deploy");
    expect(migrationsIdx).toBeGreaterThanOrEqual(0);
    expect(deployIdx).toBeGreaterThan(migrationsIdx);
  });

  it("is a single chained command (migrations must succeed before deploy runs)", () => {
    expect(deployScript).toContain("&&");
  });

  it("no file under .github/workflows/ calls wrangler deploy", () => {
    const workflowsDir = join(ROOT, ".github", "workflows");
    const files = readdirSync(workflowsDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const contents = readFileSync(join(workflowsDir, f), "utf8");
      expect(contents).not.toContain("wrangler deploy");
      expect(contents).not.toContain("npm run deploy");
    }
  });
});
