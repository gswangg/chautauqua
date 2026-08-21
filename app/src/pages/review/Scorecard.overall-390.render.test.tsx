// DEC-889 (wave-159 amendment): the Overall block's 390 anatomy.
//
// docs/design/Chautauqua Review.dc.html:322-328 draws Overall as a flex
// ROW inside the 390 "Reviewer scorecard" card (:280-350): a left column
// carrying the uppercase `Overall` eyebrow (:324), then the weighted-mean
// denominator sentence (:325), then a SEPARATE smaller plain-average
// reconciliation sentence (:326), with the 34px display value (:328) as
// the row's right-hand sibling.
//
// jsdom applies no stylesheet and evaluates no @media rule, so this file
// pins two things separately, mirroring scorecard-phone-frames.test.ts's
// own split:
//   1. DOM structure -- two sibling caption nodes, each carrying its own
//      sentence (render assertions, via Scorecard mounted through the
//      shared mockApi harness scorecard.render.test.tsx already uses).
//   2. The phone grid CSS -- source-scan pins on scorecard.css's own
//      terminal max-width:700px block TEXT, not computed style.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scorecard } from './Scorecard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESIGN_FILE = join(HERE, '../../../../docs/design/Chautauqua Review.dc.html');

/** Copied verbatim from app/src/pages/Settings.frame-verdicts.render.test.tsx
 * (itself citing settings-phone-390.frames.test.ts's own `verbatimLine`). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const SCORECARD_CSS = stripCssComments(readFileSync(join(HERE, 'scorecard.css'), 'utf-8'));

/** Mirrors scorecard-phone-frames.test.ts's phoneLayer: brace-matched
 * concatenation of every `@media (max-width: …)` block's body. */
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

/** A single rule's declaration body, by selector, inside the phone layer --
 * selectors matched as WHOLE members of the rule's comma-separated
 * selector list, never by substring (mirrors scorecard-phone-frames.
 * test.ts's phoneRule). */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

const PLAN_ID = 'plan-overall-390';
const SUBMISSION_ID = 'sub-overall-390';

function plan() {
  return {
    id: PLAN_ID,
    eventId: 'evt-1',
    name: 'AI Engineering',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [
      { id: 'c1', label: 'Quality', kind: 'rating' as const, weight: 1 },
      { id: 'c2', label: 'Originality', kind: 'rating' as const, weight: 1 },
    ],
    rounds: 1,
    currentRound: 1,
    maxEvaluations: null,
    createdAt: 1700000000000,
  };
}

function criteria() {
  return [
    { id: 'c1', label: 'Quality', kind: 'rating' as const, weight: 1 },
    { id: 'c2', label: 'Originality', kind: 'rating' as const, weight: 1 },
  ];
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('DEC-889 (wave-159): Overall block DOM structure -- two sibling caption nodes', () => {
  it('docs/design/Chautauqua Review.dc.html:325/:326 draw the denominator and reconciliation as two separate spans, not one merged sentence -- render splits them into two sibling <p> nodes', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'Your AI Pair Programmer Is Lying to You',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: criteria(),
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Quality (c1)' })).getByRole('radio', { name: 'Quality (c1): 5 of 5' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Originality (c2)' })).getByRole('radio', { name: 'Originality (c2): 4 of 5' }));

    await waitFor(() => expect(within(document.querySelector('.chq-review-overall') as HTMLElement).getByText('4.5')).toBeInTheDocument());

    const overall = document.querySelector('.chq-review-overall') as HTMLElement;
    const denominator = overall.querySelector('.chq-review-overall-caption');
    verbatimLine(
      325,
      '            <span style="font-size:13px; color:#565A4B; line-height:1.5">Weighted mean of the two scored criteria · Fit is recorded, not averaged</span>',
    );
    expect(denominator).not.toBeNull();
    expect(denominator!.textContent).toBe('Averaged by weight, not editable');

    const reconciliation = overall.querySelector('.chq-review-overall-reconciliation');
    verbatimLine(326, '            <span style="font-size:12px; color:#565A4B; line-height:1.5">A plain average of 5, 4, 4 would be 4.33</span>');
    expect(reconciliation).not.toBeNull();
    expect(reconciliation!.textContent).toBe('A plain average of 5, 4 would be 4.5');
    expect(denominator).not.toBe(reconciliation);

    // The value stays the row's sibling (frame :328), not nested inside
    // either sentence node.
    const line = overall.querySelector('.chq-review-overall-line');
    expect(line).not.toBeNull();
    expect(within(line as HTMLElement).getByText('4.5')).toBeInTheDocument();
  });

  it('when unscored, only the denominator node renders -- no empty reconciliation node', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'Your AI Pair Programmer Is Lying to You',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: criteria(),
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' })).toBeInTheDocument();

    expect(document.querySelector('.chq-review-overall-caption')!.textContent).toBe('Averaged by weight, not editable');
    expect(document.querySelector('.chq-review-overall-reconciliation')).toBeNull();
  });
});

