// DEC-385 amendment (wave 7): styles.css's FIRST @media (max-width: 700px)
// block sits at :381, ABOVE 12 top-level (equal-specificity) rules later in
// the file that declare the same (selector, property) pair. Media queries
// add no specificity, so source order alone decided the cascade -- and the
// 12 later top-level declarations were winning at every phone width,
// silently discarding the phone override. The fix (this wave) is a SECOND,
// terminal @media (max-width: 700px) block appended at the very end of the
// file that restates exactly those 12 declarations, so they become the LAST
// declaration in source order and win again.
//
// v12m-w3-k (DEC-385 wave-100/102 amendment): the file's four earlier
// max-width:700px blocks (including the wave-7 "first" block named above)
// have since been forward-merged into this one terminal block, in
// ascending source order, per DEC-385's one-terminal-block-per-sheet
// contract -- there is only ONE max-width:700px block in the file now,
// and it is both the first and the last. The shadow-repair reasoning
// above (source order alone decides the cascade at equal specificity)
// still holds; only the "second, separate block" shape it describes has
// changed. See the "the file carries exactly one max-width:700px block,
// forward-merged" test below (it replaces the old "does not touch the
// original phone block at :381" test, which asserted the pre-merge shape).
//
// This is a source-scan, brace-matched (not a naive /\{[^}]*\}/, which
// truncates at the first nested '}' and would treat an @media block's
// first nested rule as the whole block) parse of app/src/styles.css:
//   1. every one of the 12 named (selector, property) pairs resolves its
//      LAST declaration in source order to a location inside SOME
//      max-width:700px media block (not necessarily this new one, but in
//      practice only the new terminal block can be last for all 12);
//   2. the appended block is the file's final top-level construct;
//   3. the pair list is non-vacuous: exactly 12 pairs are found, so a
//      parser that matches nothing cannot pass green.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_PATH = join(HERE, 'styles.css');

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

interface TopLevelConstruct {
  header: string; // selector list, or the `@media (...)` condition text
  body: string; // raw text between the construct's own { and matching }
  isMedia: boolean;
  start: number; // char offset of the construct's OWN '{'
}

/** Brace-matched split of `css` into its top-level (depth-0) constructs.
 * Walks char-by-char tracking nesting depth so a rule/media block's own
 * matching '}' is found correctly regardless of how many braces it
 * contains -- unlike a regex that stops at the first '}'. */
function topLevelConstructs(css: string): TopLevelConstruct[] {
  const out: TopLevelConstruct[] = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    const openIdx = css.indexOf('{', i);
    if (openIdx === -1) break;
    const header = css.slice(i, openIdx).trim();
    let depth = 1;
    let j = openIdx + 1;
    while (j < n && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    // j now sits one past the matching closing '}'
    const body = css.slice(openIdx + 1, j - 1);
    if (header.length > 0) {
      out.push({
        header,
        body,
        isMedia: header.startsWith('@media'),
        start: openIdx,
      });
    }
    i = j;
  }
  return out;
}

/** Nested rules inside a media block's body -- one level deep, no further
 * nesting expected (@media bodies in this file only ever contain plain
 * rules). Reuses the same brace-matched walker on the body text; offsets
 * are rebased onto the outer file via `baseOffset`. */
function nestedRules(
  body: string,
  baseOffset: number,
): Array<{ selector: string; declBody: string; start: number }> {
  const constructs = topLevelConstructs(body);
  return constructs
    .filter((c) => !c.isMedia)
    .map((c) => ({ selector: c.header, declBody: c.body, start: baseOffset + c.start }));
}

interface Declaration {
  selector: string; // single trimmed selector (comma-lists already split)
  property: string;
  value: string;
  offset: number; // char offset used to order declarations
  insidePhoneMedia: boolean;
}

function parseDeclarations(css: string): Declaration[] {
  const decls: Declaration[] = [];
  const top = topLevelConstructs(css);
  for (const construct of top) {
    if (construct.isMedia) {
      const insidePhoneMedia = /max-width:\s*700px/.test(construct.header);
      for (const rule of nestedRules(construct.body, construct.start)) {
        pushDeclsForRule(rule.selector, rule.declBody, rule.start, insidePhoneMedia, decls);
      }
    } else {
      pushDeclsForRule(construct.header, construct.body, construct.start, false, decls);
    }
  }
  return decls;
}

