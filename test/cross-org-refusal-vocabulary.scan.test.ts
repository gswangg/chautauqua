// DEC-005 (wave-50 amendment): ONE convention for a cross-org id — 404
// ("not found"), never 403 ("forbidden"). docs/AUDIT.md:189 states the rule:
// existence-hiding, so an attacker can't distinguish "not yours" from
// "doesn't exist". This scan is the tripwire that keeps it from drifting
// back: it fails on any reintroduction of the old "belongs to a different
// org" refusal string, and on any `ApiError("forbidden", ...)` call whose
// surrounding line compares an `orgId` variable to `auth.orgId` (the app-
// level cross-org gate shape) rather than a role gate, an ownership-of-
// relationship refusal (e.g. "not a participant"), or any other non-org-
// comparison 403.
//
// Deliberately narrow: it does NOT flag every `ApiError("forbidden"`
// (role gates, DEC-713 speaker-ownership refusals, and similar 403s that
// leak nothing the caller doesn't already know about their own relationship
// all stay 403), only the specific orgId-vs-auth.orgId comparison shape.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = "src/routes";
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (SKIP_DIRS.has(entry)) continue;
    const rel = join(dir, entry);
    const abs = join(ROOT, rel);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      out.push(...listFiles(rel));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(rel);
    }
  }
  return out;
}

// Matches an `ApiError("forbidden", ...)` call anywhere on the line.
const FORBIDDEN_CALL = /ApiError\(\s*["']forbidden["']/;
// Matches a line that also compares an `orgId`-named identifier to
// `auth.orgId` (either direction, `!==` or `===`), the app-level cross-org
// gate shape used across the route layer (e.g. `ownership.orgId !==
// auth.orgId`, `eventOrgId !== orgId`, `event.orgId !== auth.orgId`).
const ORG_COMPARISON = /\borgId\b.{0,40}(?:!==|===).{0,40}\bauth\.orgId\b|\bauth\.orgId\b.{0,40}(?:!==|===).{0,40}\borgId\b/;

describe("cross-org refusal vocabulary (DEC-005 wave-50 amendment)", () => {
  const files = listFiles(SRC_ROOT);
  expect(files.length).toBeGreaterThan(0);

  it("no route file contains the retired 'belongs to a different org' string", () => {
    const offenders: string[] = [];
    for (const rel of files) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      if (src.includes("belongs to a different org")) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no route file throws ApiError(\"forbidden\", ...) on a line comparing orgId to auth.orgId", () => {
    const offenders: string[] = [];
    for (const rel of files) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (FORBIDDEN_CALL.test(line) && ORG_COMPARISON.test(line)) {
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