describe('DEC-889 (wave-159): Overall block 390 grid CSS -- scorecard.css terminal max-width:700px block', () => {
  it('docs/design/Chautauqua Review.dc.html:322 `<div style="padding:18px 0; border-bottom:1px solid #E1DDCE; display:flex; align-items:center; gap:14px">` -- the desktop flex row becomes a two-column grid at 390, eyebrow/captions left, value right', () => {
    verbatimLine(322, '        <div style="padding:18px 0; border-bottom:1px solid #E1DDCE; display:flex; align-items:center; gap:14px">');

    const rule = phoneRule(SCORECARD_CSS, '.chq-review-overall');
    expect(rule).toMatch(/display:\s*grid/);
    expect(rule).toMatch(/grid-template-columns:\s*1fr auto/);
  });

  it('docs/design/Chautauqua Review.dc.html:323 `<div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:3px">` -- .chq-review-overall-line collapses to display:contents so the eyebrow and the value both become direct grid items of .chq-review-overall', () => {
    verbatimLine(323, '          <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:3px">');

    const rule = phoneRule(SCORECARD_CSS, '.chq-review-overall-line');
    expect(rule).toMatch(/display:\s*contents/);
  });

  it('docs/design/Chautauqua Review.dc.html:328 `<span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:34px; font-weight:700; letter-spacing:-0.03em; line-height:1">4.5</span>` -- the value registers at 34px and spans every row of the right column at 390', () => {
    verbatimLine(
      328,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:34px; font-weight:700; letter-spacing:-0.03em; line-height:1">4.5</span>',
    );

    const rule = phoneRule(SCORECARD_CSS, '.chq-review-overall-line .chq-review-overall-value');
    expect(rule).toMatch(/font-size:\s*34px/);
    expect(rule).toMatch(/grid-column:\s*2/);
    expect(rule).toMatch(/grid-row:\s*1\s*\/\s*-1/);

    // DEC-385 single-direction: no top-level (desktop) rule reads 34px --
    // review.css's .chq-review-overall-value stays 27px above 700px.
    const withoutMedia = SCORECARD_CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    expect(withoutMedia).not.toMatch(/\.chq-review-overall-value[^,{]*\{[^}]*font-size:\s*34px/);
  });

  it('the desktop one-line label+value register is untouched: scorecard.css declares no min-width query and the desktop .chq-review-overall-line flex/baseline rule survives above the phone layer', () => {
    expect(SCORECARD_CSS).not.toMatch(/@media[^{]*min-width/);
    const withoutMedia = SCORECARD_CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    const m = /\.chq-review-overall-line\s*\{([^}]*)\}/.exec(withoutMedia);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/display:\s*flex/);
    expect(m![1]).toMatch(/align-items:\s*baseline/);
    expect(m![1]).toMatch(/justify-content:\s*space-between/);
  });
});
