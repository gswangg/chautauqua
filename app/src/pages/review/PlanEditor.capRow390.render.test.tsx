// DEC-745 (wave-33 amendment): `Chautauqua Review.dc.html:662` draws the
// 390 "Plan editor" cap row's summary as "Would assign 22 of 36 · you
// confirm before anything saves" -- a different grammar than the desktop
// frame's :549 "18 talks · 36 reviews needed at 2 each · 4 reviewers"
// (already built by `distributeSummaryText`/`capRowSummaryLine`). This file
// pins the PHONE composer (`capRowSummaryLinePhone`/`capRowWouldAssignPhone`
// in PlanEditor.tsx) against the frame's own literal, the desktop composer's
// absence on phone (and vice versa), and the render guard that requires
// progressRows to have actually loaded before the numerator is trusted --
// copying the FakeMediaQueryList/stubPhoneMatchMedia/verbatimLine idiom
// byte-for-byte from PlanEditor.copy-390.render.test.tsx (itself citing
// Scorecard.overall-390.render.test.tsx / Settings.frame-verdicts.render.
// test.tsx for `verbatimLine`).
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
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Review.dc.html');

/** Copied verbatim from PlanEditor.copy-390.render.test.tsx's own
 * `verbatimLine` (DEC-967 shape: reads the ACTUAL design-file line so the
 * citation can never silently rot the way a bare `:line` reference can). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-plan-editor-cap-row-390';
const PLAN_ID = 'plan-cap-row-390';

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    eventId: EVENT_ID,
    name: 'Wave 2',
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
    // Wire field name: `maxEvaluations` (see PlanEditor.tsx:715's
    // maxEvaluationsPerSubmission: plan.maxEvaluations mapping) -- the
    // draft's own internal name is a different map, never sent on the wire.
    maxEvaluations: 2,
    createdAt: 1700000000000,
    timezone: 'UTC',
    ...overrides,
  };
}

function progressRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-42',
    email: 'reviewer@example.test',
    name: null,
    assigned: 3,
    completed: 0,
    recused: 0,
    trackName: null,
    ...overrides,
  };
}

// Same FakeMediaQueryList/stubPhoneMatchMedia pattern PlanEditor.render.
// test.tsx / PlanEditor.copy-390.render.test.tsx already use to force the
// useIsPhone (matchMedia(700px)) split in jsdom, which implements no
// matchMedia at all -- unstubbed tests exercise the desktop tree by default.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

function mockPlan(progressItems: ReturnType<typeof progressRow>[], progressOverrides: Record<string, unknown> = {}) {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
    [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
    [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope(progressItems, {
      total: progressItems.length,
      submissionsInScope: 18,
      ...progressOverrides,
    }),
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

describe('PlanEditor phone cap-row summary (DEC-745 wave-33): "Would assign N of M ..."', () => {
  it('frame citation: :662 draws "Would assign 22 of 36 · you confirm before anything saves"', () => {
    verbatimLine(
      662,
      '          <span style="font-size:12px; color:#565A4B; line-height:1.5">Would assign 22 of 36 · you confirm before anything saves</span>',
    );
  });

  it('phone (matchMedia stubbed true): renders the "Would assign N of M ..." sentence with the computed numbers, no desktop grammar', async () => {
    stubPhoneMatchMedia();
    // reviewsNeeded = 18 submissionsInScope * 2 per talk = 36.
    // alreadyAssigned = 3 (one progress row, no cap set) -> wouldAssign = 33.
    mockPlan([progressRow({ assigned: 3 })]);
    renderEditor();

    expect(await screen.findByText('Would assign 33 of 36 · you confirm before anything saves')).toBeInTheDocument();
    expect(screen.queryByText(/talks ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/reviews needed at/)).not.toBeInTheDocument();
  });

  it('desktop (jsdom default, no matchMedia): renders the exact inverse -- the desktop grammar, never the phone sentence', async () => {
    mockPlan([progressRow({ assigned: 3 })]);
    renderEditor();

    expect(await screen.findByText('18 talks · 36 reviews needed at 2 each · 1 reviewer')).toBeInTheDocument();
    expect(screen.queryByText(/Would assign/)).not.toBeInTheDocument();
  });

  it('phone: progressRows not yet loaded -- renders NO summary node (never a fabricated zero)', async () => {
    stubPhoneMatchMedia();
    // mockApi's fetchMock never actually awaits a handler's own returned
    // promise (it JSON.stringifies whatever handler() returns synchronously
    // -- a raw pending Promise would just serialize to "{}" and resolve
    // immediately), so to genuinely leave the progress fetch unsettled for
    // this test's lifetime, wrap the mock's fetch and intercept that one
    // route directly.
    mockPlan([progressRow({ assigned: 3 })]);
    const progressPath = `/api/v1/plans/${PLAN_ID}/progress`;
    const inner = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const path = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0];
        if (path === progressPath) return new Promise<Response>(() => {});
        return inner(input, init);
      }),
    );
    renderEditor();

    // Give pending microtasks/effects a turn without ever resolving progress.
    await screen.findByText('Distribute the unassigned');
    expect(screen.queryByText(/Would assign/)).not.toBeInTheDocument();
    expect(document.querySelector('.chq-review-distribute-summary')).not.toBeInTheDocument();
  });
});
