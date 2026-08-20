// Frame caption/consequence ledger (DEC-976 wave-133; task w8-a).
//
// Every prior ledger in this campaign grades a SCREEN (phone-frame-ledger,
// desktop-frame-ledger: "is this screen cited by some test?") or a CONTROL
// (frame-control-label.scan.test.ts: "does the app render the words a
// button/footer/anchor draws?"). Nothing has ever graded the pack's third
// population: what a frame SAYS in its prose -- the muted caption/consequence
// spans that carry the design's explanations, warnings and confirmations,
// distinct from a control's own clickable label (field guide, wave-133 "THE
// PACK HAS A THIRD POPULATION" entry). This is that instrument.
//
//   1. POPULATION -- derived from docs/design/*.dc.html at test time, never
//      hand-listed (DEC-808). Every `<span|div|p style="...">TEXT</span>`
//      (opening and closing tag names match via backreference) whose style
//      attribute carries `color:#565A4B`, `color:#3F4237` or `color:#8E8A7A`
//      -- the pack's three muted-prose colours -- and does NOT carry
//      `text-transform:uppercase` (an eyebrow/label chip, not prose), where
//      TEXT contains no `<`/`>` (so a span/div/p wrapping further markup,
//      e.g. a grid-header container, can never satisfy the grammar) and no
//      `{{` (a template interpolation, not literal prose -- same exclusion
//      the desktop ledger already applies to its own population), is
//      >= 20 chars after trimming, and contains no digit and no `@`.
//
//      The digit/`@` filters are DISCRIMINATORS ON THE POPULATION, not an
//      exclusion of offenders (DEC-180): they drop count-composed rows (a
//      caption reading "18 more · 23 is under the 100-recipient cap" is a
//      COMPOSED-from-data render, graded by a different instrument were one
//      to exist) and fixture identities ("sam@example.com · Reviewer") from
//      ever entering the population in the first place -- neither
//      discriminator removes a real offender AFTER classification the way an
//      exclusion table does below.
//
//   2. EXCLUSIONS -- two written tables, each entry {fileName, line, text,
//      reason}, each asserted below to still resolve to its cited
//      file:line:text in the CURRENT pack (a stale exclusion fails loudly,
//      exactly like every prior ledger's exclusion-citation guard):
//        a. EXPLAINER -- the pack's own annotation panels, commentary about
//           the design system rather than product copy the app renders.
//        b. FIXTURE -- invented sample identities and sample body text used
//           as mock data inside a frame, not a caption a real screen draws.
//      Each reason is a PRINCIPLE (DEC-099): a fact about what the entry IS,
//      never a branch name or a schedule.
//
//   3. MATCH -- built over every .ts/.tsx/.css/.md file under app/src/** and
//      src/** (readdirSync recursive, skipping any path containing
//      `.test.`, DEC-808 enumeration). Both sides are normalized IDENTICALLY:
//      comments stripped (a string/template-aware scan, so a `//` or `/*`
//      inside a string literal is never mistaken for a real comment opener
//      -- the exact defect DEC-967 wave-130 already named and fixed once in
//      test/frame-source-corpus.ts; this file needs its OWN wide entity
//      table -- &hellip; &quot; &#39; &ldquo; &rdquo; &lt; &gt; beyond that
//      module's set -- so it cannot reuse that function without silently
//      narrowing its own decode table, and re-implements the same
//      string-aware algorithm rather than the two-regex shape that algorithm
//      was written to replace), HTML entities decoded (&amp; &lsaquo;
//      &rsaquo; &nbsp; &middot; &hellip; &quot; &#39; &mdash; &ndash;
//      &ldquo; &rdquo; &lt; &gt;), then every whitespace run collapsed to a
//      single space. Both normalizations matter on the SOURCE side: JSX
//      routinely wraps a one-line frame caption across three source lines
//      (needs whitespace-collapse) and writes the pack's `&middot;`/`&mdash;`
//      characters as literal HTML entities (needs entity-decode) -- skipping
//      either invents unmatched rows in the fix-me direction (measured
//      directly: dropping entity-decode alone raised this branch's
//      UNMATCHED count). A hole in this entity table can only ever INVENT
//      offenders (a real match rendered as `&apos;`/`&rsquo;`/`&lsquo;` on
//      the source side fails to decode and so fails to match a pack line
//      that spells the same apostrophe literally), never HIDE one -- the
//      table can make the ledger too pessimistic, never too optimistic --
//      which is exactly why a hole this shape survives review instead of
//      being caught by the ceiling going too low. A caption is MATCHED when the normalized corpus
//      contains the normalized text (plain substring test, not
//      boundary-anchored -- unlike the control-label ledger's short button
//      words, every population member here is >= 20 chars, so an accidental
//      substring collision inside a longer sentence is not a realistic risk
//      the way it is for a four-letter control label).
//
//   4. RATCHET -- FRAME_CAPTION_UNMATCHED_CEILING is a single exported
//      const, hand-measured on this branch by forcing it to -1 and reading
//      the printed offender list (never `= UNMATCHED.length` or any
//      expression naming the measured set -- the ninth saturated-ratchet-lie
//      pattern named in the wave-128 field guide). Two-sided, identical
//      shape to every prior ledger in this campaign
//      (test/desktop-frame-ledger.scan.test.ts's CLAIMED_FLOOR,
//      test/frame-control-label.scan.test.ts's FOOTER_LABEL_CEILING): one
//      `it` fails when the offender count rises ABOVE the ceiling, printing
//      the full offender list; a companion `it` fails when it falls BELOW,
//      printing the exact replacement line so a stale ceiling can never
//      license stagnation.
//
// This file names the app's uninstrumented caption/consequence gap; it does
// not close it -- that is scheduled work for a future lane, not this ledger.
//
// CONTENTION-CUSTODIAN DECOMPOSITION (no behaviour change): this file was a
// 4-way merge-conflict hotspot because every concurrent lane both added rows
// to the same exclusion tables AND re-measured the same ratchet constant in
// the same file. Split into test/frame-caption-ledger/{population,
// exclusions,match,ceiling}.ts -- this file is now the entry point: it
// re-exports every symbol the module used to export directly (so any
// external import path keeps working) and owns only the describe/it test
// bodies, which were never the contended part.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEC_380, DEC_976 } from '../src/decisions';
import { FRAME_CAPTION_UNMATCHED_CEILING } from './frame-caption-ledger/ceiling';
import {
  COMPOSED_EXCLUSIONS,
  EXEMPLAR_ARTICLE_EXCLUSIONS,
  EXPLAINER_EXCLUSIONS,
  FIXTURE_EXCLUSIONS,
  SUPERSEDED_EXCLUSIONS,
} from './frame-caption-ledger/exclusions';
import {
  SOURCE_FILES,
  UNMATCHED,
  captionIsMatched,
  digitSkeleton,
  enumerateSourceFiles,
  normalizeCaption,
  stripComments,
} from './frame-caption-ledger/match';
import { ALL_CAPTIONS, captionsInText, designFiles } from './frame-caption-ledger/population';

