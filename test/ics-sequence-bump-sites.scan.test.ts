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
};

for (const key of Object.keys(LEDGER)) {
  const reason = LEDGER[key]!;
  if (/wave\s*\d+/i.test(reason) || /task-w\d+/i.test(reason) || /sibling lane/i.test(reason) || /branch/i.test(reason)) {
    throw new Error(`ledger entry for ${key} reads like a schedule/branch-name exemption, not a rule: ${reason}`);
  }
}

function fileText(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}

/** Comments never guard anything -- and a prose rationale sitting between a
 * guard and its call ("bump only when the name actually changed") would
 * otherwise be read as part of the condition. */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/** The text that CONTROLS the call: the condition of the ternary the call is
 * an arm of, else the header of the block that immediately encloses it
 * (`if (...) {`). Deliberately NOT "anything within N lines above" -- a
 * proximity window calls `src/routes/comms/send.ts` differential because an
 * unrelated `result.status === "rejected"` sits 20 lines up, which is the
 * exact false negative that lets a bare bump through. */
function enclosingGuard(text: string, callIndex: number): string {
  // (a) ternary arm: `cond ? bumpIcsSequences(...) : Promise.resolve()`.
  const stmtStart = Math.max(
    text.lastIndexOf(";", callIndex - 1),
    text.lastIndexOf("{", callIndex - 1),
    text.lastIndexOf(",", callIndex - 1),
    text.lastIndexOf("[", callIndex - 1),
  );
  const stmt = text.slice(stmtStart + 1, callIndex);
  const q = stmt.indexOf("?");
  if (q >= 0) return stmt.slice(0, q);

  // (b) nearest enclosing block: walk back to the unmatched `{`, then take
  // that block's header (back to the previous statement boundary), so a
  // multi-line `if (...)` condition is captured whole.
  let depth = 0;
  let open = -1;
  for (let i = callIndex - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "}") depth++;
    else if (ch === "{") {
      if (depth === 0) {
        open = i;
        break;
      }
      depth--;
    }
  }
  if (open < 0) return "";
  const headStart = Math.max(
    text.lastIndexOf(";", open),
    text.lastIndexOf("{", open - 1),
    text.lastIndexOf("}", open),
    0,
  );
  return text.slice(headStart + 1, open);
}

/** A guard is a differential when it compares against a stored/previous
 * value (===, !==, drizzle `ne(`, raw "IS NOT") or tests the emptiness of a
 * write's own `.returning()` rows -- the DB deciding nothing changed is the
 * strongest differential of all. A guard that is a bare boolean identifier
 * is resolved ONE level to its `const` initialiser. */
function isDifferentialText(raw: string, text: string, allowResolve: boolean): boolean {
  const guard = stripComments(raw);
  if (/!==|===|IS NOT|\bne\(/.test(guard)) return true;
  if (/\.length\s*(>|!==|===)/.test(guard)) return true;
  if (!allowResolve) return false;
  const ident = guard.replace(/^[\s(!]+|[\s)]+$/g, "").trim();
  if (!/^[A-Za-z_$][\w$]*$/.test(ident)) return false;
  const declRe = new RegExp(`\\bconst\\s+${ident}\\s*(?::[^=]+)?=`, "");
  const m = declRe.exec(text);
  if (!m) return false;
  const declEnd = text.indexOf(";", m.index);
  return isDifferentialText(text.slice(m.index, declEnd < 0 ? text.length : declEnd), text, false);
}

function isInsideDifferential(text: string, callIndex: number): boolean {
  return isDifferentialText(enclosingGuard(text, callIndex), text, true);
}

describe("ics_sequence bump call sites (DEC-519 wave-6): differential or ledgered, never bare", () => {
  /** Files with at least one call the differential walker cannot explain.
   * Derived by the per-site tests below, INDEPENDENTLY of the ledger, so the
   * ledger can be checked against it in both directions. */
  const measuredUnguarded: string[] = [];

  for (const site of CALL_SITES) {
    it(`${site.file} :: ${site.fnName} is differential-guarded or ledgered`, () => {
      const text = fileText(site.file);
      const re = new RegExp(`\\b${site.fnName}\\s*\\(`, "g");
      let match: RegExpExecArray | null;
      let found = false;
      let anyUnguarded = false;
      while ((match = re.exec(text))) {
        found = true;
        if (!isInsideDifferential(text, match.index)) anyUnguarded = true;
      }
      expect(found).toBe(true);
      if (anyUnguarded) measuredUnguarded.push(site.file);
      // The rule itself: a bare (non-differential) call is only allowed with
      // a rule-shaped ledger reason.
      expect(anyUnguarded && !(site.file in LEDGER)).toBe(false);
    });
  }

  it("the ledger names exactly the call sites the differential scan cannot itself explain (both directions)", () => {
    const ledgerKeys = Object.keys(LEDGER).sort();
    const measured = [...new Set(measuredUnguarded)].sort();
    // Every ledgered file must be a real call site...
    for (const key of ledgerKeys) {
      expect(CALL_SITES.some((s) => s.file === key)).toBe(true);
    }
    // ...and the ledger must equal the measured remainder: a new bare call
    // site fails loud (gap), and an entry whose call site later GAINED a
    // differential fails loud too (stale). This is the derived population
    // DEC-519's wave-6 amendment requires -- never a hand-listed one.
    expect(measured).toEqual(ledgerKeys);
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
