// w19-e (DEC-874 wave-19 amendment): docs/design/Chautauqua Review.dc.html
// `:817` draws "With one open plan this page is skipped — you land
// straight in its queue." as the hub body's own closing line, and `:821`
// draws "Scores stay hidden from other reviewers" as a SEPARATE sentence
// inside the docked footer band. Before this fix ReviewerQueue.tsx merged
// both sentences into one `.chq-reviewer-plans-footnote` paragraph and
// ALSO rendered a second, phone-only `.chq-reviewer-plans-phone-note` node
// repeating sentence two -- so at 390 the reader saw the hidden-scores
// sentence twice. The fix splits the paragraph into two sibling spans
// (desktop byte-identical, matching the 1600 frame `:775` which genuinely
// carries both sentences on one line) and hides only the repeat span at
// 390 via review.css's terminal max-width:700px block. jsdom applies no
// stylesheet, so the DOM-structure assertions here and the CSS-source
// assertions below are separate checks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewerQueue } from './ReviewerQueue';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Review.dc.html');
const CSS_FILE = join(HERE, 'review.css');

function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

function reviewerMe() {
  return { userId: 'u-reviewer', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' };
}

function queueEnvelope<T extends { alreadyRatedByMe?: boolean }>(
  items: T[],
  overrides: { total?: number; unscoredTotal?: number } = {},
) {
  return {
    ...listEnvelope(items),
    total: overrides.total ?? items.length,
    unscoredTotal: overrides.unscoredTotal ?? items.filter((i) => !i.alreadyRatedByMe).length,
  };
}

function renderReview(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/review" element={<ReviewerQueue />} />
        <Route path="/review/plans/:planId" element={<ReviewerQueue />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockTwoOpenPlans() {
  const PLAN_A = 'plan-a-footnote390';
  const PLAN_B = 'plan-b-footnote390';

  mockApi({
    'GET /api/v1/me': reviewerMe(),
    'GET /api/v1/review/plans': listEnvelope([
      { id: PLAN_A, eventId: 'evt-1', name: 'Wave 2', timezone: 'UTC' },
      { id: PLAN_B, eventId: 'evt-1', name: 'Wave 3', timezone: 'UTC' },
    ]),
    [`GET /api/v1/review/plans/${PLAN_A}/queue`]: {
      ...queueEnvelope([{ submissionId: 'a-1', alreadyRatedByMe: false }], { total: 10, unscoredTotal: 9 }),
      open: true,
      recused: [],
      planName: 'Wave 2',
      scopeTrackName: null,
      closeDate: null,
    },
    [`GET /api/v1/review/plans/${PLAN_B}/queue`]: {
      ...queueEnvelope([{ submissionId: 'b-1', alreadyRatedByMe: false }], { total: 8, unscoredTotal: 8 }),
      open: true,
      recused: [],
      planName: 'Wave 3',
      scopeTrackName: null,
      closeDate: null,
    },
  });
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  cleanup();
});

describe('ReviewerQueue hub footnote (DEC-874 wave-19 amendment): one sentence, one place, per width', () => {
  it('frame citations: :817 (body close) and :821 (dock sentence) are two separate sentences in the frame', () => {
    verbatimLine(
      817,
      '        <span style="display:block; padding:16px 0 0; font-size:13px; color:#565A4B; line-height:1.5">With one open plan this page is skipped — you land straight in its queue.</span>',
    );
    verbatimLine(821, '        <span style="font-size:13px; color:#565A4B">Scores stay hidden from other reviewers</span>');
  });

  it('renders one footnote paragraph with two sibling spans, reading order and text byte-identical to the merged desktop sentence', async () => {
    mockTwoOpenPlans();
    renderReview('/review');

    await screen.findByText('Wave 2');
    const footnote = document.querySelector('.chq-reviewer-plans-footnote') as HTMLElement;
    expect(footnote).not.toBeNull();
    expect(footnote.tagName).toBe('P');

    const spans = footnote.querySelectorAll('span');
    expect(spans).toHaveLength(2);
    expect(spans[0]!.textContent).toBe('With one open plan this page is skipped — you land straight in its queue.');
    expect(spans[1]!.textContent).toBe('Scores stay hidden from other reviewers.');
    expect(spans[1]!).toHaveClass('chq-reviewer-plans-footnote-repeat');

    // desktop text is byte-identical, in reading order, to the frame's own
    // merged 1600 closing line (:775).
    expect(footnote.textContent).toBe(
      'With one open plan this page is skipped — you land straight in its queue. Scores stay hidden from other reviewers.',
    );

    // the separate dock note (already carrying the same sentence at 390)
    // is untouched by this fix.
    const dockNote = document.querySelector('.chq-reviewer-plans-phone-note');
    expect(dockNote).not.toBeNull();
    expect(dockNote!.textContent).toBe('Scores stay hidden from other reviewers');
  });

  it('CSS: the terminal max-width:700px block hides only .chq-reviewer-plans-footnote-repeat, carrying a phone-hidden receipt naming .chq-reviewer-plans-phone-note as the same-surface substitution', () => {
    const css = readFileSync(CSS_FILE, 'utf-8');
    const terminalBlockStart = css.lastIndexOf('@media (max-width: 700px)');
    expect(terminalBlockStart).toBeGreaterThan(-1);
    const narrowCss = css.slice(terminalBlockStart);

    const receiptIdx = narrowCss.indexOf('phone-hidden:');
    expect(receiptIdx).toBeGreaterThan(-1);
    const receiptWindow = narrowCss.slice(receiptIdx, receiptIdx + 700);
    expect(receiptWindow).toContain('.chq-reviewer-plans-footnote-repeat');
    expect(receiptWindow).toContain('.chq-reviewer-plans-phone-note');

    const rule = narrowCss.match(/\.chq-reviewer-plans-footnote-repeat\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/display:\s*none/);

    // the desktop register (before the terminal block) declares no rule
    // for this class at all -- DEC-385 single-direction, narrow overrides
    // wide via max-width only.
    const desktopCss = css.slice(0, terminalBlockStart);
    expect(desktopCss).not.toMatch(/\.chq-reviewer-plans-footnote-repeat\s*\{/);
  });
});
