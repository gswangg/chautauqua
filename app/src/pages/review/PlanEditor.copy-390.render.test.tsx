// w15-tj/DEC-709 (wave-159 amendment): docs/design/Chautauqua Review.dc.html
// ":594" ("Plan editor · 390") draws two labels the desktop plan editor
// frame (:451 "Plan editor · /review/plans/:id") does not -- the criteria
// eyebrow is the bare word "Criteria" (:601, desktop draws "Scoring
// criteria" at :489) and the per-reviewer cap is labelled "Cap each" (:657,
// desktop draws "Cap per reviewer" at :544). Neither substitution is
// blessed in docs/design/DEVIATIONS.md, so PlanEditor.tsx now renders the
// frame's own copy on phone (via the existing useIsPhone seam,
// matchMedia(700px)) while desktop -- frozen, shared with the wider editor
// -- keeps the wording it already had. `verbatimLine` is copied byte-for-
// byte from Settings.frame-verdicts.render.test.tsx (DEC-967 shape: the
// citation reads the ACTUAL design-file line so it can never silently rot
// the way a bare `:line` reference can), repointed at Chautauqua Review.dc.html.
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

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- a citation that can never silently rot to a
 * wrong line the way a bare `:line` reference can. Copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-plan-editor-copy-390';
const PLAN_ID = 'plan-copy-390';

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    eventId: EVENT_ID,
    name: 'Track Review',
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

// Same FakeMediaQueryList/stubPhoneMatchMedia pattern
// PlanEditor.render.test.tsx already uses to force the useIsPhone
// (matchMedia(700px)) split in jsdom, which implements no matchMedia at
// all -- unstubbed tests exercise the desktop tree by default.
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

describe('PlanEditor phone copy (DEC-709 wave-159): Criteria eyebrow / Cap each', () => {
  it('frame citation: :601 draws the bare eyebrow "Criteria"', () => {
    verbatimLine(
      601,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Criteria</span>',
    );
  });

  it('frame citation: :657 labels the per-reviewer cap "Cap each"', () => {
    verbatimLine(
      657,
      '            <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Cap each</span>',
    );
  });

  it('frame citation: desktop plan editor (:489) draws "Scoring criteria", not "Criteria"', () => {
    verbatimLine(
      489,
      '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Scoring criteria</span>',
    );
  });

  it('frame citation: desktop plan editor (:544) draws "Cap per reviewer", not "Cap each"', () => {
    verbatimLine(
      544,
      '              <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Cap per reviewer</span>',
    );
  });

  it('desktop (jsdom default, no matchMedia): renders the frozen desktop copy', async () => {
    mockPlan();
    renderEditor();

    expect(await screen.findByText('Scoring criteria')).toBeInTheDocument();
    expect(screen.queryByText('Criteria')).not.toBeInTheDocument();
    expect(await screen.findByText('Cap per reviewer')).toBeInTheDocument();
    expect(screen.queryByText('Cap each')).not.toBeInTheDocument();
  });

  it('phone (matchMedia stubbed true): renders the frame\'s own "Criteria" / "Cap each" copy', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    expect(await screen.findByText('Criteria')).toBeInTheDocument();
    expect(screen.queryByText('Scoring criteria')).not.toBeInTheDocument();
    expect(await screen.findByText('Cap each')).toBeInTheDocument();
    expect(screen.queryByText('Cap per reviewer')).not.toBeInTheDocument();
  });
});
