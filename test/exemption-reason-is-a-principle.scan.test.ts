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

// DEC-099 (wave-118 amendment): the rule is about SHAPE, not a fixed
// vocabulary of prefixes -- the campaign's branch naming moved from
// `task-wN-x` to `v12m-wN-x` partway through and the old regex went blind
// to every lane in the new naming for the whole campaign. Both prefixes
// share one shape (a lane-and-wave token followed by a lowercase suffix,
// which may itself be more than one letter -- `v12m-w5-aa`, `v12m-w4-ag`)
// and the alternation is written so a THIRD prefix can be added the same
// way without inventing a new regex shape.
const BRANCH_NAME_RE = /\b(?:task|v12m)-w\d+-[a-z]+\b/;

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
  // DEC-518 (wave-120 amendment): widened from "being converted" alone --
  // portal-v12.md's "is being built by v12m-w15-b" is the identical
  // passive-progressive shape with a different verb, and a second
  // parallel regex for the same shape would be the DEC-613 trap.
  { label: 'being converted/built', re: /\bbeing (?:converted|built|rewritten|redone)\b/i },
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
  { label: 'once X lands', re: /\bonce\b[^.]{0,60}\b(?:lands?|exists?)\b/i },
  // DEC-099 (wave-118 amendment): the same defect with the branch token
  // filed off -- a reason that describes work happening RIGHT NOW on some
  // other lane, or promised for a future one, is a schedule wearing prose
  // instead of a branch name. "is/are doing/building/converting" covers
  // the progressive (work in flight elsewhere); "will build/land/fix"
  // covers the promise (work not yet done, deferred to a future act).
  { label: 'progressive work-in-flight (is/are doing/building/converting)', re: /\b(?:is|are)\s+(?:doing|building|converting)\b/i },
  { label: 'future work commitment (will build/land/fix)', re: /\bwill\s+(?:build|land|fix)\b/i },
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

// DEC-099 (wave-118 amendment): docs/design/DEVIATIONS.md is a reason
// document -- every top-level bullet under "## 5. Pending adjudication"
// and "## 6. Deferred post-deadline" IS a deferral reason by construction
// (that is what those two headings mean), and it sat entirely outside this
// scan's population (test files only) while it is the tree's
// highest-precedence deviation document. Widened here rather than in a
// second scan, per DEC-613 ("a second copy of a citation/exemption
// vocabulary is a trap with a delay fuse").
const DEVIATIONS_PATH = join(REPO_ROOT, 'docs', 'design', 'DEVIATIONS.md');

// A landed ruling's authorship (`DEC-650 (planner ruling, v12m-w2-c)`) is a
// fact about the past, not a promise about the future -- it is the ONE
// place a lane token is legal in this document. The carve-out is scoped to
// the RAW SOURCE LINE the lane token appears on (not the whole bullet):
// DEVIATIONS.md's own "Portal task-list dock" bullet cites DEC-967 at its
// last line while the bare "v12m-w15-b is\n  doing exactly that" token sits
// three lines earlier with no DEC citation anywhere near it -- if the
// carve-out looked at the whole bullet instead of the line, that bullet
// would go legal by riding on an unrelated citation at its tail.
const DEC_CITE_RE = /\bDEC-\d{3}\b/;

function lineHasUnattributedLaneToken(line: string): boolean {
  return BRANCH_NAME_RE.test(line) && !DEC_CITE_RE.test(line);
}

/** Splits DEVIATIONS.md into top-level (`## N. ...`) sections, then within
 * sections 5 and 6 only, groups consecutive lines into top-level bullets
 * (a line starting `- ` plus its indented continuation lines) -- the same
 * "joined text up to the next top-level bullet/heading" shape
 * test/deviations-ledger.scan.test.ts's header documents using, reused
 * rather than reinvented. Returns offenders against BOTH predicates: a
 * bullet whose JOINED text (line-wraps collapsed) reads as schedule-shaped
 * prose, and a raw source LINE carrying an unattributed lane token. */
