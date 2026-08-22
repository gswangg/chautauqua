// Phone-verdict cascade-read lens (DEC-808 wave-12, task w12-xf).
//
// THE GAP: jsdom evaluates NO `@media` block, so a 390-frame render-verdict
// test that only reads the DOM (never a stylesheet's TEXT) is really a
// DESKTOP-cascade claim wearing a phone frame's title -- the terminal
// `@media (max-width: 700px)` rules that reorder/hide/stack a table into the
// exact card the frame draws are invisible to it either way, so it PASSES
// whether that CSS closed the gap or not. Wave-12 planning found three live
// instances of exactly this: `Submissions.frame-verdicts.render.test.tsx`,
// `Contacts.frame-verdicts.render.test.tsx` and
// `Content.frame-verdicts.render.test.tsx` each PASS while asserting
// divergences their sibling cluster's terminal phone `@media` block had
// already closed (field guide, wave-12: "jsdom evaluates no @media, so a 390
// verdict that reads only the DOM is a DESKTOP claim wearing a phone
// title"). `test/campaign-ratchet-two-sided.scan.test.ts` only checks
// constants ALREADY REGISTERED in `CAMPAIGN_CONSTANT_NAMES`/
// `TIER2_CEILING_NAMES` -- nothing upstream of that ever asked whether a
// phone verdict file consulted the cascade in the first place. This file is
// that instrument: a DERIVED, two-sided ratchet over every 390-frame verdict
// file, keyed on one PROPERTY of its own source text (does it ever read a
// stylesheet), never on which cluster it belongs to or what its verdicts
// happen to say.
//
// POPULATION (DERIVED, never hand-listed -- DEC-180/DEC-808 doctrine: a
// hand-listed population is not a population). Walks `app/src/pages` with
// `readdirSync(..., { recursive: true })` (the idiom
// `app/src/interaction-states.scan.test.ts` already uses for its own
// recursive stylesheet/SSR-module walks) for every `.tsx`/`.ts` file whose
// BASENAME matches `frame-verdicts` or `frame390` and does NOT contain
// `desktop` -- the desktop half of this ledger
// (`Review-reviewer.desktop-frame-verdicts.render.test.tsx` and its
// siblings) is out of scope by construction: desktop verdicts are SUPPOSED
// to never read a stylesheet, that is what makes them desktop verdicts.
//
// PREDICATE: a member is an OFFENDER when its own source text never reads a
// stylesheet at all -- no `readFileSync` call whose string argument's path
// ends `.css`, and no `.css'`/`.css"` string literal ANYWHERE in the file (a
// single substring test over the whole source catches both: any
// `readFileSync(...'foo.css')`-shaped call already contains a `.css'`
// literal as a substring of its own argument, so this one check is not two
// separate predicates in disguise -- it is the SAME test, just phrased once
// instead of twice per DEC-613).
//
// RATCHET (DEC-808 wave-85 protocol): two-sided. One `it` asserts
// `offenders.length <= PHONE_VERDICT_CASCADE_BLIND_CEILING` (may only be
// LOWERED); a companion `it` fails when the count drops below the ceiling,
// printing the exact replacement line so the fix lands in the same batch
// that earns it (mirrors `app/src/phone-tap-target-width-floor.scan.test.ts`
// and `test/css-comment-copy-leak.scan.test.ts`'s own companion pair).
//
// EXPECT THE COMPANION TO FIRE IN THE MERGE TRAIN: sibling wave-12 lanes
// w12-xa/xb/xc/xe are adding cascade reads to four of these files in this
// same batch, so the ceiling this task seeds will need lowering once those
// land -- that is the ratchet doing its job, and the companion's printed
// line is how the next lane does it.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const PAGES_ROOT = join(HERE, 'pages');

/** Every 390-frame verdict member: a `.tsx`/`.ts` file under
 * `app/src/pages` whose basename matches `frame-verdicts` or `frame390`
 * and does not contain `desktop` (case-insensitive -- the desktop half of
 * this ledger names itself with a `.desktop-frame-verdicts.` infix). */
