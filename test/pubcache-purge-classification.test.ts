// DEC-627: "a closed two-list enumeration" is only trustworthy if it's
// actually closed -- this test enumerates every mutating route registration
// under src/routes/** from source (never a hand-copied list, per the field
// guide's "hand-listed manifests desync -- enumerate in a test") and
// requires each one to match exactly one of pubcache.ts's NEVER_PUBLIC /
// PUBLIC_AFFECTING patterns via the real affectsPublicOutput() predicate.
//
// Full mount paths are resolved from source too: src/index.ts's
// `app.route(prefix, subApp)` calls and any nested `x.route(prefix, y)`
// composition (src/routes/review/index.ts folds its four sub-apps into
// `reviewRoutes` before index.ts mounts that) are parsed into a prefix
// map, walked recursively back to the root ("app"), and concatenated with
// each route's own literal path.
//
// w8-g: DEC-627's enumeration only ran in one direction (every route ->
// some pattern). This file adds the other direction: every pattern in
// NEVER_PUBLIC/PUBLIC_AFFECTING must match at least one real registered
// route (no dead patterns), the two lists must never both match the same
// route (disjointness, with one documented, narrow exception below), and
// neither list may contain a duplicate pattern. On this pass every pattern
// in both lists turned out to be live -- no dead pattern or typo was found,
// so that direction is invariant lock-in (a green result on day one is the
// correct outcome, not a sign the check is toothless). The disjointness
// check did surface one real, already-safe overlap; see
// KNOWN_WILDCARD_SHADOW_OVERLAPS below for the finding and why it's fine.

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  PUBVER_KEY,
  bumpPublicVersionMiddleware,
  classifyMutatingPath,
  matchPattern,
  NEVER_PUBLIC,
  PUBLIC_AFFECTING,
} from "../src/server/pubcache";
import { enumerateRegisteredRoutes } from "./helpers/registered-routes";
import type { KVStore } from "../src/lib/draft";
import type { AppEnv } from "../src/server/env";

const REPO_ROOT = join(__dirname, "..");

function relativePath(file: string): string {
  return file.slice(REPO_ROOT.length + 1);
}

interface MutatingRoute {
  file: string;
  line: number;
  method: string;
  fullPath: string;
}

// This test only cares about mutating verbs (GET registrations are excluded
// here -- see test/docs-api-coverage.test.ts for a consumer that wants the
// full, unfiltered set including GET).
const mutatingRoutes: MutatingRoute[] = enumerateRegisteredRoutes()
  .filter((r) => r.method !== "GET")
  .map((r) => ({ file: r.file, line: r.line, method: r.method, fullPath: r.path }));