function findDeviationsOffenders(): string[] {
  const raw = readFileSync(DEVIATIONS_PATH, 'utf8');
  const relPath = relative(REPO_ROOT, DEVIATIONS_PATH);
  const lines = raw.split('\n');
  const offenders: string[] = [];

  let inTargetSection = false;
  let bullet: { text: string[]; lineNos: number[] } | null = null;

  const flushBullet = () => {
    if (!bullet) return;
    const b = bullet;
    const joined = b.text.join(' ').replace(/\s+/g, ' ').trim();
    const scheduleHit = SCHEDULE_PATTERNS.find((p) => p.re.test(joined));
    if (scheduleHit) {
      offenders.push(
        `${relPath}:${b.lineNos[0]}: schedule-shaped deferral bullet (${scheduleHit.label}): "${joined}"`,
      );
    }
    b.text.forEach((line, i) => {
      if (lineHasUnattributedLaneToken(line)) {
        offenders.push(`${relPath}:${b.lineNos[i]}: lane token with no same-line DEC citation: "${line.trim()}"`);
      }
    });
    bullet = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const lineNo = i + 1;
    const headingMatch = /^##\s+(\d+)\./.exec(line);
    if (headingMatch) {
      flushBullet();
      const num = headingMatch[1];
      inTargetSection = num === '5' || num === '6';
      continue;
    }
    if (!inTargetSection) continue;
    if (/^- /.test(line)) {
      flushBullet();
      bullet = { text: [line], lineNos: [lineNo] };
    } else if (bullet && /^\s+\S/.test(line)) {
      bullet.text.push(line);
      bullet.lineNos.push(lineNo);
    } else {
      flushBullet();
    }
  }
  flushBullet();
  return offenders;
}

// DEC-518 (wave-120): the identical defect DEVIATIONS.md carried (wave 118)
// sits one directory over, entirely unscanned -- docs/design/audit/**
// records fidelity-audit findings, and the SAME shape ("this stays open
// because branch X owns it / is doing it / will land it") recurs there in
// both markdown-table gap rows and freeform prose, e.g.
// phone-tap-floor-links.md:76's `**Unsatisfied** (off-limits,
// v12m-w2-c/w5-h own this file)` and portal-v12.md's "is being built by
// v12m-w15-b" (verified live at main d75ba0df, wave-120 task brief).
//
// UNLIKE DEVIATIONS.md, this directory is NOT scoped to two headings whose
// very presence means "this is a deferral" -- it is thousands of lines of
// narrative audit prose, most of which legitimately narrates past work
// ("fixed in this wave (v12m-w2-c)", "measured this wave") using the exact
// same vocabulary a real deferral would use. Gating on SCHEDULE_PATTERNS
// alone (as DEVIATIONS.md's bullet-level check does) floods this
// population with false positives from ordinary wave narration. So the
// audit-dir scan requires BOTH: (1) an unattributed lane token
// (`lineHasUnattributedLaneToken`, reused verbatim, not reinvented, per
// DEC-613) somewhere in the paragraph/row, AND (2) that same
// paragraph/row also names an actual GAP -- either a markdown table
// STATUS cell that literally reads Unsatisfied/Deferred/Open/Not
// fixed/Out of scope, or prose using the task's own gap vocabulary
// (pending / off-limits / out of scope / not fixed / deferred /
// scheduled for / left open) or a narrower subset of SCHEDULE_PATTERNS
// that isn't legitimately used in past-tense narration here (excludes
// "this wave" / "unmerged" / "for now" / "temporarily", each of which
// this directory uses constantly to describe FIXED work, e.g. "fixed in
// this wave (v12m-w2-c)" -- gating on those here would make every
// completed fix in the directory a false offender).
const AUDIT_DIR = join(REPO_ROOT, 'docs', 'design', 'audit');

// The task's own gap vocabulary for a status cell or a deferral clause.
// "left open" is the one addition beyond the task brief's literal list --
// it is the same "a gap stays open" shape written as a participial phrase
// (contacts-v12.md's original "left OPEN, and left for task `v12m-w2-c`"),
// not a new vocabulary, so it stays in this single list per DEC-613 rather
// than spawning a second one.
const AUDIT_GAP_WORD_RE = /\b(pending|off-limits|out of scope|not fixed|deferred|scheduled for|left open)\b/i;
const AUDIT_GAP_STATUS_CELL_RE = /\b(Unsatisfied|Deferred|Open|Not fixed|Out of scope)\b/;

