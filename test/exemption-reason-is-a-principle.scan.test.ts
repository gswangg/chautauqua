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

// DEC-099 (wave-5 amendment, sha ee8ceffa): an exemption reason may not be
// SCHEDULE-SHAPED, not just branch-shaped -- the same parking ticket keeps
// arriving with the branch name filed off ("a sibling task in this wave
// owns this", "a later wave", "unmerged", "being converted on a parallel
// branch", "unreviewed -- filed for a later wave"). Each named shape below
// is a schedule, not a principle.
const SCHEDULE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'later/future/next wave', re: /\b(later|future|next)\s+wave\b/i },
  { label: 'sibling/parallel task-branch-lane', re: /\b(sibling|parallel)\s+(task|branch|lane)\b/i },
  { label: 'in flight', re: /\bin flight\b/i },
  { label: 'until X lands', re: /\buntil\b[^.]{0,60}\blands?\b/i },
  { label: 'being converted', re: /\bbeing converted\b/i },
  { label: 'not yet reviewed', re: /\bnot yet reviewed?\b/i },
  // Negative lookahead for a following "->" excludes a workflow-state
  // enumeration (e.g. "unreviewed -> approve/maybe/deny is the minimum
  // review workflow") from being read as a deferral clause -- that reason
  // documents a state machine, it does not excuse a check.
  { label: 'unreviewed', re: /\bunreviewed\b(?!\s*->)/i },
  { label: 'filed for a later', re: /\bfiled for a later\b/i },
  { label: 'TODO', re: /\bTODO\b/ },
  { label: 'TBD', re: /\bTBD\b/ },
  // Carried forward from the wave-4 amendment's phrase list, which this
  // wave-5 table would otherwise narrow: "a wave, a sibling and a for-now"
  // are all schedules, and each of these shipped as a real parking ticket.
  { label: 'this wave', re: /\bthis wave\b/i },
  { label: 'unmerged', re: /\bunmerged\b/i },
  { label: 'for now', re: /\bfor now\b/i },
  { label: 'temporarily', re: /\btemporarily\b/i },
  { label: 'we have not looked', re: /\bwe have not looked\b/i },
  { label: 'once X lands', re: /\bonce\b[^.]{0,60}\blands?\b/i },
];

function isScheduleShaped(value: string): boolean {
  return BRANCH_NAME_RE.test(value) || SCHEDULE_PATTERNS.some((p) => p.re.test(value));
}

// DEC-099 (wave-5 amendment): the rule governs a reason attached to a
// verdict that DISABLES a check (exempt/skip/allow/waived). A ledger row
// whose enclosing object literal contains `verdict: 'owed'` is a record of
// admitted-missing work, not an exemption, and is out of scope.
function enclosingObjectLiteral(source: string, atIndex: number): string {
  let depth = 0;
  let start = -1;
  for (let i = atIndex - 1; i >= 0; i--) {
    const ch = source[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) {
        start = i;
        break;
      }
      depth--;
    }
  }
  if (start === -1) return '';
  depth = 0;
  let end = -1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return '';
  return source.slice(start, end + 1);
}

const VERDICT_OWED_RE = /verdict\s*:\s*(['"])owed\1/;

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
        const enclosing = enclosingObjectLiteral(stripped, m.index);
        if (VERDICT_OWED_RE.test(enclosing)) continue;
        if (isScheduleShaped(value)) {
          offenders.push(`${relPath}:${findLineNumber(stripped, m.index)}: "${value}"`);
        }
      }
    }
  }
  return offenders;
}

describe('DEC-099 (waves 76/4, widened wave 5): an exemption reason may never be schedule-shaped', () => {
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

  // DEC-099 (wave-5 amendment): one negative control (IS flagged) per
  // schedule shape the rule now governs.
  const SCHEDULE_NEGATIVE_CONTROLS: { label: string; reason: string }[] = [
    { label: 'later/future/next wave', reason: 'this is owned by a later wave, revisit then' },
    { label: 'sibling/parallel task-branch-lane', reason: 'a sibling task in this wave owns wiring it end to end' },
    { label: 'in flight', reason: 'the fix is in flight on another branch' },
    { label: 'until X lands', reason: 'exempt until the forms rewrite lands' },
    { label: 'being converted', reason: 'this field is being converted on a parallel branch' },
    { label: 'not yet reviewed', reason: 'this row has not yet reviewed the new wiring' },
    { label: 'unreviewed', reason: 'unreviewed pending design sign-off' },
    { label: 'filed for a later', reason: 'filed for a later pass at the CSV export' },
    { label: 'TODO', reason: 'TODO: revisit once the schema settles' },
    { label: 'TBD', reason: 'ownership TBD, exempt for now' },
  ];

  for (const { label, reason } of SCHEDULE_NEGATIVE_CONTROLS) {
    it(`[negative control, ${label}] flags a schedule-shaped reason`, () => {
      expect(isScheduleShaped(reason)).toBe(true);
    });
  }

  // Positive control: a principled reason that mentions "wave" only in a
  // historical clause (not as a schedule) is never flagged.
  it('[positive control] does not flag a principled reason with the word "wave" in a historical clause', () => {
    const reason = 'wave-55 ledger established; refusal-shapes test not yet written';
    expect(isScheduleShaped(reason)).toBe(false);
  });

  // Verdict-owed rows are ledger bookkeeping, not exemptions, and are
  // skipped even when their reason text would otherwise read as schedule-
  // shaped, e.g. "not yet written" siblings that also happen to reference
  // "wave-NN".
  it('[control] a reason inside a verdict: "owed" object literal is skipped even if schedule-shaped', () => {
    const fixture = `const LEDGER = { 'x.tsx': { verdict: 'owed', reason: 'filed for a later pass; not yet reviewed' } };`;
    REASON_ASSIGNMENT_RE.lastIndex = 0;
    const m = REASON_ASSIGNMENT_RE.exec(fixture);
    expect(m).not.toBeNull();
    const enclosing = enclosingObjectLiteral(fixture, (m as RegExpExecArray).index);
    expect(VERDICT_OWED_RE.test(enclosing)).toBe(true);
    expect(isScheduleShaped((m as RegExpExecArray)[2] as string)).toBe(true);
  });

  // Control: a reason documenting a workflow-state ENUMERATION ("unreviewed
  // -> approve/maybe/deny is the minimum review workflow") is not a
  // deferral clause and must not be flagged, even though it contains the
  // bare word "unreviewed" -- test/clarifications-ledger.scan.test.ts:153
  // is exactly this shape.
  it('[control] "unreviewed -> ..." workflow-state enumeration prose is not flagged', () => {
    expect(isScheduleShaped('unreviewed -> approve/maybe/deny is the minimum review workflow.')).toBe(false);
  });

  // Control: the same schedule-shaped reason attached to a DISABLING verdict
  // (exempt) is not skipped.
  it('[control] a schedule-shaped reason on an exempt verdict is not skipped', () => {
    const fixture = `const LEDGER = { 'x.tsx': { verdict: 'exempt', reason: 'filed for a later pass; not yet reviewed' } };`;
    REASON_ASSIGNMENT_RE.lastIndex = 0;
    const m = REASON_ASSIGNMENT_RE.exec(fixture);
    expect(m).not.toBeNull();
    const enclosing = enclosingObjectLiteral(fixture, (m as RegExpExecArray).index);
    expect(VERDICT_OWED_RE.test(enclosing)).toBe(false);
    expect(isScheduleShaped((m as RegExpExecArray)[2] as string)).toBe(true);
  });
});
