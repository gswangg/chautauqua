// Role display-label spelling ledger (DEC-613 wave-27 amendment; task
// w27-d).
//
// DEC-613's wave-27 amendment RULED that the product's role-label DISPLAY
// copy follows the v12 pack's own spelling register. Measured directly
// against the pack (docs/design/*.dc.html): 8 hits for
// Organiser/Organisers across 3 frame files (Chautauqua Settings.dc.html's
// People-and-roles role pill and role-select frame data, Chautauqua
// Home.dc.html's "Organisers and reviewers", Chautauqua Docs.dc.html's
// "Organiser, reviewer, speaker" and "Organisers"), ZERO hits for
// Organizer/Organizers anywhere in the 13-file pack. No DEVIATIONS.md entry
// blesses the American form, so the pack's register is the product's
// register for display copy.
//
//   1. PACK-REGISTER CHECK (vacuous-population guard, both directions):
//      derived from docs/design/*.dc.html directly -- at least one British
//      hit (proves the assertion isn't vacuously true over an empty
//      population) AND exactly zero American hits (proves the pack really
//      never draws the US spelling this decision would otherwise be
//      overriding).
//
//   2. PRODUCT SCAN: every non-test *.ts/*.tsx file under app/src/** and
//      src/routes/** (this decision's own two named surfaces -- the wire
//      layer, DB schema and route paths under src/routes/api/** etc. are
//      explicitly OUT of scope per DEC-613's own wire-values-untouched
//      clause, and this scan only ever looks for the CAPITALISED spelling,
//      which no wire value uses), searched for the whole word
//      `Organizer`/`Organizers` (capitalised, the DISPLAY form -- a wire
//      value is always lowercase `organizer`) with comments stripped first
//      (frame-source-corpus's normalizeSource, DEC-967's one-stripper
//      rule).
//
//      EXCLUDED BY CONSTRUCTION, never by an allowlist:
//        - identifier positions: `\bOrganizers?\b` is word-boundary
//          anchored, so `requireOrganizer`/`viewerIsOrganizer`/
//          `isOrganizer` never match (no boundary before "Organizer" --
//          the preceding character is a letter) and a route path segment
//          or DB column never matches either (lowercase).
//        - comments: stripped by normalizeSource before the regex ever
//          runs, so a comment naming "Organizer-only" (there are several,
//          e.g. src/routes/api/events.ts) cannot offend.
//        - email-address literals: `sbek-organizer@example.com` is
//          lowercase, so the capitalised-only regex never reaches it.
//        - lowercase wire values: same reasoning -- the role enum's own
//          string is always `'organizer'`, never matched.
//
//      CEILING = 0. RATCHET, not a snapshot: forced to -1 (below is the
//      offender list printed at that setting -- empty) and re-measured on
//      this branch after 12/13 display sites landed British spelling
//      (PeopleRolesPanel.tsx, CommentThread.tsx via the new
//      app/src/lib/role-labels.ts owner, Settings.tsx's people-hub detail,
//      src/routes/docs-content/running-the-software.ts's deflist term and
//      "The three roles" prose, and src/routes/docs-content/start-here.ts's
//      "**Organizer**" role-list bold term -- the last one surfaced only
//      by actually running this scan over the full two-directory
//      population, not by the task's own named file list).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enumerateSourceFiles, normalizeSource } from './frame-source-corpus';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROUTES_ROOT = join(REPO_ROOT, 'src', 'routes');

const BRITISH_RE = /\bOrganisers?\b/;
const AMERICAN_RE = /\bOrganizers?\b/;

function designFileNames(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

interface Offender {
  file: string;
  line: number;
  match: string;
  context: string;
}

/** Every whole-word CAPITALISED Organizer/Organizers occurrence in a
 * comment-stripped source file, with a 1-based line number computed from
 * the ORIGINAL (un-normalized, un-collapsed) file so offenders are
 * locatable. Comments are stripped via normalizeSource's own stripComments
 * pass (imported indirectly -- normalizeSource does strip+decode+collapse,
 * and collapsing whitespace never changes whether the word itself is
 * present, only its surrounding spacing), so a comment mentioning the word
 * can never appear in the blob this function searches. */
function findOffenders(root: string): Offender[] {
  const offenders: Offender[] = [];
  for (const full of enumerateSourceFiles(root)) {
    const raw = readFileSync(full, 'utf-8');
    const normalized = normalizeSource(raw);
    if (!AMERICAN_RE.test(normalized)) continue;
    // Re-scan the ORIGINAL file line-by-line (not the normalized blob) to
    // report an honest line number and to re-verify the match survives on
    // a per-line, non-comment-stripped view too (a defence against
    // normalizeSource's whitespace collapse ever smuggling a cross-line
    // match into one line's report).
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().startsWith('//')) continue; // whole-line comment, cheap pre-filter
      const normalizedLine = normalizeSource(line);
      const m = AMERICAN_RE.exec(normalizedLine);
      if (m) {
        offenders.push({ file: full, line: i + 1, match: m[0], context: line.trim() });
      }
    }
  }
  return offenders;
}

