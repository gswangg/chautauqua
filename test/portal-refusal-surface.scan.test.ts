// DEC-945 (wave-65 amendment): every in-route refusal in the branded speaker
// portal must render the shared NotFoundDocument card (via portalNotFound in
// src/routes/portal/shared.tsx), never a bare `c.text(...)` response -- a
// signed-in speaker who follows a stale link deserves the same chrome and
// way back the gate above them and /portal/preview already give.
//
// Population is DERIVED by globbing src/routes/portal/**/*.ts(x) at test
// time (DEC-180: a hand-listed population is not a population) -- never a
// hand-maintained file list, so a new portal route file is covered for free.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SCAN_DIR = join(ROOT, "src/routes/portal");

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
}

function scanPortalFiles(): string[] {
  const files: string[] = [];
  walk(SCAN_DIR, files);
  return files;
}

describe("portal refusal surface scan (DEC-945 wave-65 amendment)", () => {
  it("the scan itself finds files under src/routes/portal (not vacuous)", () => {
    expect(scanPortalFiles().length).toBeGreaterThan(0);
  });

  it("no file under src/routes/portal contains a bare c.text( refusal", () => {
    const offenders: string[] = [];
    for (const file of scanPortalFiles()) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, idx) => {
        if (line.includes("c.text(")) {
          offenders.push(`${relative(ROOT, file).split("\\").join("/")}:${idx + 1}`);
        }
      });
    }

    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o}: bare c.text( response under src/routes/portal -- an in-route speaker-portal refusal must ` +
            `render the shared card via portalNotFound(c) from src/routes/portal/shared.tsx (DEC-945), never ` +
            `unstyled text/plain.`,
        )
        .join("\n"),
    ).toEqual([]);
  });
});
