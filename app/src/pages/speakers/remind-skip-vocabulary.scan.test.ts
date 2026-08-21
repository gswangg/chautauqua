// DEC-613 wave-114 amendment: one server rule -- skip anyone reminded
// within the last hour (src/domain/reminders.ts's MANUAL_DEDUPE_WINDOW_MS)
// -- gets one caption vocabulary in the SPA. TaskView.tsx used to say
// "emailed" where every other site said "reminded"; that synonym wobble on
// a domain term is exactly what DEVIATIONS.md §4's standing voice rule
// bans, and a second copy of a vocabulary is the delay-fused trap this DEC
// exists to name.
//
// This is a re-runnable source scan (DEC-808 idiom: enumerate via
// readdirSync with { recursive: true }, never a hand-listed manifest). It
// walks every app/src/**/*.{ts,tsx} file (source AND tests), derives every
// occurrence of the skip-rule phrasing by regex on the rule's SHAPE, and
// asserts the captured verb is "reminded" at every site -- so a fifth copy
// that drifts (or a re-introduced "emailed") fails loudly the moment it
// lands, without anyone having to remember to update a hand-written list.
//
// DEC-374 (wave-18 amendment: FRAME EVIDENCE IS NOT PRODUCT COPY). The
// design pack's OWN prose (docs/design/Chautauqua Speakers.dc.html:697)
// still spells the deliberately-superseded "emailed" wording, and a test
// file that quotes that frame line VERBATIM inside a string/backtick
// literal (a `verbatimLine(...)` receipt) is receipting the frame, not
// authoring product copy -- this scan's subject is product copy, so any
// occurrence whose enclosing literal resolves to a verbatim frame quote
// via test/helpers/frame-evidence.ts's isFrameEvidence() is excluded from
// the offender population before it is built.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isFrameEvidence } from '../../../../test/helpers/frame-evidence';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(HERE, '..', '..'); // app/src
// This scan's own file plants a synthetic "emailed" violation below as a
// negative control; excluded from the real tree walk so that fixture never
// counts as a real offender against itself.
const SELF_FILE = join(HERE, 'remind-skip-vocabulary.scan.test.ts');

/** Every *.ts/*.tsx file under app/src, enumerated rather than named (DEC-808). */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

export interface RuleOccurrence {
  file: string;
  line: number;
  verb: string;
  text: string;
}

// The rule's shape, not a specific sentence: "skip(s) anyone <verb> in the
// last hour", case-insensitive so it catches both the sentence-initial
// "Skips..." captions and the lowercase mid-sentence fragment TaskView.tsx
// embeds.
const RULE_SHAPE = /skips? anyone (\w+) in the last hour/gi;

/** Scans a single file's source for every occurrence of the rule's shape.
 * DEC-374 (wave-18 amendment): an occurrence whose enclosing literal on its
 * line is a verbatim quote of a docs/design/*.dc.html line is frame
 * evidence, not product copy, and is excluded here before it can ever
 * reach the offender population. */
export function findOccurrences(file: string, source: string): RuleOccurrence[] {
  const found: RuleOccurrence[] = [];
  const lines = source.split('\n');
  lines.forEach((lineText, idx) => {
    const re = new RegExp(RULE_SHAPE.source, RULE_SHAPE.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(lineText)) !== null) {
      const verb = m[1];
      if (verb === undefined) continue;
      if (isFrameEvidence(file, lineText, m.index)) continue;
      found.push({ file, line: idx + 1, verb: verb.toLowerCase(), text: lineText.trim() });
    }
  });
  return found;
}

function scanTree(): RuleOccurrence[] {
  const files = allSourceFiles(APP_SRC).filter((f) => f !== SELF_FILE);
  const occurrences: RuleOccurrence[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf-8');
    occurrences.push(...findOccurrences(file, source));
  }
  return occurrences;
}

describe('the reminder-skip-rule caption is one vocabulary (DEC-613 wave-114)', () => {
  const occurrences = scanTree();

  it('finds a non-empty, derived population -- not a hand-written list (DEC-180)', () => {
    expect(occurrences.length).toBeGreaterThan(0);
  });

  it('every occurrence uses "reminded", never a synonym like "emailed"', () => {
    const offenders = occurrences.filter((o) => o.verb !== 'reminded');
    const report = offenders
      .map((o) => `${relative(APP_SRC, o.file)}:${o.line}: ${o.text}`)
      .join('\n');
    expect(offenders, `found a skip-rule caption not using "reminded":\n${report}`).toEqual([]);
  });

  // Of the four sites DEC-613's wave-114 amendment names, three actually
  // spell the rule as "skips anyone <verb> in the last hour": Overview.tsx
  // (still an independent literal -- owned by another lane), TaskView.tsx
  // (its comment still spells the phrase; its caption now reads the
  // shared export) and OnboardingGrid.tsx's ONE owner,
  // remindSkipVocabulary.ts, which OnboardingGrid.tsx itself now imports
  // rather than re-typing. RemindPreviewModal agrees on the RULE (it uses
  // "reminded in the last hour" too) but its sentence shape is different
  // ("N contacts skipped — reminded in the last hour" / "Nobody to remind
  // right now — N reminded in the last hour."), so it never matches this
  // regex and is not part of this scan's population -- asserted below so
  // that fact is pinned, not silently assumed.
  it('the derived population contains the sites that actually use the "skips anyone" shape', () => {
    const filesHit = new Set(occurrences.map((o) => relative(APP_SRC, o.file)));
    const expectedSuffixes = [
      join('pages', 'Overview.tsx'),
      join('pages', 'Overview.caption.w46.render.test.tsx'),
      join('pages', 'speakers', 'remindSkipVocabulary.ts'),
      join('pages', 'speakers', 'OnboardingGrid.render.test.tsx'),
      join('pages', 'speakers', 'TaskView.tsx'),
      join('pages', 'speakers', 'TaskView.render.test.tsx'),
    ];
    for (const suffix of expectedSuffixes) {
      const hit = [...filesHit].some((f) => f === suffix);
      expect(hit, `expected the derived population to include ${suffix}, but it did not -- files found: ${[...filesHit].join(', ')}`).toBe(true);
    }
  });

  it('RemindPreviewModal agrees on "reminded" but is outside this regex\'s shape (documents the boundary, does not assert emptiness elsewhere)', () => {
    const modalFile = join('pages', 'speakers', 'RemindPreviewModal.tsx');
    const filesHit = new Set(occurrences.map((o) => relative(APP_SRC, o.file)));
    expect([...filesHit].some((f) => f === modalFile)).toBe(false);
  });

  it('sanity: fires on a planted "emailed" variant (negative control proving the scan works)', () => {
    const planted = findOccurrences(
      'fake.tsx',
      "const caption = 'A reminder names only this task · skips anyone emailed in the last hour · the due date moves';",
    );
    expect(planted.length).toBe(1);
    expect(planted[0]?.verb).toBe('emailed');
  });

  it('sanity: the shape regex captures the verb correctly on known-good phrasing', () => {
    const good = findOccurrences('fake.tsx', "const s = 'Skips anyone reminded in the last hour';");
    expect(good.length).toBe(1);
    expect(good[0]?.verb).toBe('reminded');
  });
});