// Labels excluded from the SCHEDULE_PATTERNS half of the audit-dir gate --
// see the block comment above for why: these four fire constantly on
// legitimate past-tense narration in this narrative document type ("fixed
// in this wave", "No unmerged v12m-* branch touches this file") and would
// make every completed fix a false offender if used to gate here. They
// remain fully active for the code-`reason:` scan above and for
// DEVIATIONS.md, where every governed string is a live disable/deferral
// reason rather than a paragraph of mixed past/present narration.
const AUDIT_SCHEDULE_EXCLUDE = new Set(['this wave', 'unmerged', 'for now', 'temporarily']);

function auditScheduleHit(text: string) {
  return SCHEDULE_PATTERNS.find((p) => !AUDIT_SCHEDULE_EXCLUDE.has(p.label) && p.re.test(text));
}

function walkMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkMarkdownFiles(full));
    } else if (name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/** Walks every docs/design/audit/**\/*.md file and returns offenders
 * against two predicates:
 *
 * (a) a markdown TABLE ROW whose status cell names a gap (Unsatisfied /
 *     Deferred / Open / Not fixed / Out of scope) and whose raw line
 *     carries an unattributed lane token or an audit-scoped SCHEDULE_
 *     PATTERNS hit.
 *
 * (b) a PROSE paragraph (blank-line-delimited, headings and table rows
 *     excluded) whose joined text carries the gap vocabulary or an
 *     audit-scoped schedule hit, in which case every RAW LINE of that
 *     paragraph carrying an unattributed lane token is an offender --
 *     mirroring findDeviationsOffenders' bullet-join shape exactly (per
 *     DEC-613, not a second mechanism), with the paragraph standing in
 *     for the bullet. */
function findAuditDirOffenders(): string[] {
  const offenders: string[] = [];
  for (const file of walkMarkdownFiles(AUDIT_DIR)) {
    const relPath = relative(REPO_ROOT, file);
    const raw = readFileSync(file, 'utf8');
    const lines = raw.split('\n');

    // (a) table rows
    lines.forEach((line, i) => {
      if (!/^\s*\|/.test(line)) return;
      const cells = line.split('|');
      if (!cells.some((c) => AUDIT_GAP_STATUS_CELL_RE.test(c))) return;
      if (lineHasUnattributedLaneToken(line) || auditScheduleHit(line)) {
        offenders.push(`${relPath}:${i + 1}: [table] gap status row with lane token/schedule hit: "${line.trim()}"`);
      }
    });

    // (b) prose paragraphs
    let paraLines: string[] = [];
    let paraLineNos: number[] = [];
    const flushParagraph = () => {
      if (!paraLines.length) return;
      const joined = paraLines.join(' ').replace(/\s+/g, ' ').trim();
      const gate = AUDIT_GAP_WORD_RE.test(joined) || auditScheduleHit(joined);
      if (gate) {
        paraLines.forEach((line, idx) => {
          if (lineHasUnattributedLaneToken(line)) {
            offenders.push(
              `${relPath}:${paraLineNos[idx]}: [prose] gap paragraph, lane token with no same-line DEC citation: "${line.trim()}"`,
            );
          }
        });
      }
      paraLines = [];
      paraLineNos = [];
    };
    lines.forEach((line, i) => {
      if (/^\s*\|/.test(line) || /^#/.test(line) || line.trim() === '') {
        flushParagraph();
        return;
      }
      paraLines.push(line);
      paraLineNos.push(i + 1);
    });
    flushParagraph();
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

  // DEC-099 (wave-118 amendment): widened branch pattern, negative controls
  // in both directions.
  it('[negative control, v12m naming] a synthetic v12m-wN-x reason is caught', () => {
    expect(isScheduleShaped('owned by v12m-w15-b; ledger row filed')).toBe(true);
  });

  it('[negative control, task naming still caught] a synthetic task-wN-x reason is still caught', () => {
    expect(isScheduleShaped('owned by task-w53-e; ledger row filed')).toBe(true);
  });

  it('[negative control, progressive work-in-flight] a synthetic "is doing" reason is caught', () => {
    expect(isScheduleShaped('a sibling lane is doing exactly that for the profile page')).toBe(true);
  });

  it('[negative control, progressive work-in-flight] a synthetic "is building" reason is caught', () => {
    expect(isScheduleShaped('the new parser is building against the same schema')).toBe(true);
  });

  it('[negative control, future commitment] a synthetic "will land" reason is caught', () => {
    expect(isScheduleShaped('exempt; will land the real fix in a follow-up')).toBe(true);
  });

  // DEC-099 (wave-118 amendment): the DEVIATIONS.md carve-out predicate,
  // in both directions -- a lane token co-cited with a landed DEC ruling on
  // the SAME raw line is legal (a fact about the past); a bare lane token
  // with no DEC citation on that line is not (a promise about the future).
  it('[negative control] a lane token co-cited with a landed DEC ruling on the same line is legal', () => {
    expect(
      lineHasUnattributedLaneToken('  replaced). DEC-650 (planner ruling, v12m-w2-c): this frame is STALE and the'),
    ).toBe(false);
  });

  it('[negative control] a bare lane token with no same-line DEC citation is illegal', () => {
    expect(lineHasUnattributedLaneToken('  be built for whatever primary the page already renders — v12m-w15-b is')).toBe(
      true,
    );
  });

  // DEC-099 (wave-118 amendment): verify the two named real lines from the
  // task directly -- DEVIATIONS.md:20 (DEC-650 authorship) must stay legal
  // under the carve-out predicate; DEVIATIONS.md:267 must not (before the
  // wave-118 fix, it carried the bare "v12m-w15-b is" token with no
  // same-line DEC citation -- reproduced above as a synthetic control since
  // the fix below removes the offending clause from the live file).
  it('[control] DEVIATIONS.md:20 (DEC-650 authorship) stays legal under the carve-out predicate', () => {
    const lines = readFileSync(DEVIATIONS_PATH, 'utf8').split('\n');
    expect(lineHasUnattributedLaneToken(lines[19] as string)).toBe(false);
  });

  // DEC-099 (wave-118 amendment): the widened population itself -- every
  // deferral bullet under DEVIATIONS.md sections 5 and 6 is scanned, and
  // must carry no schedule-shaped prose and no unattributed lane token.
  it('DEVIATIONS.md deferral sections (## 5, ## 6) carry no schedule-shaped or unattributed-lane-token bullet', () => {
    const offenders = findDeviationsOffenders();
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  // DEC-518 (wave-120): the identical defect, widened to docs/design/audit/**.
  // Drained in this same commit (DEC-991) -- no ceiling constant.
  it('docs/design/audit/**/*.md carries no gap-status table row or gap-prose paragraph with a lane token or schedule hit', () => {
    const offenders = findAuditDirOffenders();
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  // [control] AUTHORSHIP stays legal: a `# ... (v12m-w2-e)` heading is
  // never inspected at all (headings are excluded from paragraph grouping
  // before the gate is ever evaluated), and control-font-population-v12.md's
  // owner-column table has no gap-status cell (its header is "Owning branch
  // (one of, at run time)", not Unsatisfied/Deferred/...), so the whole
  // table is out of population by construction, not by an allowlist.
  it('[control] an authorship heading under docs/design/audit/** stays legal', () => {
    const fixture = [
      '# A frame receipt must assert about the tree, not about the frame (v12m-w2-e)',
      '',
      '## Closure (v12m-w3-m, wave 103)',
      '',
      'Some prose with no gap vocabulary and no table row at all.',
      '',
    ].join('\n');
    const lines = fixture.split('\n');
    // Headings are dropped by the same `/^#/` exclusion findAuditDirOffenders
    // uses -- verify directly rather than re-deriving the whole scan.
    expect(lines.filter((l) => /^#/.test(l)).every((l) => lineHasUnattributedLaneToken(l))).toBe(true);
    // ...and confirm the real file's owner-column table has no gap-status
    // cell for any of its lane-token rows (so it never reaches the gate).
    const controlFontPath = join(AUDIT_DIR, 'control-font-population-v12.md');
    const ownerRows = readFileSync(controlFontPath, 'utf8')
      .split('\n')
      .filter((l) => /^\s*\|/.test(l) && BRANCH_NAME_RE.test(l));
    expect(ownerRows.length).toBeGreaterThan(0);
    expect(ownerRows.every((l) => !AUDIT_GAP_STATUS_CELL_RE.test(l))).toBe(true);
  });

  // [control] a gap-status table row carrying a lane token IS caught.
  it('[control] a synthetic gap-status table row with an off-limits lane token is caught', () => {
    const fixture =
      '| `chq-example-back` | ROOMY | app/src/pages/example/example.css | **Unsatisfied** (off-limits, v12m-w5-b owns this file) | Back link; no phone rule found. |';
    const cells = fixture.split('|');
    expect(cells.some((c) => AUDIT_GAP_STATUS_CELL_RE.test(c))).toBe(true);
    expect(lineHasUnattributedLaneToken(fixture)).toBe(true);
  });

  // [control] a gap-status table row with no lane token and no schedule hit
  // stays legal (e.g. the real "Satisfied" rows, or an "Unsatisfied" row
  // with no branch attribution at all).
  it('[control] a gap-status table row naming no lane and no schedule phrase stays legal', () => {
    const fixture =
      '| `chq-example-back` | ROOMY | app/src/pages/example/example.css | **Unsatisfied** | Back link; no phone rule found. |';
    expect(lineHasUnattributedLaneToken(fixture)).toBe(false);
    expect(auditScheduleHit(fixture)).toBeUndefined();
  });

  // [control] the exact real shapes fixed this wave, reproduced as
  // synthetic fixtures (the live file no longer contains them) --
  // verifies findAuditDirOffenders' prose half catches both the
  // "off-limits, <lane>" table shape and the "is being built by <lane>"
  // prose shape from before this wave's rewrite.
  it('[control] the original phone-tap-floor-links.md:76 shape is caught (synthetic, pre-fix)', () => {
    const fixture =
      '| `chq-speaker-detail-back` | ROOMY | app/src/pages/speakers/speakers.css | **Unsatisfied** (off-limits, v12m-w2-c/w5-h own this file) | Back link found. |';
    const cells = fixture.split('|');
    expect(cells.some((c) => AUDIT_GAP_STATUS_CELL_RE.test(c)) && lineHasUnattributedLaneToken(fixture)).toBe(true);
  });

  it('[control] the original portal-v12.md:66 shape is caught (synthetic, pre-fix)', () => {
    // Two raw lines, matching the real (pre-fix) file's wrap: the DEC
    // citation sits on the first line, the bare lane token on the second
    // -- so the per-line carve-out (scoped to the RAW line, not the whole
    // paragraph) must not let the DEC-967 citation excuse the token one
    // line down.
    const rawLines = [
      '**Amendment (DEC-967 wave-106):** this finding is no longer open. The',
      'profile half is being built by `v12m-w15-b`, routing the Save/Cancel pair',
    ];
    const joined = rawLines.join(' ').replace(/\s+/g, ' ').trim();
    expect(AUDIT_GAP_WORD_RE.test(joined) || auditScheduleHit(joined)).toBeTruthy();
    expect(lineHasUnattributedLaneToken(rawLines[0] as string)).toBe(false);
    expect(lineHasUnattributedLaneToken(rawLines[1] as string)).toBe(true);
  });

  // [control] "fixed in this wave (v12m-w2-c)" -- ordinary past-tense
  // narration this directory uses constantly -- must NOT gate the scan,
  // even though it carries a lane token, because "this wave" is excluded
  // from the audit-scoped schedule check and no gap vocabulary is present.
  it('[control] past-tense "fixed in this wave (<lane>)" narration does not gate the audit scan', () => {
    const paragraph = 'Owner: fixed in this wave (v12m-w2-c). No unmerged `v12m-*` branch touches this file.';
    expect(AUDIT_GAP_WORD_RE.test(paragraph)).toBe(false);
    expect(auditScheduleHit(paragraph)).toBeUndefined();
  });
});