describe("DEC-627: source-scanned mutating routes are all classified", () => {
  it("finds at least 60 mutating route registrations (scanner sanity check)", () => {
    expect(mutatingRoutes.length).toBeGreaterThanOrEqual(60);
  });

  it("every registered .post/.patch/.put/.delete route resolves a concrete, absolute full path", () => {
    for (const r of mutatingRoutes) {
      expect(r.fullPath.startsWith("/"), `${relativePath(r.file)}:${r.line} resolved to "${r.fullPath}"`).toBe(true);
    }
  });

  it("every mutating route matches exactly one of the two closed lists", () => {
    const offenders: string[] = [];
    for (const r of mutatingRoutes) {
      const classification = classifyMutatingPath(r.fullPath);
      if (classification === "unclassified") {
        offenders.push(
          `  ${relativePath(r.file)}:${r.line}: ${r.method} ${r.fullPath} matches neither NEVER_PUBLIC nor ` +
            `PUBLIC_AFFECTING in src/server/pubcache.ts -- add a pattern to exactly one list.`,
        );
      }
    }
    if (offenders.length > 0) {
      throw new Error(`Found ${offenders.length} unclassified mutating route(s):\n${offenders.join("\n")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("every pattern in NEVER_PUBLIC and PUBLIC_AFFECTING matches at least one registered mutating route", () => {
    const dead: string[] = [];
    for (const pattern of NEVER_PUBLIC) {
      if (!mutatingRoutes.some((r) => matchPattern(pattern, r.fullPath))) {
        dead.push(`  NEVER_PUBLIC: "${pattern}" matches no registered mutating route.`);
      }
    }
    for (const pattern of PUBLIC_AFFECTING) {
      if (!mutatingRoutes.some((r) => matchPattern(pattern, r.fullPath))) {
        dead.push(`  PUBLIC_AFFECTING: "${pattern}" matches no registered mutating route.`);
      }
    }
    if (dead.length > 0) {
      throw new Error(`Found ${dead.length} dead pattern(s) in pubcache.ts's closed lists:\n${dead.join("\n")}`);
    }
    expect(dead).toEqual([]);
  });

  // DEC-627 finding (w8-g, added when this disjointness test was written): the
  // single-segment ":seg" wildcard in matchPattern matches ANY literal value,
  // so PUBLIC_AFFECTING's "/api/v1/contacts/:id" (for the real PATCH
  // /contacts/:id route in src/routes/api/contacts/crud.ts) also syntactically
  // matches the literal sibling static route registered as POST
  // /api/v1/contacts/bulk-email (src/routes/api/contacts/bulk-email.ts:128).
  // This is NOT a live misclassification: classifyMutatingPath checks
  // NEVER_PUBLIC first (see its own doc comment and the "every mutating
  // route matches exactly one of the two closed lists" test above), and
  // NEVER_PUBLIC already lists "/api/v1/contacts/bulk-email*" explicitly, so
  // that route is correctly classified never-public in production. It is a
  // known, narrow limitation of a wildcard segment being unable to exclude a
  // sibling literal path in this pattern language, not a dead pattern or a
  // typo to fix — allowlisted here by exact resolved path, with this
  // rationale, rather than silently weakening the check for every route.
  const KNOWN_WILDCARD_SHADOW_OVERLAPS = new Set<string>(["/api/v1/contacts/bulk-email"]);

  it("no registered mutating route matches patterns in both NEVER_PUBLIC and PUBLIC_AFFECTING (disjointness)", () => {
    const overlaps: string[] = [];
    for (const r of mutatingRoutes) {
      if (KNOWN_WILDCARD_SHADOW_OVERLAPS.has(r.fullPath)) continue;
      const inNeverPublic = NEVER_PUBLIC.some((p) => matchPattern(p, r.fullPath));
      const inPublicAffecting = PUBLIC_AFFECTING.some((p) => matchPattern(p, r.fullPath));
      if (inNeverPublic && inPublicAffecting) {
        overlaps.push(`  ${relativePath(r.file)}:${r.line}: ${r.method} ${r.fullPath} matches both lists.`);
      }
    }
    if (overlaps.length > 0) {
      throw new Error(`Found ${overlaps.length} route(s) matching both closed lists:\n${overlaps.join("\n")}`);
    }
    expect(overlaps).toEqual([]);
  });

  it("no duplicate pattern exists within or across NEVER_PUBLIC and PUBLIC_AFFECTING", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [listName, list] of [
      ["NEVER_PUBLIC", NEVER_PUBLIC],
      ["PUBLIC_AFFECTING", PUBLIC_AFFECTING],
    ] as const) {
      for (const pattern of list) {
        const prior = seen.get(pattern);
        if (prior) {
          dupes.push(`  "${pattern}" appears in both ${prior} and ${listName} (or twice within one list).`);
        } else {
          seen.set(pattern, listName);
        }
      }
    }
    if (dupes.length > 0) {
      throw new Error(`Found ${dupes.length} duplicate pattern(s):\n${dupes.join("\n")}`);
    }
    expect(dupes).toEqual([]);
  });
});

// DEC-024 (wave-22 amendment): a membership test ("matches exactly one of
// the two lists") cannot detect a MISclassification -- the whole failure
// mode this amendment fixes is a route sitting in the wrong one of two
// lists it's disjointly a member of. This DIRECTED arm names specific
// writer routes that MUST resolve to PUBLIC_AFFECTING (not merely "some
// list"), each paired with the exact public-reader coordinate it justifies
// the classification against, so a future regression that quietly moves one
// back to NEVER_PUBLIC fails loudly here even though it would still pass
// every "matches exactly one list" test above.
interface DirectedPair {
  writerRoute: string;
  publicReaderCoordinate: string;
  reason: string;
}

