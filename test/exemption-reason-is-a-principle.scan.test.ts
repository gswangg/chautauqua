// DEC-099 (wave-76 amendment, widened wave 4): "an exemption reason may
// never be a branch name." This scan machine-checks that rule. It walks
// every *.test.ts / *.test.tsx file under test/ and app/src/, and fails,
// naming file:line and the offending string, if any STRING LITERAL assigned
// to a `reason:` property (or contained in an EXEMPTIONS/KNOWN_*/ledger
// array element) matches /task-w\d+-[a-z]/ -- a branch name standing in for
// a principle -- OR reads as SCHEDULE-SHAPED prose (see below).
//
// THE RULE IS ABOUT SHAPE, NOT VOCABULARY. A branch token is only the most
// literal way to write "this doesn't hold up on its own, wait for something
// else to happen" -- the same defect recurs every time a reason cites a
// point on a calendar (this wave / next wave / a later wave), a merge event
// (unmerged / until X lands / being converted), or an act of deferred review
// (not yet reviewed / unreviewed / we have not looked / filed for a later
// wave) instead of the INVARIANT that makes the exemption correct forever.
// A durable reason must survive with every branch name and every wave
// number deleted from the codebase; a schedule-shaped reason cannot, by
// construction, because its truth is tied to a future event rather than to
// a fact about the code. Wave 76 caught the branch-token instance of this
// shape; wave 4 widens the scan to the vocabulary that lets the same defect
// travel with the branch name filed off.
//
// Comments and file headers are NOT scanned -- explanatory prose about a
// branch's history (e.g. "task-w53-e landed this in wave 55") stays legal.
// Only the reason STRING a guard is disabled with is governed, so this scan
// strips line comments before matching and only looks at `reason:` (or
// `reason =`) assignments' string-literal values.
//
// Two ancestors this rule closes: app/src/confirm-primary-object.scan.
// test.ts's EXEMPT_DIRS comment cited "unmerged branch task-w66-i at wave
// 68", and app/src/refusal-rendering-ledger.scan.test.ts's FormsPage.tsx row
// cited "owned by task-w53-e" -- both branches long gone from
// .git/refs/heads/* and .git/packed-refs. Wave 76 closed both by hand; this
// scan makes sure a THIRD one can't land the same way. Wave 4 closes a
// vocabulary-only escape from the same rule: test/wire-field-reader.scan.
// test.ts:287-291 exempted ResultsRow.perDropdown with "a sibling task in
// this wave owns wiring ResultsTable.tsx's Choice-criterion distribution
// end to end" -- schedule-shaped, no branch token, same defect.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE); // test/ -> repo root
const SELF = fileURLToPath(import.meta.url);

const BRANCH_NAME_RE = /task-w\d+-[a-z]/;

// Schedule-shaped prose: a reason tied to a future event (a wave, a merge,
// a review that hasn't happened) rather than to an invariant about the
// code. Same defect as BRANCH_NAME_RE, vocabulary-only escape closed.
const SCHEDULE_PHRASE_RE =
  /sibling task|this wave|a later wave|next wave|unmerged|until .{0,40} lands|for now|temporarily|being converted|not yet reviewed|unreviewed|we have not looked|filed for a later/i;

function isScheduleShaped(value: string): boolean {
  return BRANCH_NAME_RE.test(value) || SCHEDULE_PHRASE_RE.test(value);
}

// A `reason:` (object property, TS-quoted or not) or `reason =` assignment,
// followed by a single- or double-quoted string literal. Matches across
// both `reason: 'x'` (object literal) and `.reason = 'x'` shapes.
const REASON_ASSIGNMENT_RE = /\breason\s*[:=]\s*(['"])((?:\\.|(?!\1).)*)\1/g;

/** Strips `//` line comments (never touches string contents that happen to
 * contain `//`, since we only strip from an UNQUOTED `//` onward -- good
 * enough for this repo's straightforward single-line-comment style, and this
 * scan only cares about `reason:` literals which never contain `//`). */
function stripLineComments(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      // Only strip a `//` that isn't inside a string literal on this line.
      // Cheap heuristic: count unescaped quote chars before the `//`; if
      // even, we're outside a string.
      const idx = line.indexOf('//');
      if (idx === -1) return line;
      const before = line.slice(0, idx);
      const singleQuotes = (before.match(/(?<!\\)'/g) ?? []).length;
      const doubleQuotes = (before.match(/(?<!\\)"/g) ?? []).length;
      if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
        return before;
      }
      return line;
    })
    .join('\n');
}

function walkTestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkTestFiles(full));
    } else if (/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function findLineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function findOffenders(roots: string[]): string[] {
  const offenders: string[] = [];
  for (const root of roots) {
    for (const file of walkTestFiles(root)) {
      // Skip this scan's own file: its negative-control fixtures are
      // string literals DEMONSTRATING the pattern, not real `reason:`
      // guards -- scanning them would be the scan flagging its own test
      // data, not a live exemption.
      if (file === SELF) continue;
      const relPath = relative(REPO_ROOT, file);
      const raw = readFileSync(file, 'utf8');
      const stripped = stripLineComments(raw);

      REASON_ASSIGNMENT_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = REASON_ASSIGNMENT_RE.exec(stripped))) {
        const value = m[2] as string;
        if (isScheduleShaped(value)) {
          offenders.push(`${relPath}:${findLineNumber(stripped, m.index)}: "${value}"`);
        }
      }
    }
  }
  return offenders;
}

