// v12m-w6-a: source order beats media queries, and no CSS-text gate can see
// it. Every phone `@media (max-width: ...)` block in app/src/styles.css is
// written under the assumption that "it's inside a media query, so it wins
// at that width" -- but a plain top-level rule for the SAME selector and
// SAME property, declared LATER in the file, sits at equal specificity, so
// source order decides and the later top-level rule wins at every width,
// including phone widths. This file derives that shadowing directly from
// the stylesheet rather than hand-listing the pairs the task description
// names, so a future edit that introduces a NEW shadow (or removes one)
// moves this test, not just this wave's twelve.
//
// Parsing approach (DEC-808 doctrine: floor must never sit below the
// truth) -- strip comments first (preserving newline count, so every line
// number after a multi-line comment still matches the original file), then
// walk the file doing genuine BRACE MATCHING for every top-level block. A
// regex like `\{[^}]*\}` truncates at the first nested `}` (e.g. the first
// rule inside a `@media` block), so it cannot be trusted to find the END of
// a media block or of a top-level rule that itself contains nested braces.
//
// FINDING (shell, out of scope for this wave -- recorded per task
// instructions): .chq-phone-body (styles.css, inside a live sibling-branch
// hunk near the file's tail) is an orphan scaffold rule with no renderer
// anywhere in the app; its `flex:1; overflow-y:auto` also contradicts
// .chq-main being the app's one scrolling region. Left untouched here.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_PATH = join(HERE, 'styles.css');

/** Strips /* ... *\/ block comments so comment prose can't be mistaken for
 *  rule bodies or confuse the brace matcher. Replaces each stripped
 *  comment with the SAME number of newlines it contained (and nothing
 *  else) so every line number computed against the stripped source still
 *  matches the original file -- a naive strip-to-empty-string shifts every
 *  line after a multi-line comment upward and silently corrupts every
 *  downstream `line N` citation. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    const newlineCount = (match.match(/\n/g) ?? []).length;
    return '\n'.repeat(newlineCount);
  });
}

interface TopLevelBlock {
  /** Raw selector or at-rule prelude, e.g. ".chq-main" or "@media (max-width: 700px)". */
  header: string;
  /** Body between the matched { and } (exclusive). */
  body: string;
  /** 1-indexed line number of the `{` that opens this block. */
  line: number;
}

/** Splits `src` into top-level blocks by genuine brace matching -- walks
 *  character by character, tracking nesting depth, and only closes a
 *  block when depth returns to 0. This is the one property a regex bound
 *  to `[^}]*` cannot have: it would stop at the FIRST `}`, which for a
 *  `@media { .sel { prop: val; } }` block is the inner rule's close, not
 *  the media block's own close. */
function parseTopLevelBlocks(src: string): TopLevelBlock[] {
  const blocks: TopLevelBlock[] = [];
  let i = 0;
  const n = src.length;
  const lineAt = (pos: number): number => {
    let l = 1;
    for (let k = 0; k < pos; k++) if (src[k] === '\n') l++;
    return l;
  };
  while (i < n) {
    const openIdx = src.indexOf('{', i);
    if (openIdx === -1) break;
    const header = src.slice(i, openIdx).trim();
    let depth = 1;
    let j = openIdx + 1;
    while (j < n && depth > 0) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') depth--;
      j++;
    }
    if (depth !== 0) {
      throw new Error(`Unbalanced braces in styles.css starting at offset ${openIdx}`);
    }
    const closeIdx = j - 1; // index of the matching '}'
    const body = src.slice(openIdx + 1, closeIdx);
    if (header.length > 0) {
      blocks.push({ header, body, line: lineAt(openIdx) });
    }
    i = j;
  }
  return blocks;
}

interface Declaration {
  selector: string;
  property: string;
  value: string;
  /** 1-indexed line of the declaration itself. */
  line: number;
}

/** Parses `;`-separated `prop: value` declarations directly inside a
 *  rule body (no nested braces expected -- callers pass a leaf rule's
 *  body). */
function parseDeclarations(selector: string, body: string, bodyStartLine: number): Declaration[] {
  const out: Declaration[] = [];
  let offset = 0;
  for (const raw of body.split(';')) {
    const lineOfDecl = bodyStartLine + (body.slice(0, offset).match(/\n/g) ?? []).length;
    offset += raw.length + 1;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const property = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (!property || !value) continue;
    out.push({ selector, property, value, line: lineOfDecl });
  }
  return out;
}

/** A single simple selector out of a comma-separated selector list, e.g.
 *  ".chq-pill, .chq-rail-link" -> [".chq-pill", ".chq-rail-link"]. Each
 *  gets the same declarations attributed to it -- CSS grouping
 *  semantics. */
