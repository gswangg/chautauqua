// Text-scan contract for the Contacts 390 segment-pill strip (task r1-c,
// src/decisions-data/DEC-919.md, DEC-385 single-direction responsive). Asserts:
//   1) the four phone rules for `.chq-contacts-segment-pills` and the
//      `.chq-contacts-segment-summary { display: none }` stand-down live
//      INSIDE contacts.css's single terminal `@media (max-width: 700px)`
//      block (test/phone-terminal-block.scan.test.ts owns the "exactly one
//      terminal block" invariant for the whole file; this scan only checks
//      that our four rules are inside it and correctly ordered).
//   2) the segment-summary stand-down is positioned AFTER the earlier
//      `.chq-contacts-segment-summary` phone rules in that same block
//      (DEC-385: nothing above the block moves; this rule supersedes their
//      sizing on the cascade instead of editing them).
//   3) no `.chq-contacts-segment-pills` declaration appears after the
//      block closes.
//   4) the desktop default (`display: none`) is declared outside every
//      media block.
//
// Brace-matching is done over a COMMENT-STRIPPED copy of the file
// (comments blanked in place, length/newlines preserved) -- this file's
// own DEC-393 comment quotes the frame's mustache placeholders verbatim
// (`{{ row.company }}`), and a naive raw-text brace counter miscounts
// those literal `{`/`}` characters as CSS nesting (field-guide w94/w96
// lesson, mirrored from test/phone-terminal-block.scan.test.ts's own
// stripComments helper).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'contacts.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

const MEDIA_HEADER = '@media (max-width: 700px)';

/** Blanks out /* ... *\/ comments in place, preserving length and
 * newlines, so offsets computed on the result stay valid indices into the
 * raw text (mirrors test/phone-terminal-block.scan.test.ts). */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** The [start, end) byte range of the body of the LAST top-level (depth-0)
 * `@media (max-width: 700px) { ... }` block in `css`, found by a
 * brace-depth walk over the comment-stripped text. Offsets index the
 * comment-stripped string, which has the same length as `css`, so they
 * are valid indices into the raw text too. */
function findTerminalMediaBlockBody(css: string): { start: number; end: number } {
  const clean = stripComments(css);
  const ranges: { start: number; end: number }[] = [];
  let depth = 0;
  let headerStart = 0;
  let pendingMediaOpen = -1;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '{') {
      if (depth === 0 && normalise(clean.slice(headerStart, i)) === MEDIA_HEADER) {
        pendingMediaOpen = i + 1;
      }
      depth += 1;
      headerStart = i + 1;
    } else if (c === '}') {
      depth -= 1;
      if (depth < 0) throw new Error('unbalanced braces (unmatched })');
      if (depth === 0 && pendingMediaOpen !== -1) {
        ranges.push({ start: pendingMediaOpen, end: i });
        pendingMediaOpen = -1;
      }
      headerStart = i + 1;
    }
  }
  if (depth !== 0) throw new Error('unbalanced braces at EOF');
  if (ranges.length === 0) throw new Error(`no top-level ${MEDIA_HEADER} block found in ${CSS_PATH}`);
  return ranges[ranges.length - 1]!;
}

function normalise(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

describe('contacts.css: segment-pill strip 390 rules (src/decisions-data/DEC-919.md, DEC-385)', () => {
  const block = findTerminalMediaBlockBody(CSS);
  const blockBody = CSS.slice(block.start, block.end);
  const afterBlock = CSS.slice(block.end);
  const beforeBlock = CSS.slice(0, block.start);

  it('the four phone rules for .chq-contacts-segment-pills / .chq-contacts-segment-summary live inside the terminal block', () => {
    expect(blockBody).toMatch(/\.chq-contacts-segment-pills\s*\{[^}]*display:\s*flex/);
    expect(blockBody).toMatch(/\.chq-contacts-segment-pills\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0/);
    expect(blockBody).toMatch(/\.chq-contacts-segment-pills\s+\.chq-pill\s*\{[^}]*min-height:\s*44px/);
    expect(blockBody).toMatch(/\.chq-contacts-segment-summary\s*\{\s*display:\s*none;?\s*\}/);
  });

  it('the segment-summary stand-down is positioned AFTER the earlier .chq-contacts-segment-summary phone rules in the same block', () => {
    const earlierRuleIdx = blockBody.indexOf('.chq-contacts-segment-summary .chq-select');
    const standDownMatch = /\.chq-contacts-segment-summary\s*\{\s*display:\s*none;?\s*\}/.exec(blockBody);
    expect(earlierRuleIdx).toBeGreaterThan(-1);
    expect(standDownMatch).not.toBeNull();
    expect(standDownMatch!.index).toBeGreaterThan(earlierRuleIdx);
  });

  it('no .chq-contacts-segment-pills declaration appears after the terminal block closes', () => {
    expect(afterBlock).not.toContain('.chq-contacts-segment-pills');
  });

  it('the desktop default (display: none) is declared outside every media block', () => {
    // `beforeBlock` is everything up to and including the terminal block's
    // own `@media (max-width: 700px) {` header (block.start is just after
    // that header's opening brace) -- strip that one header occurrence
    // before checking for any OTHER @media header, so this assertion
    // isn't tripped by the very header the brace-walk above already
    // proved is the file's sole top-level phone block.
    const desktopRuleMatch = /\.chq-contacts-segment-pills\s*\{\s*display:\s*none;?\s*\}/.exec(beforeBlock);
    expect(desktopRuleMatch).not.toBeNull();
    const withoutTerminalHeader = stripComments(beforeBlock).replace(MEDIA_HEADER, '');
    expect(withoutTerminalHeader).not.toContain(MEDIA_HEADER);
  });
});