const DIRECTED_PUBLIC_AFFECTING: DirectedPair[] = [
  {
    writerRoute: "PATCH /api/v1/forms/:formId",
    publicReaderCoordinate: "src/server/repo/public/event.ts getPublicCfpWindow",
    reason:
      "writes form.openDate/closeDate; getPublicCfpWindow reads exactly those columns for the cached " +
      "/e/:slug/sessions CFP rail (via src/routes/public/sessions.tsx's formWindowState call).",
  },
  {
    writerRoute: "PATCH /api/v1/fields/:fieldId",
    publicReaderCoordinate: "src/server/repo/public/event.ts getPublicFormatOptions",
    reason:
      "can change a session_format-role field's options (or grant/clear the role itself); " +
      "getPublicFormatOptions reads that role's options for the cached /e/:slug/sessions format chips.",
  },
  {
    // Non-vacuity control: an already-correct pair, so this arm is not
    // trivially satisfied by the two new rows alone.
    writerRoute: "POST /api/v1/events/:eventId/submissions/status",
    publicReaderCoordinate: "src/server/repo/public/gates.ts visibleSessionConditions (via content_status)",
    reason: "flips a submission's accepted/visible status, which the public gate reads directly.",
  },
];

describe("DEC-024 (wave-22 amendment): directed writer -> PUBLIC_AFFECTING pairs", () => {
  it("is non-vacuous (more than the two routes this amendment adds)", () => {
    expect(DIRECTED_PUBLIC_AFFECTING.length).toBeGreaterThanOrEqual(3);
  });

  it("every named writer route classifies public-affecting specifically (not just 'some list')", () => {
    const offenders: string[] = [];
    for (const { writerRoute, publicReaderCoordinate, reason } of DIRECTED_PUBLIC_AFFECTING) {
      const [method, path] = writerRoute.split(" ");
      const classification = classifyMutatingPath(path!);
      if (classification !== "public-affecting") {
        offenders.push(
          `  ${method} ${path} must classify "public-affecting" (reader: ${publicReaderCoordinate} -- ${reason}) ` +
            `but classified "${classification}".`,
        );
      }
    }
    if (offenders.length > 0) {
      throw new Error(`Found ${offenders.length} misclassified directed writer(s):\n${offenders.join("\n")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("every directed writer route is a real registered mutating route (no stale/typo'd row)", () => {
    for (const { writerRoute } of DIRECTED_PUBLIC_AFFECTING) {
      const [method, path] = writerRoute.split(" ");
      const live = mutatingRoutes.some((r) => r.method === method && matchPattern(path!, r.fullPath));
      expect(live, `${writerRoute} does not match any registered mutating route`).toBe(true);
    }
  });
});

// DEC-024 (wave-22 amendment): a request-level receipt that a PATCH to a
// form's closeDate actually bumps the public version -- the same
// bumpPublicVersionMiddleware + fakeKv harness test/pubcache.test.ts's own
// "bumpPublicVersionMiddleware (DEC-427)" describe block uses, reused here
// rather than inventing a second mock stack.
function fakeKv(initial: Record<string, string> = {}): KVStore & { store: Record<string, string> } {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    async get(key) {
      return key in store ? store[key]! : null;
    },
    async put(key, value) {
      store[key] = value;
    },
    async delete(key) {
      delete store[key];
    },
  };
}

describe("DEC-024 (wave-22 amendment): a form closeDate PATCH bumps the public version", () => {
  function buildApp(kv: KVStore) {
    const app = new Hono<AppEnv>();
    app.use("*", bumpPublicVersionMiddleware);
    app.patch("/api/v1/forms/:formId", (c) => c.json({ ok: true }, 200));
    return { app, env: { KV: kv } as unknown as AppEnv["Bindings"] };
  }

  it("PATCH /api/v1/forms/:formId (closing the CFP) bumps chq:pubver", async () => {
    const kv = fakeKv({ [PUBVER_KEY]: "v0" });
    const { app, env } = buildApp(kv);

    const res = await app.request(
      "/api/v1/forms/f1",
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ closeDate: 1700000000000 }) },
      env,
    );

    expect(res.status).toBe(200);
    expect(kv.store[PUBVER_KEY]).not.toBe("v0");
  });
});