function pushDeclsForRule(
  selectorList: string,
  declBody: string,
  offset: number,
  insidePhoneMedia: boolean,
  out: Declaration[],
): void {
  const selectors = selectorList
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const declRe = /([a-zA-Z-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(declBody))) {
    const property = m[1];
    const value = m[2];
    if (property === undefined || value === undefined) continue;
    for (const selector of selectors) {
      out.push({
        selector,
        property: property.trim(),
        value: value.trim(),
        offset,
        insidePhoneMedia,
      });
    }
  }
}

// The 12 real (non-no-op) shadowed pairs named by the wave-7 DEC-385
// amendment, keyed by (selector, property).
const SHADOWED_PAIRS: Array<[selector: string, property: string]> = [
  ['.chq-main', 'padding'],
  ['.chq-page-title', 'font-size'],
  ['.chq-page', 'gap'],
  ['.chq-measure', 'max-width'],
  ['.chq-steps', 'grid-template-columns'],
  ['.chq-steps', 'border-top'],
  ['.chq-step', 'border-left'],
  ['.chq-bulkbar', 'align-items'],
  ['.chq-toolbar', 'align-items'],
  ['.chq-rail', 'position'],
  ['.chq-rail', 'flex-direction'],
  ['.chq-checkbox-label', 'display'],
];

describe('phone cascade terminal repair (DEC-385, wave 7)', () => {
  const raw = readFileSync(STYLES_PATH, 'utf-8');
  const css = stripComments(raw);
  const declarations = parseDeclarations(css);
  const top = topLevelConstructs(css);

  it('finds a declaration for every one of the 12 named pairs (non-vacuous)', () => {
    for (const [selector, property] of SHADOWED_PAIRS) {
      const matches = declarations.filter(
        (d) => d.selector === selector && d.property === property,
      );
      expect(matches.length, `expected at least one ${selector}{${property}} declaration`).toBeGreaterThan(0);
    }
  });

  it('resolves exactly 12 pairs from the SHADOWED_PAIRS list (parser sanity)', () => {
    expect(SHADOWED_PAIRS.length).toBe(12);
  });

  it.each(SHADOWED_PAIRS)(
    'the LAST %s{%s} declaration in source order is inside a max-width:700px block',
    (selector, property) => {
      const matches = declarations
        .filter((d) => d.selector === selector && d.property === property)
        .sort((a, b) => a.offset - b.offset);
      expect(matches.length).toBeGreaterThan(0);
      const last = matches[matches.length - 1];
      expect(last).toBeDefined();
      expect(
        last?.insidePhoneMedia,
        `expected the LAST ${selector}{${property}} declaration (value: ${last?.value}) to be ` +
          'inside a max-width:700px media block, i.e. to win the cascade at phone widths',
      ).toBe(true);
    },
  );

  it('the appended terminal block is the file\'s final top-level construct', () => {
    expect(top.length).toBeGreaterThan(0);
    const last = top[top.length - 1];
    expect(last).toBeDefined();
    expect(last?.isMedia).toBe(true);
    expect(last?.header).toMatch(/max-width:\s*700px/);
    // Sanity: the terminal block actually contains the repair (not some
    // unrelated trailing media block) -- spot-check a couple of the 12
    // selectors appear in its body.
    expect(last?.body).toContain('.chq-main');
    expect(last?.body).toContain('.chq-checkbox-label');
  });

  it('the file carries exactly one max-width:700px block, forward-merged (DEC-385 wave-100/102 amendment, v12m-w3-k)', () => {
    // This test used to assert the wave-7 fix's ORIGINAL shape: a first,
    // untouched historical block at :381 plus a second, separate terminal
    // block appended at the file's end. DEC-385 wave-100/102 superseded
    // that shape with a one-terminal-block contract for every sheet, and
    // v12m-w3-k forward-merged this file's four earlier @media
    // (max-width: 700px) blocks into the sheet's one remaining block, in
    // ascending source order -- so there is no longer a separate first
    // block to leave untouched. The one block that remains is both the
    // file's first AND its last max-width:700px construct, and it still
    // carries the content the old first block held (.chq-header,
    // .chq-tabbar) alongside the twelve restated shadow-repair
    // declarations (.chq-main, .chq-checkbox-label, ...) checked above.
    const phoneMedia = top.filter((c) => c.isMedia && /max-width:\s*700px/.test(c.header));
    expect(phoneMedia.length).toBe(1);
    const sole = phoneMedia[0];
    expect(sole).toBeDefined();
    expect(sole?.body).toContain('.chq-header');
    expect(sole?.body).toContain('.chq-tabbar');
    expect(sole?.body).toContain('.chq-main');
    expect(sole?.body).toContain('.chq-checkbox-label');
  });
});