// Re-exported so any prior import of this file's own public surface
// (Caption, designFiles, captionsInText, enumerateSourceFiles,
// stripComments, normalizeCaption, captionIsMatched, the four named
// exclusion tables read by test/frame-caption-exclusion-grammar.test.ts,
// FRAME_CAPTION_UNMATCHED_CEILING) keeps resolving from this path unchanged.
export type { Caption } from './frame-caption-ledger/population';
export {
  designFiles,
  captionsInText,
  enumerateSourceFiles,
  stripComments,
  normalizeCaption,
  captionIsMatched,
  digitSkeleton,
};
export {
  COMPOSED_EXCLUSIONS,
  EXEMPLAR_ARTICLE_EXCLUSIONS,
  EXPLAINER_EXCLUSIONS,
  FIXTURE_EXCLUSIONS,
  SUPERSEDED_EXCLUSIONS,
};
export { FRAME_CAPTION_UNMATCHED_CEILING };

void DEC_976; // wave-135: the exclusion taxonomy grows a fourth named class, COMPOSED, with exactly three legal reason shapes (see COMPOSED_EXCLUSIONS in ./frame-caption-ledger/exclusions.ts)
void DEC_380; // wave-135: a caption absent only by a full stop (or an un-rendered reason line) is a BUILD, never an exclusion-table entry

