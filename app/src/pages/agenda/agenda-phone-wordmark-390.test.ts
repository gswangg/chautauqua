// DEC-919 (wave-20 amendment): Agenda 390 draws exactly ONE wordmark -- the
// app-shell header's -- and the page's own `.chq-phone-agenda-wordmark`
// (app/src/pages/agenda/PhoneAgenda.tsx:175) stands down at phone via
// `display:none`, not via a `data-chq-phone-head` swap (that contract is
// scoped to pages whose frame draws NO wordmark/identity of its own; using
// it here would also strand `.chq-eventswitcher`, which has no phone rule
// anywhere in styles.css).
//
// Four pins:
//   (a) the v12 frame line this rule answers to, quoted byte-for-byte
//       (DEC-967: a citation is not an assertion until it is checked against
//       the actual line, verbatimLine idiom from
//       ContactsTable.row-390.render.test.tsx / Settings.frame-verdicts).
//   (b) inside agenda.css's terminal max-width:700px block, the
//       `.chq-phone-agenda-wordmark` rule body sets `display: none` and is
//       preceded by a `/* phone-hidden: */` receipt
//       (app/src/phone-capability-removal.scan.test.ts's exact form).
//   (c) NEGATIVE pin: PhoneAgenda.tsx contains no `data-chq-phone-head` --
//       the rejected resolution, pinned so a later wave cannot silently
//       flip back to it.
//   (d) the shell still renders `.chq-wordmark` -- the ONE wordmark left
//       standing is still actually on screen.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Agenda.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const AGENDA_CSS_RAW = readFileSync(join(HERE, 'agenda.css'), 'utf-8');
const AGENDA_CSS = stripCssComments(AGENDA_CSS_RAW);
const PHONE_AGENDA_TSX = readFileSync(join(HERE, 'PhoneAgenda.tsx'), 'utf-8');
const APP_TSX = readFileSync(join(HERE, '..', '..', 'App.tsx'), 'utf-8');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched so a nested rule can never end a block early. Mirrors
 * agenda-phone-frame.test.ts's own `phoneLayer`. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

/** The `.chq-phone-agenda-wordmark` rule body as agenda.css's own terminal
 * phone layer ships it. Resolved at module scope so the citation block below
 * can assert about the TREE in the same breath as it quotes the frame
 * (DEC-967 wave-99: a frame receipt whose every expect() subject is a
 * design-file read asserts nothing about this codebase). */
const PHONE_WORDMARK_RULE = /\.chq-phone-agenda-wordmark\s*\{([^{}]*)\}/.exec(phoneLayer(AGENDA_CSS))?.[1] ?? '';

describe('v12 frame: Agenda 390 head-band wordmark line', () => {
  it('docs/design/Chautauqua Agenda.dc.html:130 is quoted verbatim, and agenda.css ships that same register', () => {
    expect(PHONE_WORDMARK_RULE).toMatch(/font-size:\s*20px/);
    verbatimLine(
      130,
      `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.03em; line-height:1; position:relative; top:-2.5px">chautauqua</span>`,
    );
    expect(PHONE_WORDMARK_RULE).toMatch(/font-weight:\s*700/);
    expect(PHONE_WORDMARK_RULE).toMatch(/letter-spacing:\s*-0\.03em/);
    expect(PHONE_WORDMARK_RULE).toMatch(/top:\s*-2\.5px/);
  });
});

describe('DEC-919 wave-20 amendment: Agenda 390 draws exactly ONE wordmark', () => {
  it("agenda.css's terminal phone layer hides .chq-phone-agenda-wordmark with a receipted display:none", () => {
    const layer = phoneLayer(AGENDA_CSS_RAW); // unstripped: need the raw comment text
    const ruleWithReceipt =
      /\/\*\s*phone-hidden:[^*]*\*\/\s*\.chq-phone-agenda-wordmark\s*\{([^{}]*)\}/;
    const m = ruleWithReceipt.exec(layer);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/display:\s*none/);
  });

  it("stripped, .chq-phone-agenda-wordmark's other frame declarations (font-size/font-weight/letter-spacing/position/top) are untouched", () => {
    const layer = phoneLayer(AGENDA_CSS);
    const rule = /\.chq-phone-agenda-wordmark\s*\{([^{}]*)\}/.exec(layer);
    expect(rule).not.toBeNull();
    const body = rule![1]!;
    expect(body).toMatch(/display:\s*none/);
    expect(body).toMatch(/font-size:\s*20px/);
    expect(body).toMatch(/font-weight:\s*700/);
    expect(body).toMatch(/letter-spacing:\s*-0\.03em/);
    expect(body).toMatch(/position:\s*relative/);
    expect(body).toMatch(/top:\s*-2\.5px/);
  });

  it('PhoneAgenda.tsx sets no data-chq-phone-head attribute on its root (the rejected resolution)', () => {
    expect(PHONE_AGENDA_TSX).not.toMatch(/className="chq-phone-agenda"[^>]*data-chq-phone-head/);
  });

  it('App.tsx still renders .chq-wordmark in the shell header', () => {
    expect(APP_TSX).toMatch(/className="chq-wordmark"/);
  });
});
