// DEC-958 amendment (wave 64): src/routes/review/plans-reviewers.ts throws
// SIX field-keyed refusals from POST /api/v1/plans/:id/reviewers -- plus
// parseBoundedIdArray's own submissionIds-keyed refusal -- all sharing the
// top-level message "Invalid reviewer assignment". PlanEditor.tsx used to
// read exactly one fields key per call site (submissionId in assignReviewer,
// nothing in confirmAssignAllInTrack, submissionIds in confirmAssignChosen),
// so a { userId: "required" } or { trackId: "unknown track..." } refusal
// rendered the same four-word top-level message everywhere. This test
// mirrors app/src/pages/comms/compose-refusal-shapes.test.ts: it enumerates
// the route's refusal KEYS (a matcher per key, not per message, since a
// single key can be thrown by more than one call site) and asserts
// PlanEditor.tsx carries a matcher for each -- plus render assertions that
// the fields-map is actually walked and rendered, never dropped.
// NOTE: this file is .test.ts (not .test.tsx), matching
// compose-refusal-shapes.test.ts's filename exactly per the wave-64 task
// spec -- the render assertions below use React.createElement rather than
// JSX so esbuild's .ts (non-JSX) transform accepts the file unmodified.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlanEditor } from './PlanEditor';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';

const planEditorSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'PlanEditor.tsx'),
  'utf8',
);

// The exact fields-map KEYS src/routes/review/plans-reviewers.ts can throw
// from POST /api/v1/plans/:id/reviewers (see :68, :82-89 via
// parseBoundedIdArray, :87, :96, :121, :132, :144).
const REFUSAL_KEYS = ['userId', 'trackId', 'submissionId', 'submissionIds'] as const;

const EVENT_ID = 'evt-plan-editor-refusal';
const PLAN_ID = 'plan-refusal-1';

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
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 1700000000000,
    timezone: 'UTC',
    ...overrides,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

async function openAssignForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Assign a reviewer' }));
}

describe('PlanEditor source carries a matcher per POST /plans/:id/reviewers refusal key', () => {
  it('defines the reviewer-assign field-label map', () => {
    expect(planEditorSource).toContain('REVIEWER_ASSIGN_FIELD_LABELS');
  });

  it.each(REFUSAL_KEYS)('has a matcher entry for the "%s" fields-map key', (key) => {
    expect(planEditorSource).toMatch(new RegExp(`\\b${key}\\s*:\\s*\\{\\s*anchorId`));
  });

  it('walks the WHOLE err.fields map (a seventh shape must add a seventh matcher, not fall through)', () => {
    expect(planEditorSource).toContain('function reviewerAssignProblems(err: ApiError)');
    expect(planEditorSource).toContain('Object.entries(err.fields)');
  });

  it('all three assign call sites route through reviewerAssignProblems, not a single named key', () => {
    const assignReviewerBody = planEditorSource.slice(
      planEditorSource.indexOf('async function assignReviewer('),
      planEditorSource.indexOf('async function confirmAssignAllInTrack('),
    );
    const confirmAllBody = planEditorSource.slice(
      planEditorSource.indexOf('async function confirmAssignAllInTrack('),
      planEditorSource.indexOf('async function confirmAssignChosen('),
    );
    const confirmChosenBody = planEditorSource.slice(
      planEditorSource.indexOf('async function confirmAssignChosen('),
      planEditorSource.indexOf('function toggleChosenSubmission('),
    );
    for (const body of [assignReviewerBody, confirmAllBody, confirmChosenBody]) {
      expect(body).toContain('reviewerAssignProblems(err)');
      // The old single-key reads must be gone from these bodies.
      expect(body).not.toContain('err.fields?.submissionId ?? err.message');
      expect(body).not.toContain('err.fields?.submissionIds ?? err.message');
    }
  });
});

describe('PlanEditor renders every reviewer-assignment refusal shape, anchored to its control', () => {
  it('a { trackId } refusal on the Assign-all-in-track path renders the track message and marks the track control', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-1', name: 'Keynotes' }]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([
        { id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 },
      ]),
      [`GET /api/v1/plans/${PLAN_ID}/scope-preview`]: {
        status: 200,
        body: { count: 2, items: [{ id: 'sub-1', ref: 'SES-001', title: 'Talk A' }], perPage: 200 },
      },
      [`POST /api/v1/plans/${PLAN_ID}/reviewers`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Invalid reviewer assignment', { trackId: 'unknown track for this event' }),
      },
    });

    render(
      createElement(
        MemoryRouter,
        { initialEntries: [`/review/plans/${PLAN_ID}`] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/review/plans/:planId', element: createElement(PlanEditor) }),
        ),
      ),
    );

    await openAssignForm();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'reviewer@example.test' })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Reviewer'), { target: { value: 'user-42' } });
    fireEvent.change(screen.getByLabelText('Assignment scope'), { target: { value: 'track' } });
    fireEvent.change(screen.getByLabelText('Track'), { target: { value: 'trk-1' } });

    const openConfirmButton = await screen.findByRole('button', { name: /Assign 2 submissions in Keynotes/ });
    fireEvent.click(openConfirmButton);

    const assignAllButton = await screen.findByRole('button', { name: 'Assign all 2' });
    fireEvent.click(assignAllButton);

    await waitFor(() => {
      expect(screen.getByText(/Track: unknown track for this event/)).toBeInTheDocument();
    });
    // The summary heading names exactly one problem.
    expect(screen.getByText('One thing needs fixing before this reviewer can be assigned')).toBeInTheDocument();
    // The problem anchors at the track select's own id.
    const link = screen.getByRole('link', { name: /Track: unknown track for this event/ });
    expect(link.getAttribute('href')).toBe('#plan-reviewer-track-select');
    expect(document.getElementById('plan-reviewer-track-select')).not.toBeNull();
    // The operator's typed reviewer selection is preserved, not cleared.
    expect((screen.getByLabelText('Reviewer') as HTMLSelectElement).value).toBe('user-42');
  });

  it('an unknown fields-map key still renders its own text rather than being dropped', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([
        { id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 },
      ]),
      [`POST /api/v1/plans/${PLAN_ID}/reviewers`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Invalid reviewer assignment', { someSeventhShape: 'a brand-new refusal' }),
      },
    });

    render(
      createElement(
        MemoryRouter,
        { initialEntries: [`/review/plans/${PLAN_ID}`] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/review/plans/:planId', element: createElement(PlanEditor) }),
        ),
      ),
    );

    await openAssignForm();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'reviewer@example.test' })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Reviewer'), { target: { value: 'user-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(screen.getByText('someSeventhShape: a brand-new refusal')).toBeInTheDocument();
    });
  });
});