function findPhoneVerdictMembers(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.(tsx|ts)$/.test(entry.name)) continue;
    if (!/frame-verdicts|frame390/.test(entry.name)) continue;
    if (/desktop/i.test(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Same substring test either way a stylesheet read shows up in source:
 * a `readFileSync(...'foo.css')` call's own argument already contains
 * `.css'`/`.css"` as a substring, so one check covers both the call-site
 * shape and a bare quoted `.css` path literal used any other way. */
const CSS_LITERAL_RE = /\.css['"]/;

/** True when `source` never reads a stylesheet at all -- the OFFENDER
 * condition (a 390-frame verdict whose assertions can only ever be a
 * claim about jsdom's un-cascaded DOM, never about the terminal
 * `@media` block that actually draws the phone frame). */
function neverReadsStylesheet(source: string): boolean {
  return !CSS_LITERAL_RE.test(source);
}

// Reuses the pack's own frame-citation grammar verbatim (the SAME regex
// `test/phone-frame-ledger.scan.test.ts` and
// `test/desktop-frame-ledger.scan.test.ts` declare locally -- DEC-613: not
// re-derived, the identical literal), so the "cites <N> 390-frame lines"
// count in each offender's report line means the same thing here as it
// does everywhere else in the campaign's citation instruments.
const CITATION_RE = /docs\/design\/([A-Za-z][A-Za-z0-9 ]*\.dc\.html):\s*([\d/,-]+)/g;

/** Counts individual frame-line numbers cited in `source` via the pack's
 * `docs/design/<Frame>.dc.html:<line[,line...]>` grammar -- a citation
 * group may name more than one line (`:137/181`, `:355,393`), each counted
 * separately, matching how `desktop-frame-ledger.scan.test.ts`'s own
 * `parseClaims` walks the same grammar. */
function countFrameLineCitations(source: string): number {
  let count = 0;
  CITATION_RE.lastIndex = 0;
  for (const m of source.matchAll(CITATION_RE)) {
    const nums = (m[2] as string).split(/[,/]/).filter((s) => /^\d+/.test(s));
    count += nums.length;
  }
  return count;
}

interface Offender {
  readonly relPath: string;
  readonly citedLines: number;
}

function findOffenders(members: readonly string[]): Offender[] {
  const out: Offender[] = [];
  for (const path of members) {
    const source = readFileSync(path, 'utf-8');
    if (!neverReadsStylesheet(source)) continue;
    out.push({
      relPath: relative(REPO_ROOT, path),
      citedLines: countFrameLineCitations(source),
    });
  }
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function formatOffender(o: Offender): string {
  return `${o.relPath} -- cites ${o.citedLines} 390-frame lines, reads no stylesheet`;
}

const MEMBERS = findPhoneVerdictMembers(PAGES_ROOT);
const OFFENDERS = findOffenders(MEMBERS);

// RE-MEASURED (task w13-xj) by forcing this constant to -1 and reading the
// printed offender list: still 25 members, now 9 offenders -- three of the
// original 12 (Comms.frame-verdicts, Contacts.frame-verdicts,
// Content.frame-verdicts) gained a cascade read when sibling wave-12 lanes
// w12-xa/xb/xc/xe landed, exactly as this file's own header predicted
// ("EXPECT THE COMPANION TO FIRE IN THE MERGE TRAIN"). The two-sided
// companion below caught the drop live (measured RED at 12 before this
// edit) -- lowering the ceiling in this same commit is that companion's
// contract, never a snapshot carried from a prior wave. Current offenders:
// Agenda.frame-verdicts, Comms.frame390, Speakers.frame-verdicts,
// content/DeliverableDetail.frame390, content/FilesLibrary.frame390,
// overview/Overview.frame390, review/PlanEditor.frame390,
// settings/CallForPapersPanel.frame390, submissions/Submissions.frame390.
export const PHONE_VERDICT_CASCADE_BLIND_CEILING = 9;

describe('phone-verdict cascade-read lens (DEC-808 wave-12, task w12-xf)', () => {
  it('derives a non-empty population over the real tree (vacuous-population tripwire)', () => {
    expect(MEMBERS.length).toBeGreaterThan(0);
    // A known member must be present -- a broken matcher (e.g. one that
    // silently narrows to zero members some other way) cannot pass green
    // over an empty set just because the length assertion above is loose.
    const relMembers = MEMBERS.map((p) => relative(REPO_ROOT, p));
    expect(relMembers).toContain('app/src/pages/submissions/Submissions.frame390.render.test.tsx');
  });

  it('the population excludes the desktop-frame-verdict siblings by construction (negative control)', () => {
    const relMembers = MEMBERS.map((p) => relative(REPO_ROOT, p));
    for (const p of relMembers) {
      expect(p.toLowerCase()).not.toMatch(/desktop/);
    }
  });

  it('a known cascade-reading member (already imports a .css file) is NOT an offender (negative control)', () => {
    const settings = MEMBERS.find((p) => p.endsWith('Submissions.frame-verdicts.render.test.tsx'));
    expect(settings, `expected Submissions.frame-verdicts.render.test.tsx among:\n${MEMBERS.join('\n')}`).toBeDefined();
    const source = readFileSync(settings as string, 'utf-8');
    expect(neverReadsStylesheet(source)).toBe(false);
  });

  it('a synthetic verdict file with no stylesheet read is flagged (positive control)', () => {
    const source = `
      import { describe, expect, it } from 'vitest';
      describe('fake', () => {
        it('DIVERGES: fake claim', () => {
          expect(true).toBe(true);
        });
      });
    `;
    expect(neverReadsStylesheet(source)).toBe(true);
  });

  it('a synthetic verdict file reading a stylesheet by readFileSync is not flagged (negative control)', () => {
    const source = `
      import { readFileSync } from 'node:fs';
      const css = readFileSync(join(HERE, 'fake.css'), 'utf-8');
    `;
    expect(neverReadsStylesheet(source)).toBe(false);
  });

  it(
    `stays at or under the cascade-blind offender ceiling (${PHONE_VERDICT_CASCADE_BLIND_CEILING}) ` +
      `(one-sided ratchet: may only fall)`,
    () => {
      expect(
        OFFENDERS.length,
        `phone-verdict cascade-blind offenders (${OFFENDERS.length}, ceiling ` +
          `${PHONE_VERDICT_CASCADE_BLIND_CEILING}):\n${OFFENDERS.map(formatOffender).join('\n')}`,
      ).toBeLessThanOrEqual(PHONE_VERDICT_CASCADE_BLIND_CEILING);
    },
    20000,
  );

  it(
    `never falls below the cascade-blind offender ceiling (${PHONE_VERDICT_CASCADE_BLIND_CEILING}) ` +
      `without the ceiling being lowered to match (two-sided ratchet, DEC-808 wave-85)`,
    () => {
      if (OFFENDERS.length < PHONE_VERDICT_CASCADE_BLIND_CEILING) {
        throw new Error(
          `${OFFENDERS.length} phone-verdict cascade-blind offenders measured, below ` +
            `PHONE_VERDICT_CASCADE_BLIND_CEILING=${PHONE_VERDICT_CASCADE_BLIND_CEILING}. This is ` +
            `the ratchet working: a verdict file gained a cascade read. Lower the ceiling by ` +
            `replacing the line:\n` +
            `  export const PHONE_VERDICT_CASCADE_BLIND_CEILING = ${OFFENDERS.length};`,
        );
      }
      expect(OFFENDERS.length).toBe(PHONE_VERDICT_CASCADE_BLIND_CEILING);
    },
    20000,
  );
});
