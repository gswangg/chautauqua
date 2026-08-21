// w19-e/DEC-745 (wave-19 amendment): the plan editor's title row replaces
// docs/design/Chautauqua Review.dc.html`:594`'s separate <h1> (`:597`) +
// footer Save/Cancel band (`:665-668`) with an editable plan-name
// `<input aria-label="Plan name">` and Duplicate/Save on the back-link row
// -- a shell now blessed in docs/design/DEVIATIONS.md. What was genuinely
// missing is a level-1 heading naming the plan; this pin asserts the DOM
// carries exactly one <h1> naming the plan and that the input keeps its
// own `aria-label` (never a second editable copy of the name, DEC-613).
// jsdom applies no stylesheet, so the CSS rule that keeps the heading
// visually hidden at every width is asserted separately by reading the
// CSS source, not by any rendered geometry here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlanEditor } from './PlanEditor';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_FILE = join(HERE, 'review.css');

const EVENT_ID = 'evt-plan-editor-heading-390';
const PLAN_ID = 'plan-heading-390';
const PLAN_NAME = 'AI Engineering Track Review';

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    eventId: EVENT_ID,
    name: PLAN_NAME,
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [{ id: 'c1', label: 'Content', kind: 'rating', weight: 1 }],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 1700000000000,
    timezone: 'UTC',
    ...overrides,
  };
}

class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

function mockPlan() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
    [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
    [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
    'GET /api/v1/users': listEnvelope([]),
  });
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
      <Routes>
        <Route path="/review/plans/:planId" element={<PlanEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

describe('PlanEditor level-1 heading (DEC-745 wave-19 amendment)', () => {
  it('desktop: renders exactly one <h1> naming the plan, plus the rename input with its own aria-label', async () => {
    mockPlan();
    renderEditor();

    const heading = await screen.findByRole('heading', { level: 1, name: PLAN_NAME });
    expect(heading.tagName).toBe('H1');
    expect(heading).toHaveClass('chq-review-editor-title-h1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    const input = screen.getByRole('textbox', { name: 'Plan name' });
    expect(input).toHaveValue(PLAN_NAME);
    // the heading is not a second editable copy of the name (DEC-613)
    expect(input.tagName).toBe('INPUT');
  });

  it('phone (matchMedia stubbed true): still renders exactly one <h1> naming the plan', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    const heading = await screen.findByRole('heading', { level: 1, name: PLAN_NAME });
    expect(heading.tagName).toBe('H1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('CSS: .chq-review-editor-title-h1 is visually hidden by a TOP-LEVEL rule, not scoped inside a media block (DEC-385: not a desktop geometry change)', () => {
    const css = readFileSync(CSS_FILE, 'utf-8');
    const ruleStart = css.indexOf('.chq-review-editor-title-h1 {');
    expect(ruleStart).toBeGreaterThan(-1);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd);
    expect(rule).toContain('position: absolute');
    expect(rule).toContain('clip: rect(0, 0, 0, 0)');

    // not nested inside any @media block: count unmatched braces from the
    // top of the file up to the rule's own opening brace.
    const before = css.slice(0, ruleStart);
    const opens = (before.match(/\{/g) ?? []).length;
    const closes = (before.match(/\}/g) ?? []).length;
    expect(opens - closes).toBe(0);
  });
});
