// v12m wave 16 (task ud-submission-detail-headings), DEC-878 wave-16
// amendment: at 390, the two section headings the frame never draws
// ("Abstract", "Form answers") go screen-reader-only via
// .chq-detail-section-title-frameless, not display:none -- the heading
// stays in the accessibility tree so no capability is removed (DEC-919's
// capability-removal receipt is satisfied by construction).
//
// Source-scan style, mirroring detail-head-390.test.ts's own phoneLayer
// helper: jsdom applies no external stylesheet's @media rule, so this
// reads detail.css's own text (and SubmissionDetailPage.tsx's own markup)
// directly rather than rendering.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'detail.css'), 'utf-8');
const TSX = readFileSync(join(HERE, 'SubmissionDetailPage.tsx'), 'utf-8');

/** Brace-matches every `@media (max-width: 700px) { ... }` block in
 * detail.css and concatenates their bodies -- mirrors
 * detail-head-390.test.ts's own phoneLayer helper. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
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
    out.push(css.slice(start, i - 1));
  }
  return out.join('\n');
}

const PHONE = phoneLayer(CSS);

describe('Submission detail 390 headings gone screen-reader-only (DEC-878 wave-16 amendment)', () => {
  it('the frameless class rule lives inside a max-width: 700px block', () => {
    // Confirms the declaration is only ever inside the phone layer, never
    // a top-level (desktop-affecting) rule -- desktop stays frozen.
    expect(PHONE).toMatch(/\.chq-detail-section-title-frameless\s*\{/);
  });

  it('the frameless class rule is a visually-hidden clip shape, never display: none', () => {
    const match = PHONE.match(/\.chq-detail-section-title-frameless\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toMatch(/position:\s*absolute/);
    expect(body).toMatch(/clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
    expect(body).not.toMatch(/display:\s*none/);
  });

  it('exactly two h2s carry chq-detail-section-title-frameless: Abstract and Form answers', () => {
    const framelessHeadings = [
      ...TSX.matchAll(/<h2 className="[^"]*chq-detail-section-title-frameless[^"]*">([^<]*)<\/h2>/g),
    ].map((m) => m[1]!.trim());
    expect(framelessHeadings).toEqual(['Abstract', 'Form answers']);
  });

  it('the Reviews, Decision, Speaker, and History headings do not carry the frameless class', () => {
    // Session details' <h2> (line ~1381) and Decision/Speaker (~1892/1912)
    // stay untouched -- out of scope per DEC-878's two-heading grant.
    const decisionMatch = TSX.match(/<h2 className="chq-detail-section-title">Decision<\/h2>/);
    const speakerMatch = TSX.match(/<h2 className="chq-detail-section-title">\s*Speaker<\/h2>/);
    expect(decisionMatch).not.toBeNull();
    expect(speakerMatch).not.toBeNull();

    // Guard against the frameless class ever attaching to a heading whose
    // text isn't Abstract/Form answers.
    const allFrameless = [...TSX.matchAll(/<h2[^>]*chq-detail-section-title-frameless[^>]*>([^<]*)<\/h2>/g)].map(
      (m) => m[1]!.trim(),
    );
    for (const text of allFrameless) {
      expect(['Abstract', 'Form answers']).toContain(text);
    }
  });

  it('the heading text, level, and DOM order are unchanged: Abstract precedes Form answers, both remain <h2>', () => {
    const abstractIdx = TSX.indexOf('<h2 className="chq-detail-section-title chq-detail-section-title-frameless">Abstract</h2>');
    const answersIdx = TSX.indexOf(
      '<h2 className="chq-detail-section-title chq-detail-section-title-frameless">Form answers</h2>',
    );
    expect(abstractIdx).toBeGreaterThan(-1);
    expect(answersIdx).toBeGreaterThan(-1);
    expect(abstractIdx).toBeLessThan(answersIdx);
  });
});