describe('role label spelling ledger (DEC-613 wave-27 amendment)', () => {
  it('vacuous-population guard: the pack draws the British register at least once', () => {
    let hits = 0;
    for (const fileName of designFileNames()) {
      const text = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8');
      const matches = text.match(new RegExp(BRITISH_RE, 'g'));
      hits += matches ? matches.length : 0;
    }
    expect(hits).toBeGreaterThanOrEqual(1);
  });

  it('vacuous-population guard: the pack never draws the American register', () => {
    let hits = 0;
    const offenders: string[] = [];
    for (const fileName of designFileNames()) {
      const text = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (AMERICAN_RE.test(lines[i]!)) {
          hits += 1;
          offenders.push(`${fileName}:${i + 1} -- ${lines[i]!.trim()}`);
        }
      }
    }
    expect(hits, offenders.join('\n')).toBe(0);
  });

  it('negative control: a hand-listed frame line drawing "Organiser" resolves in the current pack', () => {
    // Chautauqua Settings.dc.html's People-and-roles role pill/select frame
    // data -- cited in DEC-613's wave-27 amendment.
    const text = readFileSync(join(DESIGN_ROOT, 'Chautauqua Settings.dc.html'), 'utf-8');
    expect(text).toContain('Organiser');
  });

  it('positive control: a fabricated display-position offender IS caught', () => {
    const fixture = [
      'const label = "Organizer";',
      'function Row() {',
      '  return <span>Organizer</span>;',
      '}',
    ].join('\n');
    const normalized = normalizeSource(fixture);
    expect(AMERICAN_RE.test(normalized)).toBe(true);
  });

  it('negative control: an identifier position is NOT caught', () => {
    const fixture = [
      'export function requireOrganizer() {}',
      'const viewerIsOrganizer = true;',
      'function isOrganizer(role: string) { return role === "organizer"; }',
    ].join('\n');
    const normalized = normalizeSource(fixture);
    expect(AMERICAN_RE.test(normalized)).toBe(false);
  });

  it('negative control: a comment is NOT caught', () => {
    const fixture = ['// Organizer-only, event-scoped', '/* Organizer review tree */', 'const x = 1;'].join('\n');
    const normalized = normalizeSource(fixture);
    expect(AMERICAN_RE.test(normalized)).toBe(false);
  });

  it('negative control: an email-address literal is NOT caught (lowercase, not the capitalised display form)', () => {
    const fixture = 'const email = "sbek-organizer@example.com";';
    const normalized = normalizeSource(fixture);
    expect(AMERICAN_RE.test(normalized)).toBe(false);
  });

  it('negative control: a lowercase wire value is NOT caught', () => {
    const fixture = "const role: Role = 'organizer';";
    const normalized = normalizeSource(fixture);
    expect(AMERICAN_RE.test(normalized)).toBe(false);
  });

  // -- Ratchet ------------------------------------------------------------
  // Measured on this branch (task w27-d) by forcing this const to -1 and
  // reading the printed offender list: empty. Every display site the v12
  // pack draws in the British register now matches in app/src/** and
  // src/routes/**.
  const ROLE_LABEL_SPELLING_CEILING = 0;

  it(`never exceeds ROLE_LABEL_SPELLING_CEILING (${ROLE_LABEL_SPELLING_CEILING}) capitalised American offenders`, () => {
    const offenders = [...findOffenders(APP_SRC_ROOT), ...findOffenders(SRC_ROUTES_ROOT)];
    if (offenders.length > ROLE_LABEL_SPELLING_CEILING) {
      const lines = offenders.map((o) => `${o.file}:${o.line} -- "${o.match}" (${o.context})`);
      throw new Error(
        `${offenders.length} capitalised American "Organizer"/"Organizers" display-position offenders, above the ` +
          `ceiling of ${ROLE_LABEL_SPELLING_CEILING}. ROLE_LABEL_SPELLING_CEILING may only be RAISED as a ` +
          `merge-train act, never a worker's mid-lane edit. Offenders:\n${lines.join('\n')}`
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(ROLE_LABEL_SPELLING_CEILING);
  });

  it(`ROLE_LABEL_SPELLING_CEILING (${ROLE_LABEL_SPELLING_CEILING}) is not stale (raise it if the real count is lower)`, () => {
    const offenders = [...findOffenders(APP_SRC_ROOT), ...findOffenders(SRC_ROUTES_ROOT)];
    if (offenders.length < ROLE_LABEL_SPELLING_CEILING) {
      throw new Error(
        `Measured ${offenders.length} offenders, below the declared ceiling of ${ROLE_LABEL_SPELLING_CEILING} -- ` +
          `lower ROLE_LABEL_SPELLING_CEILING to ${offenders.length} on this branch.`
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(0);
  });

  // Two-sided companion (DEC-808 wave-28 amendment, clause b), appended when
  // this constant was registered in CAMPAIGN_CONSTANT_NAMES and so entered
  // test/campaign-ratchet-two-sided.scan.test.ts's derived population. The
  // `it` above states the staleness rule in prose but lands on
  // `toBeGreaterThanOrEqual(0)`, which is unfalsifiable and is exactly the
  // escape route DEC-808 clause (1) forbids. This states the BELOW direction
  // against the CONSTANT, in the throw-message idiom that names the exact
  // replacement line, and is appended rather than edited into the `it` above.
  it(`ROLE_LABEL_SPELLING_CEILING (${ROLE_LABEL_SPELLING_CEILING}) is measured against the constant, not against zero (BELOW direction)`, () => {
    const offenders = [...findOffenders(APP_SRC_ROOT), ...findOffenders(SRC_ROUTES_ROOT)];
    if (offenders.length < ROLE_LABEL_SPELLING_CEILING) {
      throw new Error(
        `Measured ${offenders.length} capitalised American display-position offenders, below the declared ` +
          `ceiling. A ratchet may only be LOWERED; replace the line:\n` +
          `  const ROLE_LABEL_SPELLING_CEILING = ${offenders.length};`
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(ROLE_LABEL_SPELLING_CEILING);
  });
});
