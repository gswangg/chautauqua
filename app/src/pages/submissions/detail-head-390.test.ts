// v12m wave 1 (task w1-h): Submission detail's 390 HEAD band to frame
// (Chautauqua Submissions.dc.html lines 356-364), DEC-919 amendment
// wave 98. The footer half (`.chq-phone-dock .chq-detail-decision-rail`)
// already landed at detail.css:1103, closing submissions-v12.md finding 1
// -- this file covers the head half only. Source-scan style, mirroring
// submissions-css.test.ts's phoneLayer helper: jsdom applies no external
// stylesheet's @media rule, so this reads detail.css's own text (and
// SubmissionDetailPage.tsx's own markup) directly rather than rendering.
//
// Every assertion below carries a DEC-976 receipt: a backtick-quoted
// verbatim literal from the cited frame line, plus a real expect() within
// 6 source lines beneath the comment that states the claim.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'detail.css'), 'utf-8');
const TSX = readFileSync(join(HERE, 'SubmissionDetailPage.tsx'), 'utf-8');

/** Brace-matches every `@media (max-width: 700px) { ... }` block in
 * detail.css (the file carries three) and concatenates their bodies --
 * mirrors submissions-css.test.ts's own phoneLayer helper. */
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

describe('Submission detail 390 head band (DEC-919 wave-98 amendment)', () => {
  // docs/design/Chautauqua Submissions.dc.html:358
  // `font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center`
  // (‹ Triage) -- ONE anchor carries both labels; only the short one shows
  // at phone width, and desktop's existing '‹ All submissions' text is
  // untouched (DEC-919: one control, two spans, never a second link).
  it('the back link stays a single <Link>, with a phone-only short label swapped in by CSS', () => {
    expect(TSX).toMatch(/<Link to="\/submissions" className="chq-detail-back">/);
    expect(TSX).toMatch(/<span className="chq-detail-back-full">All submissions<\/span>/);
    expect(TSX).toMatch(/<span className="chq-detail-back-short"[^>]*>\s*Triage\s*<\/span>/);
    expect(PHONE).toMatch(/\.chq-detail-back-full\s*\{[^}]*display:\s*none/);
    expect(PHONE).toMatch(/\.chq-detail-back-short\s*\{[^}]*display:\s*inline/);
  });

  // docs/design/Chautauqua Submissions.dc.html:359
  // `margin-left:auto; font-size:12px; color:#565A4B`
  // (33 of 47) -- the ref prefix drops at 390 and the bare count
  // right-flushes; the ref itself is not lost, it moves into the eyebrow.
  it('the ref/position string drops its ref prefix and right-flushes to a bare count at 390', () => {
    expect(TSX).toMatch(/<span className="chq-detail-ref-position-full">/);
    expect(TSX).toMatch(/<span className="chq-detail-ref-position-count"[^>]*>/);
    expect(PHONE).toMatch(/\.chq-detail-ref-position\s*\{[^}]*margin-left:\s*auto/);
    expect(PHONE).toMatch(/\.chq-detail-ref-position-full\s*\{[^}]*display:\s*none/);
    expect(PHONE).toMatch(/\.chq-detail-ref-position-count\s*\{[^}]*display:\s*inline/);
  });

  // docs/design/Chautauqua Submissions.dc.html:361
  // `font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B`
  // -- the ref leads the eyebrow at 390 via generated content (data-ref +
  // ::before), never a real text node, so DEC-908's ref-free desktop
  // eyebrow textContent stays untouched.
  it('the eyebrow carries data-ref and gets a phone-only generated-content ref prefix', () => {
    expect(TSX).toMatch(/<p className="chq-detail-eyebrow" data-ref=\{detail\.ref\}>/);
    expect(PHONE).toMatch(/\.chq-detail-eyebrow\[data-ref\]::before\s*\{[^}]*content:\s*attr\(data-ref\)/);
  });

  // docs/design/Chautauqua Submissions.dc.html:362
  // `font-size:22px; font-weight:700; letter-spacing:-0.035em; line-height:1.2`
  // -- already landed (a prior phone block), pinned here rather than
  // restated per the task's own instruction.
  it('the H1 is already 22px with the frame\'s letter-spacing and line-height (pinned, not restated)', () => {
    expect(CSS).toMatch(
      /\.chq-detail-heading h1\s*\{\s*font-size:\s*22px;\s*letter-spacing:\s*-0\.035em;\s*line-height:\s*1\.2;\s*\}/,
    );
  });

  // docs/design/Chautauqua Submissions.dc.html:363
  // `font-size:13px; color:#565A4B`
  // -- a phone-only byline under the H1, sourced from the same participant
  // already resolved for the speaker rail (named 'speaker' role, else the
  // first participant) -- no new request, no guessed multi-speaker line.
  it('a phone-only byline renders under the H1 from the page\'s already-resolved speaker', () => {
    expect(TSX).toMatch(/<p className="chq-detail-byline"[^>]*>\s*\{speaker\.name\}/);
    expect(PHONE).toMatch(/\.chq-detail-byline\s*\{[^}]*display:\s*block/);
    expect(PHONE).toMatch(/\.chq-detail-byline\s*\{[^}]*font-size:\s*13px/);
  });

  // Chautauqua Submissions.dc.html's head band (lines 356-364) draws no
  // pager at all -- DEC-919 ('390 keeps desktop's
  // capabilities … display:none is legal only for a control with nothing
  // left to govern') means Previous/Next RE-LINE onto their own full-width
  // row rather than vanish; they are never display:none'd.
  it('Previous/Next re-line onto their own full-width row below the head band, never hidden', () => {
    expect(PHONE).toMatch(/\.chq-detail-position\s*\{[^}]*width:\s*100%/);
    expect(PHONE).not.toMatch(/\.chq-detail-position\s*\{[^}]*display:\s*none/);
    expect(PHONE).not.toMatch(/\.chq-detail-position-prev,?\s*\n?\s*\.chq-detail-position-next\s*\{[^}]*display:\s*none/);
  });

  // Previous/Next keep the 44px floor already established by the earlier
  // phone block (detail.css:858-862) -- this task only re-flows the row's
  // width, it does not touch that rule.
  it('Previous/Next keep their existing 44px floor rule (unmodified by this task)', () => {
    expect(PHONE).toMatch(/\.chq-detail-position-prev,\s*\.chq-detail-position-next\s*\{[^}]*min-height:\s*44px/);
  });
});