describe('frame caption/consequence ledger (DEC-976 wave-133, v12 mobile campaign)', () => {
  it('non-vacuity: population is large and spans many frames and many source files (vacuous-grammar guard)', () => {
    expect(ALL_CAPTIONS.length).toBeGreaterThan(150);
    const distinctFiles = new Set(ALL_CAPTIONS.map((c) => c.fileName));
    expect(distinctFiles.size).toBeGreaterThanOrEqual(10);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
  });

  it('enumerates exactly 378 population-qualifying captions across 13 files (vacuous-population tripwire)', () => {
    // DEC-976 wave-142/w17-f: was 233 with the digit discriminator live;
    // retiring it (see ./frame-caption-ledger/population.ts's module
    // comment) widened the population by 145 to 378 -- measured directly
    // against this branch's tree, never guessed.
    expect(designFiles().length).toBe(13);
    expect(ALL_CAPTIONS.length).toBe(378);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file population, never a live product count', () => {
    const fabricatedFrameText = [
      '<div style="display:flex; flex-direction:column">',
      '  <p style="margin:0; font-size:16px; color:#3F4237">Zzy Synthetic Caption present in the corpus below and long enough to qualify.</p>',
      '  <span style="font-size:13px; color:#565A4B">Zzy Synthetic Caption absent from the corpus below and long enough to qualify.</span>',
      // DEC-976 wave-142/w17-f: the digit discriminator is retired -- a
      // caption with a digit now DOES enter the population.
      '  <span style="font-size:13px; color:#565A4B">Zzy Synthetic Caption with a digit 7 in it, long enough otherwise.</span>',
      // Excluded by text-transform:uppercase: an eyebrow chip, not prose.
      '  <span style="font-size:13px; color:#565A4B; text-transform:uppercase">Zzy Synthetic Eyebrow Chip Not Counted At All Here</span>',
      // Excluded by the < / > containment rule: wraps further markup.
      '  <div style="color:#3F4237"><span>Zzy Synthetic Nested Markup Not Counted</span></div>',
      '</div>',
    ].join('\n');

    const extracted = captionsInText(fabricatedFrameText);
    const extractedTexts = extracted.map((e) => e.text);
    expect(extractedTexts).toContain(
      'Zzy Synthetic Caption present in the corpus below and long enough to qualify.'
    );
    expect(extractedTexts).toContain(
      'Zzy Synthetic Caption absent from the corpus below and long enough to qualify.'
    );
    expect(extractedTexts.some((t) => t.includes('with a digit'))).toBe(true);
    expect(extractedTexts.some((t) => t.includes('Eyebrow Chip'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Nested Markup'))).toBe(false);

    // Fabricated single-file "source" population: wraps the PRESENT caption
    // across three JSX-style lines, writes its own `&mdash;` as an entity,
    // and puts the ABSENT caption only inside a comment that must be
    // stripped before matching.
    const fabricatedSource = [
      '// this comment mentions "Zzy Synthetic Caption absent from the corpus below and long enough to qualify." and must not satisfy it',
      'const caption = (',
      '  <p>',
      '    Zzy Synthetic Caption present in the corpus',
      '    below and long enough to qualify. &mdash; end',
      '  </p>',
      ');',
    ].join('\n');
    const normalized = [normalizeCaption(fabricatedSource)];

    expect(
      captionIsMatched(
        'Zzy Synthetic Caption present in the corpus below and long enough to qualify.',
        normalized
      )
    ).toBe(true);
    expect(
      captionIsMatched(
        'Zzy Synthetic Caption absent from the corpus below and long enough to qualify.',
        normalized
      )
    ).toBe(false);
  });

  it('digit-skeleton second pass (DEC-976 wave-142/w17-f): a composed count matches, a composed WORDING change does not, over a fabricated pair', () => {
    // Positive control: the frame spells a literal count; the source
    // composes the same sentence from a template expression with a
    // DIFFERENT number. digitSkeleton must collapse both to the same form.
    const frameCaption =
      'Zzy Synthetic Fixture 23 submissions have a decision and nobody has been told.';
    const composedSource =
      'const msg = `Zzy Synthetic Fixture ${count} submissions have a decision and nobody has been told.`;';
    const skeletonBlob = digitSkeleton(
      composedSource.replace(/\$\{[^}]*\}/g, '#').replace(/\{[^}]*\}/g, '#')
    );
    // Drive the real exported matcher end to end (never a live product
    // count -- this pair is fabricated). The verbatim first pass sees an
    // empty normalizedBlobs list, so a true result here can only come from
    // the digit-skeleton second pass.
    expect(captionIsMatched(frameCaption, [], [skeletonBlob])).toBe(true);

    // Also exercise a digit RANGE, collapsed as one unit on both sides (the
    // frame writes a literal "12-14"; the source composes the same range as
    // one interpolated expression).
    const rangeFrameCaption = 'Zzy Synthetic Fixture rows 12-14 need a second reviewer before they close.';
    const rangeComposedSource =
      'const msg = `Zzy Synthetic Fixture rows ${range} need a second reviewer before they close.`;';
    const rangeSkeletonBlob = digitSkeleton(
      rangeComposedSource.replace(/\$\{[^}]*\}/g, '#').replace(/\{[^}]*\}/g, '#')
    );
    expect(captionIsMatched(rangeFrameCaption, [], [rangeSkeletonBlob])).toBe(true);

    // Negative control: the WORDS differ, not just the number -- the
    // skeleton pass must not paper over an actual copy mismatch.
    const mismatchedSource =
      'const msg = `Zzy Synthetic Fixture ${count} submissions are still awaiting review.`;';
    const mismatchedSkeletonBlob = digitSkeleton(
      mismatchedSource.replace(/\$\{[^}]*\}/g, '#').replace(/\{[^}]*\}/g, '#')
    );
    expect(captionIsMatched(frameCaption, [], [mismatchedSkeletonBlob])).toBe(false);
  });

  it('EXPLAINER exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const e of EXPLAINER_EXCLUSIONS) {
      const hit = ALL_CAPTIONS.find((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
      expect(hit, `${e.fileName}:${e.line} no longer resolves to the cited text in the pack`).toBeDefined();
    }
  });

  it('FIXTURE exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const e of FIXTURE_EXCLUSIONS) {
      const hit = ALL_CAPTIONS.find((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
      expect(hit, `${e.fileName}:${e.line} no longer resolves to the cited text in the pack`).toBeDefined();
    }
  });

  it('EXEMPLAR ARTICLE exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const e of EXEMPLAR_ARTICLE_EXCLUSIONS) {
      const hit = ALL_CAPTIONS.find((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
      expect(hit, `${e.fileName}:${e.line} no longer resolves to the cited text in the pack`).toBeDefined();
    }
  });

  it('COMPOSED exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const e of COMPOSED_EXCLUSIONS) {
      const hit = ALL_CAPTIONS.find((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
      expect(hit, `${e.fileName}:${e.line} no longer resolves to the cited text in the pack`).toBeDefined();
    }
  });

  it('a decision-registry file quoting a caption does NOT satisfy the ledger (DEC-967 sighting #16, DEC-613)', () => {
    // Regression for the exact laundering this wave found: this ledger's
    // enumerateSourceFiles must exclude src/decisions-data/** via the SAME
    // isDecisionRegistryFile predicate frame-source-corpus.ts exports (not
    // a private re-implementation) or a DEC_NNN ruling constant quoting a
    // caption verbatim would count as the app rendering it.
    const root = mkdtempSync(join(tmpdir(), 'frame-caption-ledger-registry-test-'));
    try {
      const registryDir = join(root, 'src', 'decisions-data');
      mkdirSync(registryDir, { recursive: true });
      const quotedText = 'This synthetic caption text is quoted only by a decision-registry ruling.';
      writeFileSync(join(registryDir, 'DEC-xxx.md'), `# DEC-xxx\n\nRULED: build "${quotedText}" verbatim.\n`);
      writeFileSync(join(root, 'src', 'decisions.ts'), `export const DEC_xxx = "${quotedText}";\n`);

      const realFile = join(root, 'src', 'real.ts');
      writeFileSync(realFile, `const x = "not the quoted text";\n`);

      const files = enumerateSourceFiles(join(root, 'src'));
      expect(files).toEqual([realFile]);

      const blobs = files.map((f) => normalizeCaption(readFileSync(f, 'utf-8')));
      expect(captionIsMatched(quotedText, blobs)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('SUPERSEDED exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const e of SUPERSEDED_EXCLUSIONS) {
      const hit = ALL_CAPTIONS.find((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
      expect(hit, `${e.fileName}:${e.line} no longer resolves to the cited text in the pack`).toBeDefined();
    }
  });

  it(`never exceeds FRAME_CAPTION_UNMATCHED_CEILING (${FRAME_CAPTION_UNMATCHED_CEILING}) unmatched captions`, () => {
    if (UNMATCHED.length > FRAME_CAPTION_UNMATCHED_CEILING) {
      const offenders = UNMATCHED.map((c) => `${c.fileName}:${c.line} -- "${c.text}"`);
      throw new Error(
        `${UNMATCHED.length} frame captions are unmatched by any app source file, above the ceiling of ` +
          `${FRAME_CAPTION_UNMATCHED_CEILING}. FRAME_CAPTION_UNMATCHED_CEILING may only be RAISED (a ` +
          `merge-train act, never a worker's edit mid-lane), and only once re-measured against the integrated ` +
          `tree. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNMATCHED.length).toBeLessThanOrEqual(FRAME_CAPTION_UNMATCHED_CEILING);
  });

  it(`never sits BELOW FRAME_CAPTION_UNMATCHED_CEILING (${FRAME_CAPTION_UNMATCHED_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNMATCHED.length < FRAME_CAPTION_UNMATCHED_CEILING) {
      throw new Error(
        `${UNMATCHED.length} frame captions are unmatched, below the ceiling of ${FRAME_CAPTION_UNMATCHED_CEILING}. ` +
          `This is the ratchet working: coverage landed. Lower the ceiling in the same commit (a merge-train act) ` +
          `by replacing the line:\n  export const FRAME_CAPTION_UNMATCHED_CEILING = ${UNMATCHED.length};`
      );
    }
    expect(UNMATCHED.length).toBeGreaterThanOrEqual(FRAME_CAPTION_UNMATCHED_CEILING);
  });
});
