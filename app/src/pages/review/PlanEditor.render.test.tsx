// DEC-239 regression + DEC-018 P3 coverage (docs/eval-findings.md Section B
// "Reviewer assignment always fails 'User not found'", Section D "Add-
// criterion clicks made before changing Rounds are discarded"):
//  1. reviewerOptions built from {id,email,role} rows (GET /api/v1/users
//     wire shape) must render <option value> equal to the row's `id` --
//     not `undefined` from a stale `userId` field read.
//  2. adding a criterion, typing its label, then changing Rounds must not
//     discard the typed label.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlanEditor } from './PlanEditor';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-plan-editor';
const PLAN_ID = 'plan-1';

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

describe('PlanEditor render smoke', () => {
  it('renders reviewer options keyed on `id` (not `userId`) from the GET /api/v1/users wire shape', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([{ id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 }]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'reviewer@example.test' })).toBeInTheDocument();
    });
    const option = screen.getByRole('option', { name: 'reviewer@example.test' }) as HTMLOptionElement;
    expect(option.value).toBe('user-42');
  });

  it('keeps a just-typed criterion label after the Rounds count changes', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Track Review')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Add criterion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rating' }));
    const labelInput = screen.getByPlaceholderText('Label');
    fireEvent.change(labelInput, { target: { value: 'Innovation' } });
    expect((labelInput as HTMLInputElement).value).toBe('Innovation');

    const roundsInput = screen.getByLabelText('Rounds');
    fireEvent.change(roundsInput, { target: { value: '2' } });

    expect((screen.getByPlaceholderText('Label') as HTMLInputElement).value).toBe('Innovation');
  });

  it('shows the assigned reviewer email (not the raw userId) immediately after Assign, before any reload', async () => {
    // Section B repair: the browser pass (task-w1-d) found that the newly-
    // assigned row rendered "seed_user_0004" instead of the email, because
    // POST /plans/:id/reviewers's PlanReviewerRecord response has no email
    // column -- fixed by resolving it from the already-loaded reviewerOptions.
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([{ id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 }]),
      [`POST /api/v1/plans/${PLAN_ID}/reviewers`]: {
        status: 201,
        body: { id: 'pr-1', userId: 'user-42', trackId: null, submissionId: null },
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'reviewer@example.test' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Reviewer'), { target: { value: 'user-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(screen.getByText(/reviewer@example\.test/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/user-42/)).not.toBeInTheDocument();
  });

  // DEC-468: /users?role=reviewer is now page-capped -- the picker must
  // disclose truncation, and stay silent when the first page is everything.
  it('shows a truncation note when the reviewer roster is page-capped', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope(
        [{ id: 'user-1', email: 'r1@example.test', role: 'reviewer', contactId: null, createdAt: 0 }],
        { total: 250 },
      ),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Showing first 1 of 250 reviewers')).toBeInTheDocument();
    });
  });

  it('renders no truncation note when the reviewer roster fits in one page', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([
        { id: 'user-1', email: 'r1@example.test', role: 'reviewer', contactId: null, createdAt: 0 },
      ]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'r1@example.test' })).toBeInTheDocument();
    });

    expect(screen.queryByText(/Showing first/)).not.toBeInTheDocument();
  });

  // DEC-659: the scope line must render server-provided names, never a raw
  // ULID, and must say so in words when the server returns a null label for
  // a non-null id (deleted track/submission).
  it('renders reviewer scope by name, never by ULID, and words a null label as removed', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([
        {
          id: 'pr-track',
          userId: 'user-42',
          email: 'reviewer@example.test',
          trackId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          submissionId: null,
          trackName: 'Design',
          submissionRef: null,
          submissionTitle: null,
        },
        {
          id: 'pr-submission',
          userId: 'user-43',
          email: 'reviewer2@example.test',
          trackId: null,
          submissionId: '01ARZ3NDEKTSV4RRFFQ69G5FBW',
          trackName: null,
          submissionRef: 'SES-014',
          submissionTitle: 'Talk Title',
        },
        {
          id: 'pr-removed-track',
          userId: 'user-44',
          email: 'reviewer3@example.test',
          trackId: '01ARZ3NDEKTSV4RRFFQ69G5FCX',
          submissionId: null,
          trackName: null,
          submissionRef: null,
          submissionTitle: null,
        },
      ]),
      'GET /api/v1/users': listEnvelope([]),
    });

    const { container } = render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Track - Design')).toBeInTheDocument();
    });
    expect(screen.getByText('SES-014 - Talk Title')).toBeInTheDocument();
    expect(screen.getByText('Track (removed)')).toBeInTheDocument();

    // No 26-character ULID anywhere in the rendered reviewer list.
    expect(container.textContent ?? '').not.toMatch(/\b[0-9A-Za-z]{26}\b/);
  });

  // DEC-676: a brand-new plan prefills three editable default criteria
  // instead of starting from an empty (invalid) list.
  it('prefills a brand-new plan with the three default criteria', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/review/plans/new']}>
        <Routes>
          <Route path="/review/plans/new" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('New evaluation plan')).toBeInTheDocument();
    });
    expect(screen.getAllByPlaceholderText('Label').map((el) => (el as HTMLInputElement).value)).toEqual([
      'Relevance',
      'Depth',
      'Speaker readiness',
    ]);
    // Each default carries its own one-line guidance.
    const guidanceInputs = screen.getAllByPlaceholderText('Guidance (optional, one line)') as HTMLInputElement[];
    expect(guidanceInputs.every((el) => el.value.length > 0)).toBe(true);
  });

  // DEC-676: weights are relative and plan-wide; the editor renders the
  // derived integer percentage share beside each weight.
  it('renders the computed weight share next to each rating criterion', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [
          { id: 'c1', label: 'Content', kind: 'rating', weight: 3 },
          { id: 'c2', label: 'Delivery', kind: 'rating', weight: 1 },
        ],
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('3 - 75%')).toBeInTheDocument();
    });
    expect(screen.getByText('1 - 25%')).toBeInTheDocument();
    // Section caption states how weights are used, never forcing sum-to-100.
    expect(screen.getByText('Scores average by weight.')).toBeInTheDocument();
  });

  // DEC-676/DEC-709: soft cap at 7 criteria -- the Add link disables and the
  // caption states the count honestly, in the exact copy DEC-709 pins.
  it('disables Add and states the soft-cap caption once the criteria list hits the cap', async () => {
    const sevenCriteria = Array.from({ length: 7 }, (_, i) => ({
      id: `c${i}`,
      label: `Criterion ${i}`,
      kind: 'rating' as const,
      weight: 1,
    }));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: { ...plan(), criteria: sevenCriteria },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('7 of about 7 - more than that and reviewers rush the last ones'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Add criterion' })).toHaveAttribute('aria-disabled', 'true');
  });

  // DEC-676/DEC-213/DEC-709: surfaces the server-side freeze -- a round that
  // already has recorded evaluations renders its criterion rows read-only,
  // names the reason and count, states WHY, and offers the forward move.
  it('renders a locked criteria row with its reason, count and the Start-a-new-wave affordance', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [{ id: 'c1', label: 'Content', kind: 'rating', weight: 1 }],
        evaluationCountsByRound: { '1': 3 },
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Locked - 3 reviews scored against these criteria')).toBeInTheDocument();
    });
    expect(screen.getByText('Changing these would rescore work already done')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Label')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start a new wave' })).toBeInTheDocument();
  });

  // DEC-709: the new-row kind picker is a segmented control (Rating /
  // Dropdown / Text), never a native <select>.
  it('picks a new criterion kind with a segmented control, not a <select>', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Add criterion' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('link', { name: 'Add criterion' }));

    const picker = screen.getByRole('group', { name: 'New criterion kind' });
    expect(picker.querySelector('select')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dropdown' }));

    expect(screen.getByPlaceholderText('Options (comma-separated)')).toBeInTheDocument();
  });
});
