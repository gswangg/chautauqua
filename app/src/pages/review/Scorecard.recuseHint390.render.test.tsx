// DEC-889 (wave-32 amendment): docs/design/Chautauqua Review.dc.html:964
// (frame "Scorecard · a criterion unscored") draws, under EACH unscored
// criterion's own score row, a per-criterion recuse hint --
// `Pick a score, or recuse yourself if you cannot judge this one.` -- that
// existed nowhere in the SPA before this task (v12m-w29-c's audit for
// :934-979 confirmed it as the pack's one remaining unowned content gap).
//
// Harness copied from Scorecard.overall-390.render.test.tsx: mockApi +
// verbatimLine + the phoneLayer/phoneRule CSS source-scan pair (jsdom
// applies no stylesheet and evaluates no @media rule). DEC-874: jsdom
// mounts desktop and phone nodes simultaneously, so every DOM assertion
// below is scoped with `within` to one criterion's own <fieldset> --
// never a bare, unscoped screen query.
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

/** Copied verbatim from Scorecard.overall-390.render.test.tsx. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const SCORECARD_CSS = stripCssComments(readFileSync(join(HERE, 'scorecard.css'), 'utf-8'));

/** Mirrors scorecard-phone-frames.test.ts's phoneLayer: brace-matched
 * concatenation of every `@media (max-width: …)` block's body, so a
 * nested rule's own closing brace can never end the scan early. */
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
 * selector list, never by substring. */
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

/** The declaration body OUTSIDE any @media block -- throws if the selector
 * only appears inside one (mirrors scorecard-phone-frames.test.ts's
 * topLevelRuleBody). */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(withoutMedia)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no top-level rule for ${selector}`);
}

const PLAN_ID = 'plan-recuse-hint-390';
const SUBMISSION_ID = 'sub-recuse-hint-390';

function criteria() {
  return [
    { id: 'c1', label: 'Relevance', kind: 'rating' as const, weight: 1 },
    { id: 'c2', label: 'Clarity', kind: 'rating' as const, weight: 1 },
    { id: 'c3', label: 'Speaker readiness', kind: 'rating' as const, weight: 1 },
  ];
}

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
    criteria: criteria(),
    rounds: 1,
    currentRound: 1,
    maxEvaluations: null,
    createdAt: 1700000000000,
  };
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

async function renderScorecard() {
  mockApi({
    'GET /api/v1/review/plans': listEnvelope([plan()]),
    [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
      id: SUBMISSION_ID,
      ref: 'S-020',
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
}

describe('DEC-889 (wave-32): per-criterion recuse hint DOM structure -- one hint, inside the unscored criterion\'s own fieldset', () => {
  it('docs/design/Chautauqua Review.dc.html:964 `          <span style="font-size:13px; font-weight:600; line-height:1.5; color:#1B1D17">Pick a score, or recuse yourself if you cannot judge this one.</span>` -- with exactly one of three criteria unscored, exactly one hint node renders, inside that criterion\'s own <fieldset>', async () => {
    verbatimLine(
      964,
      '          <span style="font-size:13px; font-weight:600; line-height:1.5; color:#1B1D17">Pick a score, or recuse yourself if you cannot judge this one.</span>',
    );

    await renderScorecard();

    // Score c1 and c2, leave c3 ("Speaker readiness") unscored -- matching
    // the frame's own unscored criterion label (:960).
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Relevance (c1)' })).getByRole('radio', { name: 'Relevance (c1): 5 of 5' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Clarity (c2)' })).getByRole('radio', { name: 'Clarity (c2): 4 of 5' }));

    await waitFor(() =>
      expect(within(screen.getByRole('radiogroup', { name: 'Relevance (c1)' })).getByRole('radio', { checked: true })).toBeInTheDocument(),
    );

    const HINT_TEXT = 'Pick a score, or recuse yourself if you cannot judge this one.';
    const allHints = document.querySelectorAll('.chq-review-criterion-hint-phone');
    expect(allHints).toHaveLength(1);
    expect(allHints[0]!.textContent).toBe(HINT_TEXT);
    expect(allHints[0]!.hasAttribute('hidden')).toBe(true);

    const unscoredFieldset = document.getElementById('chq-review-criterion-c3') as HTMLElement;
    expect(unscoredFieldset).not.toBeNull();
    expect(within(unscoredFieldset).getByText(HINT_TEXT)).toBe(allHints[0]);
  });

  it('zero hint nodes inside either scored criterion\'s own fieldset', async () => {
    await renderScorecard();

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Relevance (c1)' })).getByRole('radio', { name: 'Relevance (c1): 5 of 5' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Clarity (c2)' })).getByRole('radio', { name: 'Clarity (c2): 4 of 5' }));

    await waitFor(() =>
      expect(within(screen.getByRole('radiogroup', { name: 'Relevance (c1)' })).getByRole('radio', { checked: true })).toBeInTheDocument(),
    );

    const scoredC1 = document.getElementById('chq-review-criterion-c1') as HTMLElement;
    const scoredC2 = document.getElementById('chq-review-criterion-c2') as HTMLElement;
    expect(within(scoredC1).queryByText(/Pick a score, or recuse yourself/)).toBeNull();
    expect(within(scoredC2).queryByText(/Pick a score, or recuse yourself/)).toBeNull();
  });

  it('a fully-scored fixture renders zero hint nodes anywhere on the page', async () => {
    await renderScorecard();

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Relevance (c1)' })).getByRole('radio', { name: 'Relevance (c1): 5 of 5' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Clarity (c2)' })).getByRole('radio', { name: 'Clarity (c2): 4 of 5' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Speaker readiness (c3)' })).getByRole('radio', { name: 'Speaker readiness (c3): 3 of 5' }));

    await waitFor(() =>
      expect(within(screen.getByRole('radiogroup', { name: 'Speaker readiness (c3)' })).getByRole('radio', { checked: true })).toBeInTheDocument(),
    );

    expect(document.querySelectorAll('.chq-review-criterion-hint-phone')).toHaveLength(0);
  });
});

describe('DEC-889 (wave-32): per-criterion recuse hint CSS -- scorecard.css terminal max-width:700px block only', () => {
  it('the reveal rule appears inside the TERMINAL max-width:700px block, matching the frame\'s 13px/600/1.5/#1B1D17 register', () => {
    verbatimLine(
      964,
      '          <span style="font-size:13px; font-weight:600; line-height:1.5; color:#1B1D17">Pick a score, or recuse yourself if you cannot judge this one.</span>',
    );

    const rule = phoneRule(SCORECARD_CSS, '.chq-review-criterion-hint-phone');
    expect(rule).toMatch(/display:\s*block/);
    expect(rule).toMatch(/font-size:\s*13px/);
    expect(rule).toMatch(/font-weight:\s*600/);
    expect(rule).toMatch(/line-height:\s*1\.5/);
    expect(rule).toMatch(/color:\s*var\(--chq-ink\)/);
  });

  it('no top-level (desktop) rule targets .chq-review-criterion-hint-phone -- DEC-385 single-direction, desktop bytes untouched', () => {
    expect(() => topLevelRuleBody(SCORECARD_CSS, '.chq-review-criterion-hint-phone')).toThrow();
  });
});
