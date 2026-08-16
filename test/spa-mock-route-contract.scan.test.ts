// DEC-817 (wave-53 amendment) / DEC-069 wave-53: closes the P1's ROOT CAUSE
// named in docs/eval-findings.md:70-78. "Remove co-presenter" shipped with
// no server route because its render test mocked the API
// (app/src/test-utils/mockApi.ts:23-36 resolves requests by the literal key
// "METHOD /api/v1/path") and nothing anywhere compared that belief against
// the live route table. This scan re-derives the population from every
// render/unit test's own mockApi keys and resolves each one through the ONE
// shared resolver (test/helpers/registered-routes.ts's resolveRegisteredRoute,
// DEC-817) instead of a second hand-written map.
//
// What this scan does NOT see (so a green run is never mistaken for a total
// proof, matching the honesty tradeoff of every other *.scan.test.ts in this
// repo): a mockApi key built from a runtime-computed string (a variable, a
// template with no literal "METHOD /" prefix, a spread) is invisible to this
// text scan -- only object-literal keys (quoted, or a computed `[`...`]`
// template literal) matching ^(GET|POST|PATCH|PUT|DELETE) / are extracted.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { resolveRegisteredRoute } from "./helpers/registered-routes";

const ROOT = join(__dirname, "..");
const APP_SRC = join(ROOT, "app", "src");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// Files whose mockApi keys are deliberately synthetic (the api-client's own
// unit tests exercise the client against paths no route serves), enumerated
// with a written reason per DEC-817 -- never a bare skip.
const EXEMPT_FILES = new Set<string>([
  // app/src/lib/api.test.ts: exercises apiGet/apiPost/etc directly against
  // hand-picked paths to assert header/error/retry plumbing; it does not
  // use mockApi at all, but is listed here per this task's explicit
  // enumeration so the exemption is documented alongside its siblings.
  join(APP_SRC, "lib", "api.test.ts"),
  // app/src/lib/api.unauthorized.render.test.ts: asserts the 401 ->
  // redirect-to-login behavior of the client itself; also does not call
  // mockApi with real route keys.
  join(APP_SRC, "lib", "api.unauthorized.render.test.ts"),
  // app/src/lib/useNavExceptions.test.tsx: exercises the nav-exception hook
  // against synthetic non-routes (e.g. '/events/ev-1/agenda/resolve', which
  // no route in src/routes/ serves) -- documented as out-of-scope for the
  // sibling DEC-817 scan (test/spa-mutation-contract.scan.test.ts) too.
  join(APP_SRC, "lib", "useNavExceptions.test.tsx"),
]);

interface MockKey {
  file: string;
  line: number;
  method: string;
  rawPath: string;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

const METHOD_ALT = "GET|POST|PATCH|PUT|DELETE";
// Quoted object-literal key: 'GET /api/v1/me': ... -- group 1: the whole
// "METHOD /path" text (a non-capturing method alternation keeps group
// numbering identical between the two regexes below).
const QUOTED_KEY_RE = new RegExp(`(['"])((?:${METHOD_ALT}) \\/[^'"]*)\\1\\s*:`, "g");
// Computed template-literal key: [\`GET /api/v1/submissions/${SUBMISSION_ID}/files\`]: ...
const COMPUTED_KEY_RE = new RegExp(`\\[\\s*\`((?:${METHOD_ALT}) \\/[^\`]*)\`\\s*\\]\\s*:`, "g");

function extractMockKeys(file: string, source: string): MockKey[] {
  const out: MockKey[] = [];
  for (const [re, group] of [
    [QUOTED_KEY_RE, 2],
    [COMPUTED_KEY_RE, 1],
  ] as const) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const full = m[group]!;
      const spaceIdx = full.indexOf(" ");
      const method = full.slice(0, spaceIdx);
      const rawPath = full.slice(spaceIdx + 1);
      out.push({ file, line: lineNumberAt(source, m.index), method, rawPath });
    }
  }
  return out;
}

function collectAllMockKeys(): MockKey[] {
  const files: string[] = [];
  walk(APP_SRC, files);
  const out: MockKey[] = [];
  for (const file of files) {
    if (EXEMPT_FILES.has(file)) continue;
    const source = readFileSync(file, "utf8");
    out.push(...extractMockKeys(file, source));
  }
  return out;
}

// Endpoints the scan has found the SPA declaring a belief in but which
// genuinely need to be built beyond this lane's scope. Empty today: every
// key this scan found either resolved to a real route already, or named a
// stale mock that was deleted as part of closing this task. Kept as a named,
// asserted-equal array per DEC-817 so a future gap can never be silently
// allow-listed away.
const UNBUILT_ENDPOINTS: { file: string; line: number; method: string; path: string; reason: string }[] = [];

describe("SPA mockApi keys resolve against the registered route table (DEC-817 wave-53)", () => {
  const allKeys = collectAllMockKeys();

  it("finds a population large enough that a rename can't make the scan go quiet", () => {
    // The tripwire is over every extracted key OCCURRENCE (one per
    // mockApi call site), not deduplicated by method+path -- the same
    // route is legitimately mocked at many call sites across the suite
    // (docs/eval-findings.md: ~1500 such keys across 61 files), and a
    // dedup would undercount the very renames this tripwire exists to
    // catch (a file rename that drops hundreds of call sites but leaves a
    // handful of distinct paths intact would still pass a distinct-string
    // check).
    expect(allKeys.length).toBeGreaterThanOrEqual(200);
  });

  it("negative control: a synthetic non-route does not resolve", () => {
    expect(resolveRegisteredRoute("PATCH", "/api/v1/nope/:param")).toBeUndefined();
  });

  it("every extracted mockApi key resolves to a registered route (or is a named UNBUILT_ENDPOINTS gap)", () => {
    const unbuiltSet = new Set(UNBUILT_ENDPOINTS.map((e) => `${e.method} ${e.path}`));
    const unresolved: string[] = [];
    const foundUnbuilt = new Set<string>();

    for (const key of allKeys) {
      const resolved = resolveRegisteredRoute(key.method, key.rawPath);
      const label = `${relative(ROOT, key.file)}:${key.line} ${key.method} ${key.rawPath}`;
      if (resolved) continue;
      const normalizedKey = `${key.method} ${key.rawPath.replace(/\$\{[^}]*\}/g, ":param").split("?")[0]}`;
      if (unbuiltSet.has(normalizedKey)) {
        foundUnbuilt.add(normalizedKey);
        continue;
      }
      unresolved.push(label);
    }

    expect(unresolved, `unresolved mockApi keys (missing route or stale mock):\n${unresolved.join("\n")}`).toEqual(
      [],
    );
    // Every declared UNBUILT_ENDPOINTS entry must actually be exercised by
    // the scan (an entry that never fires is a dead allow-list slot, which
    // DEC-817 forbids just as much as a silently-passed gap).
    expect(foundUnbuilt).toEqual(unbuiltSet);
  });
});
