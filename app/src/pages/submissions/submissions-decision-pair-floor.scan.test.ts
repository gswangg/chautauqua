// DEC-964 wave-26 amendment: receipt test for the Decline/Waitlist
// secondary-pair desktop floor.
//
// `docs/design/Chautauqua Submissions.dc.html`:314 draws the "Waitlist"
// secondary decision chip (own text content "Waitlist") at
// `min-height:44px`. `test/desktop-control-floor.scan.test.ts`'s ledger's
// text-match join can never resolve this row to its real control:
// `SubmissionDetailPage.tsx` renders the secondary pair's label via
// `decisionActionLabel(status)` / `DECISION_ACTION_LABELS[status]`, a JSX
// expression, never a literal "Waitlist" string -- the join's only literal
// "Waitlist" own-text match in the whole corpus is Overview's phone-hidden
// queue-move button (`chq-overview-btn chq-overview-btn-waitlist`), a
// DIFFERENT page's control, declared 0px desktop.
//
// This test asserts, byte-for-byte:
//   1. the frame line the ledger cites still draws min-height:44px;
//   2. the product control renders its label via a JSX expression, never a
//      hardcoded "Waitlist" string;
//   3. detail.css carries the real control's floor at a TOP-LEVEL
//      (desktop, non-@media) rule.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src/pages/submissions/
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const FRAME_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Submissions.dc.html');

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

describe('Submissions decision secondary-pair desktop floor (DEC-964 wave-26 amendment)', () => {
  it('the frame line the ledger cites still draws min-height:44px on the Waitlist chip', () => {
    const lines = readFileSync(FRAME_FILE, 'utf-8').split('\n');
    // 1-based line 314.
    expect(lines[313]).toBe(
      '                  <span style="flex:1; border:1px solid #BAB6A6; border-radius:4px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Waitlist</span>'
    );
  });

  it('SubmissionDetailPage.tsx renders the secondary-pair label via a JSX expression, never a literal "Waitlist" string', () => {
    const tsx = readFileSync(join(HERE, 'SubmissionDetailPage.tsx'), 'utf-8');
    expect(tsx).toMatch(/chq-detail-decision-secondary-pair/);
    expect(tsx).toMatch(/\{decisionActionLabel\(status\)\}/);
    expect(tsx).not.toMatch(/>Waitlist</);
  });

  it("detail.css floors .chq-detail-decision-secondary-pair .chq-btn at the frame's own 44px in a TOP-LEVEL (desktop) rule", () => {
    const css = readFileSync(join(HERE, 'detail.css'), 'utf-8');
    const body = topLevelRuleBody(css, '.chq-detail-decision-secondary-pair .chq-btn');
    expect(body).toMatch(/min-height:\s*44px/);
  });
});
