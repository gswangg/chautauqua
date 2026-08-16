// DEC-627 (amendment, wave 6): a source-scanning population test for "an
// all-optional PATCH must refuse an empty body". The population is derived
// from every `.patch(` route registration under src/routes/** -- a
// hand-listed population is not a population (DEC-180) -- and each one
// must, in its own handler body, do ONE of:
//
//   (a) call the shared src/server/http.ts helper `requireAtLeastOneField(`
//       -- the ONE owner for the "at least one recognised field was
//       supplied" rule (DEC-613's "two ladders for one rule" trap), or
//   (b) contain a required-field validation that provably cannot pass on
//       `{}` -- detected here as a route appearing in EXEMPT_ROUTES with a
//       RULE-SHAPED reason describing what the route is and why an empty
//       body is meaningful (or why it structurally 400s another way) --
//       never a wave, a branch or a schedule.
//
// The assertion runs in both directions: every scanned route must be
// guarded-or-ledgered, AND every ledger entry must still name a route this
// scan actually finds (so a route rename/removal can't leave a stale,
// unfalsifiable exemption sitting in the ledger forever).

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES_ROOT = path.resolve(__dirname, "..", "src", "routes");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

interface PatchRoute {
  file: string;
  line: number;
  path: string;
  body: string;
}

// Extracts the balanced-brace handler body text following a `.patch(...)`
// registration's `async (c) => {` (or `(c) => {`) opener, starting the scan
// from the registration's own opening paren so a route whose args span
// multiple lines (submissions.ts:797) is still found.
function extractPatchRoutes(content: string, file: string): PatchRoute[] {
  const routes: PatchRoute[] = [];
  const registerRe = /\.patch\(\s*(?:\r?\n\s*)?"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = registerRe.exec(content)) !== null) {
    const routePath = m[1] as string;
    const afterMatch = m.index + m[0].length;
    // Find the `{` that opens the async handler body -- the first `{`
    // after the LAST `=>` before the registration call's closing paren
    // balance reaches zero.
    let depth = 1; // we're already inside the `.patch(` call's own paren
    let i = afterMatch;
    let parenDepth = depth;
    let bodyStart = -1;
    while (i < content.length && bodyStart === -1) {
      const ch = content[i];
      if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth--;
      else if (ch === "{" && parenDepth >= 1) {
        // This is the handler's opening brace (still inside the outer call).
        bodyStart = i;
        break;
      }
      i++;
    }
    if (bodyStart === -1) continue;
    let braceDepth = 1;
    let j = bodyStart + 1;
    while (j < content.length && braceDepth > 0) {
      if (content[j] === "{") braceDepth++;
      else if (content[j] === "}") braceDepth--;
      j++;
    }
    const body = content.slice(bodyStart, j);
    const line = content.slice(0, m.index).split("\n").length;
    routes.push({ file, line, path: routePath, body });
  }
  return routes;
}

function scanAllPatchRoutes(): PatchRoute[] {
  const routes: PatchRoute[] = [];
  for (const file of walk(ROUTES_ROOT)) {
    const content = fs.readFileSync(file, "utf8");
    if (!content.includes(".patch(")) continue;
    const rel = path.relative(path.resolve(__dirname, ".."), file);
    routes.push(...extractPatchRoutes(content, rel));
  }
  return routes;
}

// DEC-627 (amendment, wave 6) ledger: routes NOT routed through
// requireAtLeastOneField because they already carry a required-field check
// that provably cannot pass on `{}`. Each reason names the required field
// and the mechanism -- never a wave, a branch or a schedule.
const EXEMPT_ROUTES: Record<string, string> = {
  "src/routes/tasks.ts:/task-assignments/:id":
    "`status` is required and validated before any other field is read " +
    "(`if (!status || !ASSIGNMENT_STATUSES.has(...))` throws 'invalid'); " +
    "an empty body always fails this check since body.status is undefined.",
  "src/routes/api/pipeline.ts:/pipeline/:id":
    "an explicit combined check (`if (!isMove && !hasFitScore && !hasRationale) throw ...`) " +
    "already refuses a PATCH that changes none of stage/fitScore/rationale, " +
    "which an empty body always is.",
  "src/routes/api/users.ts:/api/v1/users/:id":
    "`role` is required and validated before any other read " +
    "(`if (!isOrgUserRole(role)) throw ...`); an empty body yields " +
    "`role = \"\"`, which is never a valid org-user role.",
  "src/routes/api/submissions.ts:/submissions/:id/participants/:participantId":
    "an explicit combined check (`if (body.visible === undefined && " +
    "body.inviteStatus === undefined && body.role === undefined) throw ...`) " +
    "already refuses an empty body -- the same rule as requireAtLeastOneField, " +
    "written by hand before this helper existed on a 3-arg route the helper " +
    "does not read as cleanly (visible/inviteStatus/role are independently " +
    "typed booleans/strings, not a single derived record).",
};

describe("empty-patch-refusal population scan (DEC-627, wave 6 amendment)", () => {
  const routes = scanAllPatchRoutes();

  it("finds at least one .patch( registration (population sanity)", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it("every scanned PATCH route is guarded-or-ledgered", () => {
    const unaccountedFor: string[] = [];
    for (const route of routes) {
      const key = `${route.file}:${route.path}`;
      const guarded = route.body.includes("requireAtLeastOneField(");
      const ledgered = Object.prototype.hasOwnProperty.call(EXEMPT_ROUTES, key);
      if (!guarded && !ledgered) {
        unaccountedFor.push(`${key} (${route.file}:${route.line})`);
      }
    }
    expect(unaccountedFor).toEqual([]);
  });

  it("every ledger entry still names a route this scan finds (no stale exemptions)", () => {
    const found = new Set(routes.map((r) => `${r.file}:${r.path}`));
    const stale = Object.keys(EXEMPT_ROUTES).filter((key) => !found.has(key));
    expect(stale).toEqual([]);
  });

  it("no ledger reason cites a wave, a branch or a schedule (DEC-518's trap)", () => {
    const scheduleLike = /\bwave\s*\d+\b|\btask-w\d+|\bnext wave\b|\blater wave\b/i;
    const offenders = Object.entries(EXEMPT_ROUTES).filter(([, reason]) => scheduleLike.test(reason));
    expect(offenders).toEqual([]);
  });
});