describe('DEC-099 (wave 76, widened wave 4): an exemption reason may never be schedule-shaped', () => {
  it('no reason string under test/ or app/src/ names a branch or reads as schedule-shaped', () => {
    const offenders = findOffenders([join(REPO_ROOT, 'test'), join(REPO_ROOT, 'app', 'src')]);
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  // Synthetic negative control: a reason string naming a branch IS flagged.
  it('[negative control] flags a synthetic reason that names a branch', () => {
    const fixture = `const LEDGER = { 'x.tsx': { verdict: 'owed', reason: 'owned by task-w53-e (?cascade=1); ledger row filed' } };`;
    REASON_ASSIGNMENT_RE.lastIndex = 0;
    const m = REASON_ASSIGNMENT_RE.exec(fixture);
    expect(m).not.toBeNull();
    expect(isScheduleShaped((m as RegExpExecArray)[2] as string)).toBe(true);
  });

  // Positive control: a principled generic reason is never flagged.
  it('[positive control] does not flag a principled reason with no branch name', () => {
    const fixture = `const LEDGER = { 'x.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' } };`;
    REASON_ASSIGNMENT_RE.lastIndex = 0;
    const m = REASON_ASSIGNMENT_RE.exec(fixture);
    expect(m).not.toBeNull();
    expect(isScheduleShaped((m as RegExpExecArray)[2] as string)).toBe(false);
  });

  // Comments are not scanned: explanatory prose citing a branch's history
  // stays legal (only the governed `reason:` string literal is checked).
  it('[control] a branch name mentioned only in a comment is not flagged', () => {
    const fixture = `// owned by task-w53-e until it landed\nconst LEDGER = { 'x.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' } };`;
    const stripped = stripLineComments(fixture);
    const offenders = [];
    REASON_ASSIGNMENT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = REASON_ASSIGNMENT_RE.exec(stripped))) {
      if (isScheduleShaped(m[2] as string)) offenders.push(m[2]);
    }
    expect(offenders).toEqual([]);
  });

  // Falsifiability control for the widened (vocabulary, not just branch-
  // token) rule: one fixture reason per new phrase family trips, one
  // structurally similar reason with no schedule phrase does not. This
  // guards against a future edit silently narrowing SCHEDULE_PHRASE_RE back
  // down to just the branch-token case.
  it('[falsifiability] a schedule-shaped reason with no branch token still trips', () => {
    const trips = [
      "reason: 'a sibling task in this wave owns wiring this end to end'",
      "reason: 'unmerged, will be handled once the other branch lands'",
      "reason: 'not yet reviewed -- filed for a later pass'",
      "reason: 'temporarily disabled, being converted to the new shape'",
      "reason: 'unreviewed; we have not looked at this criterion yet'",
      "reason: 'left as-is for now until the parser lands'",
    ];
    for (const fixture of trips) {
      REASON_ASSIGNMENT_RE.lastIndex = 0;
      const m = REASON_ASSIGNMENT_RE.exec(fixture);
      expect(m, fixture).not.toBeNull();
      expect(isScheduleShaped((m as RegExpExecArray)[2] as string), fixture).toBe(true);
    }
  });

  it('[falsifiability] a durable invariant-naming reason does not trip', () => {
    const clean = [
      "reason: 'contact_email_idx is a plain index by design; duplicate contacts sharing an email are a supported state (DEC-558)'",
      "reason: 'DisplayName is computed from user.name and has no separate reader to audit'",
      "reason: 'this criterion type is rating-only by construction; dropdown distribution does not apply to it'",
    ];
    for (const fixture of clean) {
      REASON_ASSIGNMENT_RE.lastIndex = 0;
      const m = REASON_ASSIGNMENT_RE.exec(fixture);
      expect(m, fixture).not.toBeNull();
      expect(isScheduleShaped((m as RegExpExecArray)[2] as string), fixture).toBe(false);
    }
  });
});
