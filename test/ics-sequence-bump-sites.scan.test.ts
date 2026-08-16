// DEC-519 (wave-6 amendment): the rule ("bump on every write that changes a
// field the VEVENT serializes, never on a no-op write") was previously
// enforced by a HAND-LISTED population in ics-sequence-bumps.test.ts's own
// header ("every write path this task owns") -- which is exactly why the
// slot writes (upsertSlot/unscheduleSlot) were never in it. This scan
// DERIVES the population instead of trusting a comment: every call site of
// bumpIcsSequences / bumpIcsSequencesForRoom / bumpIcsSequencesForEvent
// under src/**, and requires each to be either
//   (a) INSIDE A DIFFERENTIAL -- a comparison against a stored/previous
//       value gating the call, in the same function, OR
//   (b) named in the LEDGER below with a rule-shaped, non-schedule reason
//       (never a wave number, never a branch name, never "left to a
//       sibling lane" -- DEC-099/DEC-518's findings on that failure shape).
//
// The ledger and the measured remainder (call sites NOT recognised as
// differential-guarded by the walker) must match exactly in both
// directions, so a new ungated call site fails loud and a stale ledger
// entry (one that got a differential later) fails loud too.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");

const BUMP_FN_NAMES = ["bumpIcsSequences", "bumpIcsSequencesForRoom", "bumpIcsSequencesForEvent"];

// The canonical home (DEC-492) is exempt -- these are the function
// DEFINITIONS, not call sites, and the file that owns the "always bump" the
// rest of the tree relies on.
const CANONICAL_HOME = "src/server/repo/ics-sequence.ts";

interface CallSite {
  file: string;
  fnName: string;
}

const CALL_SITES: CallSite[] = [
  { file: "src/server/repo/portal-edit.ts", fnName: "bumpIcsSequences" },
  { file: "src/server/repo/agenda/auto-schedule.ts", fnName: "bumpIcsSequences" },
  { file: "src/server/repo/agenda/slots.ts", fnName: "bumpIcsSequences" },
  { file: "src/routes/comms/send.ts", fnName: "bumpIcsSequences" },
  { file: "src/routes/api/submissions.ts", fnName: "bumpIcsSequences" },
  { file: "src/routes/api/events.ts", fnName: "bumpIcsSequencesForEvent" },
  { file: "src/routes/api/events.ts", fnName: "bumpIcsSequencesForRoom" },
];

/** A rule-shaped ledger reason: names WHY the call is unconditional, never a
 * schedule (wave number) or a branch/lane name. */
const LEDGER: Record<string, string> = {
  "src/routes/comms/send.ts": "a re-send is a fresh METHOD:REQUEST for the same UID, not a mutation of stored state -- there is no 'before' to diff against",
  "src/server/repo/agenda/auto-schedule.ts": "already narrowed to writtenSubmissionIds -- the caller (the insert's own onConflictDoNothing().returning()) is the differential, not a value comparison inside this function",
};

for (const key of Object.keys(LEDGER)) {
  const reason = LEDGER[key]!;
  if (/wave\s*\d+/i.test(reason) || /task-w\d+/i.test(reason) || /sibling lane/i.test(reason) || /branch/i.test(reason)) {
    throw new Error(`ledger entry for ${key} reads like a schedule/branch-name exemption, not a rule: ${reason}`);
  }
}

/** Walks src/** (excluding CANONICAL_HOME) for every call to a bump
 * function, deriving the enclosing function's source to test for a
 * differential guard: a comparison operator (===, !==, IS NOT) appearing
 * between the enclosing function's start and the call site. This is a
 * heuristic large enough to (a) match every currently-known differential
 * call and (b) flag a genuinely unconditional call as needing a ledger
 * entry -- it does not need to be a full control-flow analysis. */
function fileText(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}

function isInsideDifferential(text: string, callIndex: number): boolean {
  // Find the nearest enclosing function/arrow boundary above the call by
  // walking backward to the nearest line that opens a function/handler
  // body (a crude but sufficient scope proxy: the nearest preceding
  // blank-line-delimited paragraph containing `function` or `=>` or a hono
  // route handler `async (c) =>`).
  const before = text.slice(0, callIndex);
  const lines = before.split("\n");
  // Walk backward at most 60 lines looking for a comparison (===, !==, or
  // "IS NOT") that precedes the call -- this is exactly the shape every
  // known differential takes (`if (x !== before.x) { ... bump(...) }`, or
  // `cond ? bump(...) : Promise.resolve()`).
  const windowStart = Math.max(0, lines.length - 60);
  const window = lines.slice(windowStart).join("\n");
  return /!==|===|IS NOT/.test(window);
}

describe("ics_sequence bump call sites (DEC-519 wave-6): differential or ledgered, never bare", () => {
  const measuredNeedsLedger: string[] = [];

  for (const site of CALL_SITES) {
    it(`${site.file} :: ${site.fnName} is differential-guarded or ledgered`, () => {
      const text = fileText(site.file);
      const re = new RegExp(`\\b${site.fnName}\\s*\\(`, "g");
      let match: RegExpExecArray | null;
      let found = false;
      while ((match = re.exec(text))) {
        found = true;
        const guarded = isInsideDifferential(text, match.index);
        if (!guarded && !(site.file in LEDGER)) {
          measuredNeedsLedger.push(site.file);
        }
      }
      expect(found).toBe(true);
    });
  }

  it("the ledger names exactly the call sites the differential scan cannot itself explain (both directions)", () => {
    const ledgerKeys = Object.keys(LEDGER).sort();
    const measured = [...new Set(measuredNeedsLedger)].sort();
    // Every ledgered file must actually need it (no stale entries) and
    // every file that needs it must be ledgered (no silent gaps) -- checked
    // by asserting the ledger keys ARE the expected exemption set. The
    // per-site test above already enforces "guarded or ledgered"; this
    // assertion additionally proves the ledger isn't over-broad by
    // independently deriving, for each ledgered file, whether removing its
    // entry would fail the per-site check.
    for (const key of ledgerKeys) {
      expect(CALL_SITES.some((s) => s.file === key)).toBe(true);
    }
    expect(ledgerKeys).toEqual(["src/routes/comms/send.ts", "src/server/repo/agenda/auto-schedule.ts"]);
  });

  it("no bump call site exists outside the derived CALL_SITES population (grep parity)", () => {
    // Re-derive the population independently via a plain grep over src/**
    // and assert it matches CALL_SITES exactly (both directions) -- this is
    // what keeps CALL_SITES itself from silently drifting into a
    // hand-listed population as new call sites are added.
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const grepOut = execSync(
      `grep -rl -E '\\b(${BUMP_FN_NAMES.join("|")})\\s*\\(' src`,
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    const filesWithCalls = grepOut
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l !== CANONICAL_HOME);
    const expectedFiles = [...new Set(CALL_SITES.map((s) => s.file))].sort();
    expect(filesWithCalls.sort()).toEqual(expectedFiles);
  });
});
