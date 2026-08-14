// w45-a: RENDER-SWEEP MANIFEST HONESTY. src/server/app.ts installs
// role-gating middleware via `app.use("<pattern>", ...)` blocks whose body
// throws/redirects unless `auth.role !== "<role>"` is false — i.e. the
// pattern only ever serves that one role (plus, separately, an anonymous
// redirect to /login). A ROUTE_MANIFEST/MOBILE_ROUTE_MANIFEST row whose
// declared `role` doesn't match the guard covering its path is a row the
// sweep's browser can never actually reach as that role — Playwright follows
// the redirect, so the row silently grades whatever it landed on instead of
// its own path (the /dev/mailbox vacuous-coverage bug this task fixes).
//
// This is a SOURCE SCAN (same family as test/render-sweep-manifest-parity.
// test.ts), not an app boot — it reads src/server/app.ts as text so it
// catches a guard pattern added at some future wave without anyone touching
// this file, same "family enumerated by hand rots" lesson as the field
// guide's FINDINGS entries.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { matchPattern } from "../src/server/pubcache";
import { ROUTE_MANIFEST } from "../app/src/routeManifest";
import { MOBILE_ROUTE_MANIFEST } from "../scripts/render-sweep";

interface GuardPattern {
  pattern: string;
  role: string;
}

/** Scans `source` for every `app.use("<pattern>", ...)` block whose body
 * contains `auth.role !== "<role>"`, returning one GuardPattern per match.
 * Pure string scan (no AST parsing) — blocks are delimited by successive
 * `app.use(` call starts, which is exact for src/server/app.ts's current
 * shape (one `app.use("literal", async (c, next) => { ... });` per guard). */
function scanGuardPatterns(source: string): GuardPattern[] {
  const useStarts: { index: number; pattern: string }[] = [];
  const useRe = /app\.use\(\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = useRe.exec(source)) !== null) {
    useStarts.push({ index: m.index, pattern: m[1]! });
  }

  const guards: GuardPattern[] = [];
  const roleRe = /auth\.role\s*!==\s*"([a-zA-Z]+)"/;
  for (let i = 0; i < useStarts.length; i++) {
    const start = useStarts[i]!.index;
    const end = i + 1 < useStarts.length ? useStarts[i + 1]!.index : source.length;
    const block = source.slice(start, end);
    const roleMatch = roleRe.exec(block);
    if (roleMatch) {
      guards.push({ pattern: useStarts[i]!.pattern, role: roleMatch[1]! });
    }
  }
  return guards;
}

const APP_TS_PATH = new URL("../src/server/app.ts", import.meta.url);

describe("route manifest / app.ts authz guard parity (w45-a)", () => {
  const source = readFileSync(APP_TS_PATH, "utf-8");
  const guards = scanGuardPatterns(source);

  it("is not vacuous: at least one guard pattern is actually found in src/server/app.ts", () => {
    expect(guards.length).toBeGreaterThan(0);
  });

  it("negative control: matchPattern does not match an unrelated path (sanity check on the pure predicate)", () => {
    expect(matchPattern("/dev/mailbox", "/admin/overview")).toBe(false);
    expect(matchPattern("/dev/mailbox/*", "/portal")).toBe(false);
  });

  it("positive control: matchPattern matches the guard patterns against their own literal path", () => {
    expect(matchPattern("/dev/mailbox", "/dev/mailbox")).toBe(true);
    expect(matchPattern("/dev/mailbox/*", "/dev/mailbox/seed_email_log_0001")).toBe(true);
  });

  it("every ROUTE_MANIFEST row matching a guard pattern declares that guard's role", () => {
    const violations: string[] = [];
    for (const guard of guards) {
      for (const entry of ROUTE_MANIFEST) {
        if (!matchPattern(guard.pattern, entry.path)) continue;
        if (entry.role !== guard.role) {
          violations.push(
            `app/src/routeManifest.ts row { path: "${entry.path}", role: "${entry.role}" } matches ` +
              `src/server/app.ts guard app.use("${guard.pattern}", ...) which requires role '${guard.role}'`,
          );
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every MOBILE_ROUTE_MANIFEST row matching a guard pattern declares that guard's role", () => {
    const violations: string[] = [];
    for (const guard of guards) {
      for (const entry of MOBILE_ROUTE_MANIFEST) {
        if (!matchPattern(guard.pattern, entry.path)) continue;
        if (entry.role !== guard.role) {
          violations.push(
            `scripts/render-sweep.ts MOBILE_ROUTE_MANIFEST row { path: "${entry.path}", role: "${entry.role}" } matches ` +
              `src/server/app.ts guard app.use("${guard.pattern}", ...) which requires role '${guard.role}'`,
          );
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