function splitSelectorList(header: string): string[] {
  return header
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface ParseResult {
  /** Declarations found inside `@media (max-width: ...)` blocks. */
  phoneDeclarations: Declaration[];
  /** Declarations found at the top level (not inside any @media / @keyframes / etc). */
  topLevelDeclarations: Declaration[];
  maxWidthBlockCount: number;
}

function parseStylesheet(src: string): ParseResult {
  const clean = stripComments(src);
  const topBlocks = parseTopLevelBlocks(clean);
  const phoneDeclarations: Declaration[] = [];
  const topLevelDeclarations: Declaration[] = [];
  let maxWidthBlockCount = 0;

  for (const block of topBlocks) {
    const isMaxWidthMedia = /^@media\s*\(\s*max-width\s*:/i.test(block.header);
    if (isMaxWidthMedia) {
      maxWidthBlockCount++;
      const innerBlocks = parseTopLevelBlocks(block.body);
      for (const inner of innerBlocks) {
        if (inner.header.startsWith('@')) continue; // no nested at-rules expected/handled
        const innerBodyStartLine =
          block.line + (block.body.slice(0, block.body.indexOf(inner.body)).match(/\n/g) ?? []).length;
        for (const sel of splitSelectorList(inner.header)) {
          phoneDeclarations.push(...parseDeclarations(sel, inner.body, innerBodyStartLine));
        }
      }
    } else if (block.header.startsWith('@')) {
      // Other at-rules (@keyframes, @font-face, @media print, etc.) are
      // not part of either population -- skip.
      continue;
    } else {
      for (const sel of splitSelectorList(block.header)) {
        topLevelDeclarations.push(...parseDeclarations(sel, block.body, block.line));
      }
    }
  }

  return { phoneDeclarations, topLevelDeclarations, maxWidthBlockCount };
}

interface Shadow {
  selector: string;
  property: string;
  phoneLine: number;
  shadowLine: number;
}

/** For every (selector, property) pair that appears at least once inside
 *  a max-width media block, find the LAST declaration for that pair
 *  anywhere in the whole file (media or top-level, by line number) --
 *  that is the one the cascade actually applies at equal specificity,
 *  since a `@media (max-width: ...)` wrapper does not add specificity,
 *  only a scoping condition. If that final, winning declaration is a
 *  TOP-LEVEL one, the phone value is shadowed at every phone width:
 *  report the last phone occurrence that precedes it (the one whose
 *  intent got lost) and the top-level line that wins instead. If the
 *  final declaration is itself inside a max-width block, the pair is NOT
 *  shadowed -- a phone declaration appended later in the file
 *  legitimately overrides an earlier top-level one, which is exactly the
 *  fix pattern this file exists to allow (append a later phone block;
 *  never reorder or delete the earlier one). */
function findShadows(result: ParseResult): Shadow[] {
  interface Occurrence {
    line: number;
    isPhone: boolean;
  }
  const byKey = new Map<string, Occurrence[]>();
  // JSON-encode so a compound selector containing a plain space (e.g.
  // ".chq-tabbar .chq-nav-link") can never collide with a naive join.
  const keyOf = (selector: string, property: string): string => JSON.stringify([selector, property]);

  for (const d of result.phoneDeclarations) {
    const key = keyOf(d.selector, d.property);
    const list = byKey.get(key) ?? [];
    list.push({ line: d.line, isPhone: true });
    byKey.set(key, list);
  }
  for (const d of result.topLevelDeclarations) {
    const key = keyOf(d.selector, d.property);
    const list = byKey.get(key) ?? [];
    list.push({ line: d.line, isPhone: false });
    byKey.set(key, list);
  }

  const shadows: Shadow[] = [];
  for (const [key, occurrences] of byKey) {
    const hasPhone = occurrences.some((o) => o.isPhone);
    if (!hasPhone) continue; // not a pair this scan cares about
    occurrences.sort((a, b) => a.line - b.line);
    const winner = occurrences[occurrences.length - 1];
    if (!winner) continue; // defensive; occurrences is non-empty by construction
    if (winner.isPhone) continue; // a phone declaration wins the cascade -- fine
    const lastPhoneBeforeWinner = [...occurrences].filter((o) => o.isPhone && o.line < winner.line).pop();
    if (!lastPhoneBeforeWinner) continue; // defensive; hasPhone guarantees this exists
    const [selector, property] = JSON.parse(key) as [string, string];
    shadows.push({
      selector,
      property,
      phoneLine: lastPhoneBeforeWinner.line,
      shadowLine: winner.line,
    });
  }
  shadows.sort((a, b) => a.phoneLine - b.phoneLine);
  return shadows;
}

describe('phone @media declarations are never shadowed by a later top-level rule', () => {
  const src = readFileSync(STYLES_PATH, 'utf8');
  const result = parseStylesheet(src);

  it('parser found a real population (vacuous-population tripwire)', () => {
    // DEVIATION (w6-a, flagged not decided): the task brief for this test
    // asked for >=200 phone declarations as the vacuous-population floor.
    // styles.css's `@media (max-width: ...)` blocks hold ~106 raw
    // declaration lines / ~126 once selector-list rules (e.g. `.chq-file,
    // .chq-file::file-selector-button { ... }`) are counted once per
    // selector, as CSS grouping semantics require. 200 does not exist in
    // this file today under any correct parse. Narrowest reasonable
    // reading: keep the SHAPE of the tripwire (a floor comfortably above
    // zero and above any single block, so a parser that silently matches
    // nothing -- or matches only one block -- still fails) at the actual
    // measured population instead of a number that would make this test
    // permanently red.
    expect(result.maxWidthBlockCount).toBeGreaterThanOrEqual(4);
    expect(result.phoneDeclarations.length).toBeGreaterThanOrEqual(100);
  });

  it('no selector+property declared inside a max-width media block is re-declared at top level later in the file', () => {
    const shadows = findShadows(result);
    if (shadows.length > 0) {
      const lines = shadows.map(
        (s) => `${s.selector} {${s.property}} — phone line ${s.phoneLine}, shadowed by line ${s.shadowLine}`,
      );
      // eslint-disable-next-line no-console
      console.error(`Shadowed phone declarations:\n${lines.join('\n')}`);
    }
    expect(shadows).toEqual([]);
  });
});
