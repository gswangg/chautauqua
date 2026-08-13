// DEC-572 regression coverage (ABS-S2-D1): reviewer track-scope assignment
// must show the TRUE fan-out count and require an explicit confirm before
// any plan_reviewer row is POSTed.
// DEC-745: the assign controls this test drives now sit behind the "Who
// reviews what" section's "Assign a reviewer" link (progressive disclosure,
// not a removed capability) -- renderEditor opens it before interacting.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlanEditor } from './PlanEditor';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-plan-editor';
const PLAN_ID = 'plan-1';
const TRACK_ID = 'track-a';

function plan() {
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
  };
}

const REVIEWER = { id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 };
const TRACKS = [{ id: TRACK_ID, name: 'Backend' }];
const PREVIEW_ITEMS = [
  { id: 'sub-1', ref: 'S-001', title: 'Talk One' },
  { id: 'sub-2', ref: 'S-002', title: 'Talk Two' },
  { id: 'sub-3', ref: 'S-003', title: 'Talk Three' },
];

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

async function renderEditor(fetchMock: ReturnType<typeof mockApi>) {
  render(
    <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
      <Routes>
        <Route path="/review/plans/:planId" element={<PlanEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Assign a reviewer' })).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Assign a reviewer' }));
  await waitFor(() => {
    expect(screen.getByRole('option', { name: 'reviewer@example.test' })).toBeInTheDocument();
  });
  void fetchMock;
}

function selectTrackScope() {
  fireEvent.change(screen.getByLabelText('Reviewer'), { target: { value: 'user-42' } });
  fireEvent.change(screen.getByLabelText('Assignment scope'), { target: { value: 'track' } });
  fireEvent.change(screen.getByLabelText('Track'), { target: { value: TRACK_ID } });
}

describe('DEC-572: PlanEditor track-scope assignment confirm gate', () => {
  it('shows the true count on the Assign button and does not POST until "Assign all N"', async () => {
    const postSpy = vi.fn(() => ({ status: 201, body: { id: 'pr-new', userId: 'user-42', trackId: TRACK_ID, submissionId: null } }));
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope(TRACKS),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([REVIEWER]),
      [`GET /api/v1/plans/${PLAN_ID}/scope-preview`]: { count: 3, items: PREVIEW_ITEMS, perPage: 200 },
      [`POST /api/v1/plans/${PLAN_ID}/reviewers`]: postSpy,
    });

    await renderEditor(fetchMock);
    selectTrackScope();

    // Count-bearing button label, no POST fired yet.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Assign 3 submissions in Backend' })).toBeInTheDocument();
    });
    expect(postSpy).not.toHaveBeenCalled();

    // Clicking the primary button opens the inline confirm -- still no POST.
    fireEvent.click(screen.getByRole('button', { name: 'Assign 3 submissions in Backend' }));
    expect(await screen.findByRole('alertdialog', { name: 'Confirm track assignment' })).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();

    // "Assign all 3" posts the single trackId-scoped row.
    fireEvent.click(screen.getByRole('button', { name: 'Assign all 3' }));
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls.find(
      ([input, init]) => String(input).includes('/reviewers') && (init as RequestInit | undefined)?.method === 'POST',
    );
    const body = call ? JSON.parse((call[1] as RequestInit).body as string) : null;
    expect(body).toEqual({ userId: 'user-42', trackId: TRACK_ID });
  });

  // DEC-924: "Choose submissions" issues ONE set-based, all-or-nothing
  // request for the whole chosen set -- never the old per-submission
  // Promise.all, which could leave half the rows behind on a mid-batch
  // rejection.
  it('"Choose submissions" for 3 checked items issues exactly ONE non-GET request, carrying the full set', async () => {
    const postSpy = vi.fn(() => ({
      status: 201,
      body: {
        items: [
          { id: 'pr-1', userId: 'user-42', trackId: null, submissionId: 'sub-1' },
          { id: 'pr-2', userId: 'user-42', trackId: null, submissionId: 'sub-2' },
          { id: 'pr-3', userId: 'user-42', trackId: null, submissionId: 'sub-3' },
        ],
        total: 3,
      },
    }));
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope(TRACKS),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([REVIEWER]),
      [`GET /api/v1/plans/${PLAN_ID}/scope-preview`]: { count: 3, items: PREVIEW_ITEMS, perPage: 200 },
      [`POST /api/v1/plans/${PLAN_ID}/reviewers`]: postSpy,
    });

    await renderEditor(fetchMock);
    selectTrackScope();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Assign 3 submissions in Backend' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Assign 3 submissions in Backend' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Choose submissions' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'S-001 — Talk One' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'S-002 — Talk Two' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'S-003 — Talk Three' }));
    expect(postSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm selection (3)' }));
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));

    // Exactly one non-GET request total, carrying the whole chosen set.
    const nonGetCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method && (init as RequestInit).method !== 'GET',
    );
    expect(nonGetCalls.length).toBe(1);
    const nonGetCall = nonGetCalls[0];
    if (!nonGetCall) throw new Error("unreachable — asserted length 1 above");
    const body = JSON.parse((nonGetCall[1] as RequestInit).body as string) as {
      userId: string;
      submissionIds: string[];
    };
    expect(body.userId).toBe('user-42');
    expect(body.submissionIds.slice().sort()).toEqual(['sub-1', 'sub-2', 'sub-3']);
  });
});
