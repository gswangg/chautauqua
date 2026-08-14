// DEC-239 regression + DEC-018 P3 coverage (docs/eval-findings.md Section B
// "Reviewer assignment always fails 'User not found'", Section D "Add-
// criterion clicks made before changing Rounds are discarded") plus DEC-745
// v4-shell coverage (title-row NAME/Duplicate/Save, 2x2 field grid, "Who
// reviews what" renamed section, no-touch-no-error on the new-plan route).
//  1. reviewerOptions built from {id,email,role} rows (GET /api/v1/users
//     wire shape) must render <option value> equal to the row's `id` --
//     not `undefined` from a stale `userId` field read.
//  2. adding a criterion, typing its label, then reassigning the round
//     override must not discard the typed label.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlanEditor } from './PlanEditor';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { guardedNavigate } from '../../lib/useNavExceptions';

const EVENT_ID = 'evt-plan-editor';
const PLAN_ID = 'plan-1';
const HERE = dirname(fileURLToPath(import.meta.url));
const REVIEW_CSS = readFileSync(join(HERE, 'review.css'), 'utf-8');

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

describe('PlanEditor render smoke', () => {
  it('renders reviewer options keyed on `id` (not `userId`) from the GET /api/v1/users wire shape', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([{ id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 }]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await openAssignForm();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'reviewer@example.test' })).toBeInTheDocument();
    });
    const option = screen.getByRole('option', { name: 'reviewer@example.test' }) as HTMLOptionElement;
    expect(option.value).toBe('user-42');
  });

  // w35-e/DEC-757: the reviewer picker leads with the person's name (email
  // as the quiet secondary), same fallback rule as the org directory.
  it('labels a named reviewer option by name with email as the quiet secondary', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([
        { id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', name: 'Priya Chen', contactId: null, createdAt: 0 },
      ]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await openAssignForm();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Priya Chen (reviewer@example.test)' })).toBeInTheDocument();
    });
    const option = screen.getByRole('option', { name: 'Priya Chen (reviewer@example.test)' }) as HTMLOptionElement;
    expect(option.value).toBe('user-42');
  });

  it('keeps a just-typed criterion label after switching the round tab', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan({ rounds: 2 }),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
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
      expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Add criterion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rating' }));
    const labelInput = screen.getByPlaceholderText('Label');
    fireEvent.change(labelInput, { target: { value: 'Innovation' } });
    expect((labelInput as HTMLInputElement).value).toBe('Innovation');

    // Round tabs are the only remaining round control (ROUNDS number input
    // is gone -- DEC-745; POST /plans/:id/waves is now the sole way rounds
    // grow). Switching to round 1 and back to Base must not discard it.
    fireEvent.change(screen.getByLabelText(/Editing criteria for/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Editing criteria for/), { target: { value: '0' } });

    expect((screen.getByPlaceholderText('Label') as HTMLInputElement).value).toBe('Innovation');
  });

  it('shows the assigned reviewer email (not the raw userId) immediately after Assign, before any reload', async () => {
    // Section B repair (DEC-659 amendment, wave 55): the server's create
    // response is decorated the same way the GET list mapper is (email/
    // trackName/submissionRef/submissionTitle), so the client renders it
    // as-is with no local patching from reviewerOptions.
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([{ id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 }]),
      [`POST /api/v1/plans/${PLAN_ID}/reviewers`]: {
        status: 201,
        body: {
          id: 'pr-1',
          userId: 'user-42',
          email: 'reviewer@example.test',
          trackId: null,
          submissionId: null,
          trackName: null,
          submissionRef: null,
          submissionTitle: null,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await openAssignForm();
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
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
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

    await openAssignForm();
    await waitFor(() => {
      expect(screen.getByText('Showing first 1 of 250 reviewers')).toBeInTheDocument();
    });
  });

  it('renders no truncation note when the reviewer roster fits in one page', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
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

    await openAssignForm();
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
        // wave 11 (task w11-e): a genuinely dangling submission-scoped row
        // -- submissionId set, but the server's batched label lookup found
        // no matching submission (deleted) so submissionRef/submissionTitle
        // are both null. The "(removed)" label must still render for THIS
        // shape, or the label has lost its meaning (it would only ever
        // fire for tracks, never submissions).
        {
          id: 'pr-removed-submission',
          userId: 'user-45',
          email: 'reviewer4@example.test',
          trackId: null,
          submissionId: '01ARZ3NDEKTSV4RRFFQ69G5FDY',
          trackName: null,
          submissionRef: null,
          submissionTitle: null,
        },
      ]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
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
      expect(screen.getByText('Track · Design')).toBeInTheDocument();
    });
    // Live assignment: real submission ref/title, never "(removed)".
    expect(screen.getByText('SES-014 - Talk Title')).toBeInTheDocument();
    expect(screen.getByText('Track (removed)')).toBeInTheDocument();
    // Genuinely dangling assignment: the label still fires for a
    // submission-scoped row, not just a track-scoped one.
    expect(screen.getByText('Submission (removed)')).toBeInTheDocument();

    // No 26-character ULID anywhere in the rendered reviewer list.
    expect(container.textContent ?? '').not.toMatch(/\b[0-9A-Za-z]{26}\b/);
  });

  // DEC-659 amendment (wave 55): the POST response for a submission-scoped
  // assignment is decorated with the same submissionRef/submissionTitle
  // labels the GET list mapper computes, so the freshly assigned row shows
  // the ref+title immediately -- never "Submission (removed)" /
  // "Track (removed)" before a reload.
  it('shows submissionRef+title for a just-assigned submission-scoped reviewer, never "(removed)"', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'track-1', name: 'Backend' }]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([{ id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 }]),
      [`GET /api/v1/plans/${PLAN_ID}/scope-preview`]: {
        count: 1,
        items: [{ id: 'sub-1', ref: 'SES-014', title: 'Talk Title' }],
        perPage: 200,
      },
      [`POST /api/v1/plans/${PLAN_ID}/reviewers`]: {
        status: 201,
        body: {
          id: 'pr-1',
          userId: 'user-42',
          email: 'reviewer@example.test',
          trackId: null,
          submissionId: 'sub-1',
          trackName: null,
          submissionRef: 'SES-014',
          submissionTitle: 'Talk Title',
        },
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await openAssignForm();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'reviewer@example.test' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Reviewer'), { target: { value: 'user-42' } });
    fireEvent.change(screen.getByLabelText('Assignment scope'), { target: { value: 'submission' } });
    fireEvent.change(screen.getByLabelText('Track'), { target: { value: 'track-1' } });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'SES-014 — Talk Title' })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Submission'), { target: { value: 'sub-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(screen.getByText('SES-014 - Talk Title')).toBeInTheDocument();
    });
    expect(screen.queryByText('Submission (removed)')).not.toBeInTheDocument();
    expect(screen.queryByText('Track (removed)')).not.toBeInTheDocument();
  });

  // DEC-941: removing a reviewer is irreversible (it drops their queue), so
  // the row's Remove button must open the shared ConfirmDialog and only
  // DELETE after an explicit confirm -- never on the first click.
  it('gates reviewer removal behind a confirm dialog naming the reviewer and the consequence', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([
        {
          id: 'pr-1',
          userId: 'user-42',
          email: 'reviewer@example.test',
          trackId: null,
          submissionId: null,
          trackName: null,
          submissionRef: null,
          submissionTitle: null,
        },
      ]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
      [`DELETE /api/v1/plans/${PLAN_ID}/reviewers/pr-1`]: { status: 200, body: {} },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Remove this reviewer?')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /reviewer@example\.test loses their queue on this plan\. Scores they have already submitted stay\./,
      ),
    ).toBeInTheDocument();

    // No DELETE has fired yet -- only the confirm click sends it.
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
      false,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
        true,
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
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
      expect(screen.getByRole('button', { name: 'Create the plan' })).toBeInTheDocument();
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
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
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
      // w5-e: the weight cell prints the number once -- the input already
      // shows it, so the adjacent share text is just the percentage.
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
    expect(screen.getByText('25%')).toBeInTheDocument();
    // w5-e: "Scores average by weight" is now the section rule's own
    // right-aligned eyebrow, never a body sentence.
    expect(screen.getByText('Scores average by weight')).toBeInTheDocument();
    expect(screen.queryByText('Scores average by weight.')).not.toBeInTheDocument();
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
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
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
        screen.getByText('7 of about 7 · more than that and reviewers rush the last ones'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Add criterion' })).toHaveAttribute('aria-disabled', 'true');
  });

  // DEC-676/DEC-213/DEC-709/DEC-882: surfaces the server-side freeze -- a
  // round that already has recorded evaluations renders its criterion rows
  // as READ-ONLY TEXT (never disabled inputs), names the reason and count
  // BELOW the rows, and offers the forward move.
  it('renders a locked criteria row as read-only text, with its reason/count below the rows and the Start-a-new-wave affordance', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [{ id: 'c1', label: 'Content', guidance: 'Judge on merit', kind: 'rating', weight: 1 }],
        evaluationCountsByRound: { '1': 3 },
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
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
      // w5-e: the headline no longer repeats "Locked" -- the section rule's
      // own eyebrow already says it.
      expect(screen.getByText('3 reviews scored against these criteria')).toBeInTheDocument();
    });
    // w5-e/DEC-215 amendment: the reason paragraph gains a second sentence
    // naming the escape hatch (open a new wave).
    expect(
      screen.getByText(
        'Changing these would rescore work already done. To score differently, open a new wave — the reviews already in stay attached to this one.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a new wave' })).toBeInTheDocument();

    // Read-only TEXT, not disabled inputs -- the criterion's name, guidance
    // and raw weight all render as plain text.
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Judge on merit')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Label')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('.chq-review-criterion-row input')).toHaveLength(0);

    // The lock card sits BELOW the read-only rows: the headline appears
    // after the criterion's own name in document order. (The section rule's
    // own eyebrow states the same count EARLIER, above the rows -- use the
    // LAST occurrence, which is the lock-card headline.)
    const text = container.textContent ?? '';
    expect(text.indexOf('Content')).toBeLessThan(text.lastIndexOf('3 reviews scored against these criteria'));
  });

  // w41-f/DEC-882 amendment: the SCORING CRITERIA section rule itself
  // carries a right-aligned eyebrow naming the lock and its count -- read
  // from the SAME evaluationCountsByRound-derived count the lock card
  // below states, never a second fetch. The section caption also gains
  // the wording/weights/scale-fixed sentence while locked.
  it('states the locked eyebrow and caption sentence on the Scoring criteria section rule', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [{ id: 'c1', label: 'Content', kind: 'rating', weight: 1 }],
        evaluationCountsByRound: { '1': 37 },
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
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
      expect(screen.getByText('Locked — 37 reviews scored against these criteria')).toBeInTheDocument();
    });
    // w5-e: "Scores average by weight" moved to the (unlocked-state) eyebrow
    // -- while locked, the caption states only the wording/weights/scale
    // sentence.
    expect(container.querySelector('.chq-review-section-caption')?.textContent).toBe(
      'Wording, weights and the scale are fixed for the rest of this wave.',
    );
  });

  // w41-f: a locked criterion row prints "Weight N · P%" (weight plus its
  // integer-percent share of total weight) instead of the old bare
  // "rating"/raw-weight rendering.
  it('renders a locked rating criterion row as "Weight N · P%"', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [
          { id: 'c1', label: 'Content', kind: 'rating', weight: 3 },
          { id: 'c2', label: 'Delivery', kind: 'rating', weight: 3 },
        ],
        evaluationCountsByRound: { '1': 3 },
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('Weight 3 · 50%')).toHaveLength(2));
  });

  // w41-f/DEC-715: no handle for a locked round's criteria -- the handle is
  // ABSENT, not disabled, since locked criteria cannot reorder.
  it('renders no reorder handle for a locked round\'s criteria', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [{ id: 'c1', label: 'Content', kind: 'rating', weight: 1 }],
        evaluationCountsByRound: { '1': 3 },
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Content')).toBeInTheDocument());
    expect(screen.queryByLabelText(/^Reorder /)).not.toBeInTheDocument();
  });

  // w41-f/DEC-715: an unlocked round's criteria (and a brand-new plan's
  // prefilled criteria) each carry the ONE keyboard-operable drag-handle
  // button, reusing the form-builder's class.
  it('renders a keyboard-operable reorder handle on every criterion row for an unlocked plan', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [
          { id: 'c1', label: 'Content', kind: 'rating', weight: 1 },
          { id: 'c2', label: 'Delivery', kind: 'rating', weight: 1 },
        ],
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByDisplayValue('Content')).toBeInTheDocument());
    const contentHandle = screen.getByLabelText('Reorder Content (position 1 of 2)');
    expect(contentHandle.tagName).toBe('BUTTON');
    expect(contentHandle).toHaveClass('chq-forms-field-drag');
    expect(screen.getByLabelText('Reorder Delivery (position 2 of 2)')).toBeInTheDocument();

    fireEvent.keyDown(contentHandle, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByLabelText('Reorder Delivery (position 1 of 2)')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Reorder Content (position 2 of 2)')).toBeInTheDocument();
  });

  // w41-f/DEC-715: same handle on the brand-new-plan route's prefilled
  // default criteria.
  it('renders reorder handles on a brand-new plan\'s prefilled default criteria', async () => {
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

    await waitFor(() => expect(screen.getByRole('button', { name: 'Create the plan' })).toBeInTheDocument());
    expect(screen.getAllByLabelText(/^Reorder /).length).toBeGreaterThan(0);
  });

  // DEC-709: the new-row kind picker is a segmented control (Rating /
  // Dropdown / Text), never a native <select>.
  it('picks a new criterion kind with a segmented control, not a <select>', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
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

  // --- DEC-745: v4 shell coverage -------------------------------------

  it('renders the plan NAME as an editable title input, and renaming it survives', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    const titleInput = await screen.findByDisplayValue('Track Review');
    expect(titleInput.tagName).toBe('INPUT');
    fireEvent.change(titleInput, { target: { value: 'Renamed Plan' } });
    expect(screen.getByDisplayValue('Renamed Plan')).toBeInTheDocument();
    // The old labelled "Name" field row is gone -- no separate "Name" text.
    expect(screen.queryByText('Name', { selector: 'label' })).not.toBeInTheDocument();
  });

  it('deletes the removed fields: Instructions, Rounds and the track-filter checkboxes', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'track-1', name: 'Backend' }]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument());
    expect(screen.queryByLabelText('Rounds')).not.toBeInTheDocument();
    expect(screen.queryByText('Instructions')).not.toBeInTheDocument();
    expect(screen.queryByText('Track filter')).not.toBeInTheDocument();
    expect(screen.queryByText('Backend', { selector: 'label' })).not.toBeInTheDocument();
    // POST /plans/:id/waves's "Start a new wave" control is a different
    // affordance (only rendered once a round is locked) -- untouched here.
  });

  it('renders the 2x2 field grid captioned "Applies to every criterion in this plan"', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Opens')).toBeInTheDocument());
    expect(screen.getByText('Closes')).toBeInTheDocument();
    expect(screen.getByText('Reviews per talk')).toBeInTheDocument();
    expect(screen.getByText('Rating scale')).toBeInTheDocument();
    expect(screen.getByText('Applies to every criterion in this plan')).toBeInTheDocument();
  });

  it('Duplicate POSTs a new plan carrying dates/scale/criteria/reviews-per-talk and navigates to it, with no new endpoint', async () => {
    const postSpy = vi.fn(() => ({ status: 201, body: { ...plan(), id: 'plan-2', name: 'Track Review (copy)' } }));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        openDate: 1000,
        closeDate: 2000,
        maxEvaluations: 2,
        criteria: [{ id: 'c1', label: 'Content', kind: 'rating', weight: 1 }],
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      [`GET /api/v1/plans/plan-2`]: { ...plan(), id: 'plan-2', name: 'Track Review (copy)' },
      [`GET /api/v1/plans/plan-2/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/plan-2/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/plans`]: postSpy,
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByDisplayValue('Track Review (copy)')).toBeInTheDocument());
  });

  it('renames "Reviewer assignment" to "Who reviews what", with the recusal footnote and an in-section anonymise checkbox', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([
        { id: 'pr-1', userId: 'user-42', email: 'reviewer@example.test', trackId: null, submissionId: null },
      ]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([
        { userId: 'user-42', email: 'reviewer@example.test', name: 'Jamie Rivera', assigned: 6, completed: 2, recused: 0 },
      ]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Who reviews what')).toBeInTheDocument());
    expect(screen.queryByText('Reviewer assignment')).not.toBeInTheDocument();
    // Name over email, and the load count.
    expect(screen.getByText('Jamie Rivera')).toBeInTheDocument();
    expect(screen.getByText('reviewer@example.test')).toBeInTheDocument();
    expect(screen.getByText('6 talks')).toBeInTheDocument();
    expect(screen.getByText('A reviewer never sees a talk they are recused from.')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Anonymize speaker identity for reviewers' }),
    ).toBeInTheDocument();
  });

  it('new-plan route: Cancel + Create the plan on the title row, the "nothing sent" line, and no name error before touch', async () => {
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

    await waitFor(() => expect(screen.getByRole('button', { name: 'Create the plan' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByText('Nothing is sent to reviewers until you open it.')).toBeInTheDocument();
    expect(screen.queryByText('Name is required.')).not.toBeInTheDocument();

    // Touching (blurring) the empty title now surfaces the error.
    const titleInput = screen.getByPlaceholderText('New evaluation plan');
    fireEvent.blur(titleInput);
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
  });

  // DEC-745 (wave-72 amendment): frame 05's persistent row -- CAP PER
  // REVIEWER [8] talks each  [Distribute the unassigned]  N talks · M
  // reviews needed at K each · R reviewers -- renders below the section
  // rule BEFORE any Distribute click, reading its summary off GET
  // /plans/:id/progress's submissionsInScope (never a preview payload), and
  // Distribute is a real button (chq-btn), not a text link.
  it('renders the persistent cap row with its summary before any Distribute click, and Distribute is a real button', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([
        { id: 'pr-1', planId: PLAN_ID, userId: 'u1', email: 'ada@example.test', trackId: null, trackName: null, submissionId: null, submissionRef: null, submissionTitle: null },
      ]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([], { submissionsInScope: 18 }),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Who reviews what')).toBeInTheDocument());
    // 18 submissions in scope x reviewsPerTalk 1 (plan().maxEvaluations is
    // null) = 18 reviews needed, at the one reviewer on the roster --
    // visible with NO click on Distribute.
    expect(await screen.findByText('18 talks · 18 reviews needed at 1 each · 1 reviewer')).toBeInTheDocument();

    const distributeButton = screen.getByRole('button', { name: 'Distribute the unassigned' });
    expect(distributeButton.className).toContain('chq-btn');
    expect(distributeButton.className).not.toContain('chq-link-button');
  });

  it('DEC-840: distribute confirm dialog states the total, each reviewer\'s change, the shortfall sentence naming the constraint and track, and lists an unchanged reviewer with its reason', async () => {
    let distributePosted = false;
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/assignments/distribute/preview`]: {
        cap: null,
        items: [{ submissionId: 's1', userId: 'u1' }],
        perReviewer: [
          { userId: 'u1', name: 'Ada Lovelace', trackName: null, before: 6, after: 8, added: 2, eligible: true, reason: null },
          { userId: 'u2', name: 'Grace Hopper', trackName: 'AI Engineering', before: 3, after: 3, added: 0, eligible: false, reason: 'wrong_track' },
        ],
        totalAssigned: 22,
        shortfall: [
          { submissionId: 's9', ref: 'SES-009', title: 'Talk Nine', trackName: 'AI Engineering', needed: 14, reason: 'cap_reached' },
        ],
      },
      'GET /api/v1/users': listEnvelope([]),
      'POST /api/v1/plans/plan-1/assignments/distribute': () => {
        distributePosted = true;
        return { created: 1 };
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Who reviews what')).toBeInTheDocument());

    // Zero non-GET requests before confirm (DEC-786). The link is renamed
    // (DEC-840): it fills the unassigned pool, it does not level load.
    fireEvent.click(screen.getByRole('button', { name: 'Distribute the unassigned' }));
    // DEC-745 (wave-72 amendment): the summary line now lives ONCE, in the
    // persistent cap row above the section rule -- the confirm dialog no
    // longer repeats it.
    await waitFor(() => expect(screen.getByRole('alertdialog', { name: 'Confirm even distribution' })).toBeInTheDocument());
    expect(distributePosted).toBe(false);

    // Each reviewer's change, unchanged reviewers listed with their reason
    // rather than hidden -- now a name | track | before-after table.
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('All submissions')).toBeInTheDocument();
    expect(screen.getByText('6 → 8 talks')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('AI Engineering')).toBeInTheDocument();
    expect(screen.getByText('unchanged · wrong track')).toBeInTheDocument();

    // The shortfall sentence names the constraint and the track.
    expect(
      screen.getByText('14 reviews stay unassigned — the cap is reached and nobody else covers AI Engineering.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Nothing is saved until you confirm.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Assign these 22' }));
    await waitFor(() => expect(distributePosted).toBe(true));
    // The apply call sends byte-identically the cap the preview echoed.
    const applyCall = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      return url.includes('/assignments/distribute') && !url.includes('/preview');
    });
    expect(applyCall).toBeDefined();
    const applyInit = applyCall?.[1] as RequestInit | undefined;
    expect(JSON.parse(applyInit?.body as string)).toEqual({ cap: null });
  });

  // w51/DEC-840 amendment, retired by DEC-745 wave-72: the confirm
  // dialog's own cap row/summary are gone (they live once, in the
  // persistent row above the section rule) -- the zero case still renders
  // as a bare sentence with no table.
  it('renders the zero case as a bare sentence with no table', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: { ...plan(), maxEvaluations: 2 },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/assignments/distribute/preview`]: {
        cap: 8,
        items: [],
        perReviewer: [],
        totalAssigned: 0,
        shortfall: [],
      },
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Who reviews what')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Distribute the unassigned' }));

    // Zero totalAssigned keeps the bare-sentence zero case, no cap row/table.
    await waitFor(() =>
      expect(
        screen.getByText('Every submission already has enough reviewers -- nothing to distribute.'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  // w52/DEC-840 amendment: totalAssigned === 0 with a non-empty shortfall is
  // a run blocked entirely (cap reached or nobody covers a track) -- the
  // "already has enough" sentence would contradict the shortfall list, so
  // this state gets its own lead sentence plus the full frame-03 anatomy
  // (cap row, summary line, reviewer table) and no primary button.
  it('DEC-840 wave-52: a run blocked entirely renders the blocked lead plus cap row, summary and table -- never the "already has enough" sentence', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/assignments/distribute/preview`]: {
        cap: 5,
        items: [],
        perReviewer: [
          { userId: 'u2', name: 'Grace Hopper', trackName: 'AI Engineering', before: 3, after: 3, added: 0, eligible: false, reason: 'wrong_track' },
        ],
        totalAssigned: 0,
        shortfall: [
          { submissionId: 's9', ref: 'SES-009', title: 'Talk Nine', trackName: 'AI Engineering', needed: 14, reason: 'cap_reached' },
        ],
      },
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Who reviews what')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Distribute the unassigned' }));

    // The blocked lead appears, and the "already has enough" sentence never
    // does -- the shortfall list would contradict it.
    await waitFor(() => expect(screen.getByText("This run can't assign any talks.")).toBeInTheDocument());
    expect(
      screen.queryByText('Every submission already has enough reviewers -- nothing to distribute.'),
    ).not.toBeInTheDocument();

    // DEC-745 (wave-72 amendment): the dialog itself carries only the
    // per-reviewer table now -- the cap row/summary line live once, in the
    // persistent row above the section rule.
    const dialog = screen.getByRole('alertdialog', { name: 'Confirm even distribution' });
    expect(within(dialog).getByRole('table')).toBeInTheDocument();
    expect(within(dialog).getByText('Grace Hopper')).toBeInTheDocument();
    expect(within(dialog).getByText('AI Engineering')).toBeInTheDocument();
    expect(within(dialog).getByText('unchanged · wrong track')).toBeInTheDocument();

    // The shortfall sentence still names the constraint and the track.
    expect(
      screen.getByText('14 reviews stay unassigned — the cap is reached and nobody else covers AI Engineering.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Nothing is saved until you confirm.')).toBeInTheDocument();

    // No primary button: there is nothing to write.
    expect(screen.queryByRole('button', { name: /Assign these/ })).not.toBeInTheDocument();
  });

  // --- DEC-882: criteria table column headers + read-only lock + open-plan header ---

  it('renders the CRITERION / GUIDANCE / WEIGHT column headers above the criteria rows', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [{ id: 'c1', label: 'Content', kind: 'rating', weight: 1 }],
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Criterion')).toBeInTheDocument());
    expect(screen.getByText('Guidance for reviewers · Optional')).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
  });

  // DEC-882: a locked round's criteria render zero form controls -- no
  // <input>/<button>/<select> anywhere inside the criterion rows.
  it('renders zero form controls for a locked round\'s criteria', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [
          { id: 'c1', label: 'Content', kind: 'rating', weight: 1 },
          { id: 'c2', label: 'Format', kind: 'dropdown', options: ['Talk', 'Workshop'] },
        ],
        evaluationCountsByRound: { '1': 5 },
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    const { container } = render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Content')).toBeInTheDocument());
    expect(screen.getByText('Format')).toBeInTheDocument();
    const rows = container.querySelectorAll('.chq-review-criterion-row');
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.querySelectorAll('input, button, select, textarea')).toHaveLength(0);
    }
  });

  // DEC-882: the open-plan header states both numbers from the plan's own
  // progress aggregate (progressRows via progressTotals) -- never a second
  // count derived in the component.
  it('states "Open · N of M reviews in" from the progress aggregate for an open plan', async () => {
    const now = Date.now();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        openDate: now - 86_400_000,
        closeDate: now + 86_400_000,
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([
        { userId: 'user-1', email: 'a@example.test', name: null, assigned: 6, completed: 2, recused: 0 },
        { userId: 'user-2', email: 'b@example.test', name: null, assigned: 4, completed: 1, recused: 0 },
      ]),
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
      expect(screen.getByText('Open · 3 of 10 reviews in')).toBeInTheDocument();
    });
  });

  it('renders no open-plan status line for a plan that has not opened yet', async () => {
    const now = Date.now();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        openDate: now + 86_400_000,
        closeDate: now + 172_800_000,
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument());
    expect(screen.queryByText(/^Open ·/)).not.toBeInTheDocument();
  });

  // DEC-929: plan deletion names what it destroys -- Delete plan fetches the
  // preview before opening the confirm dialog, and the dialog body prints
  // the tallied counts in prose.
  it('Delete plan fetches the delete-preview and states the submitted-review count in the confirm dialog body', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/delete-preview`]: {
        planId: PLAN_ID,
        name: 'Track Review',
        counts: { reviewers: 2, evaluationsSubmitted: 5, evaluationsDraft: 1, recusals: 3 },
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete plan' }));

    await waitFor(() => {
      expect(screen.getByText(/5 submitted evaluation/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 draft evaluation/)).toBeInTheDocument();
    expect(screen.getByText(/2 reviewer/)).toBeInTheDocument();
    expect(screen.getByText(/3 recusal/)).toBeInTheDocument();
    expect(screen.getByText(/results table and CSV export go with it/)).toBeInTheDocument();
  });

  // wave 49/DEC-745 amendment: dirty-state navigation guard -- FIELDS
  // (including anonymize) stay drafted behind Save; leaving with an
  // unsaved draft must confirm rather than silently discard it.
  describe('dirty-state navigation guard (DEC-745 wave-49 amendment)', () => {
    it('toggling anonymize then leaving via the back-link surfaces a confirm naming the unsaved field; Cancel keeps the draft', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}`]: {
          ...plan(),
          criteria: [{ id: 'c1', label: 'Content', kind: 'rating', weight: 1 }],
        },
        [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
        'GET /api/v1/users': listEnvelope([]),
      });

      render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
          <Routes>
            <Route path="/review/plans/:planId" element={<PlanEditor />} />
            <Route path="/review" element={<div>Review list page</div>} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('checkbox', { name: 'Anonymize speaker identity for reviewers' }));

      fireEvent.click(screen.getByRole('link', { name: '‹ Review' }));

      expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
      expect(screen.getByText('Anonymize is not saved yet.')).toBeInTheDocument();
      // Still on the editor -- the Link's default navigation was blocked.
      expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument();

      // Cancel ("Keep editing") keeps the draft and stays on the page.
      fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
      expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: 'Anonymize speaker identity for reviewers' }),
      ).toBeChecked();

      // Leaving again and confirming actually navigates away.
      fireEvent.click(screen.getByRole('link', { name: '‹ Review' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));
      expect(await screen.findByText('Review list page')).toBeInTheDocument();
    });

    it('after Save the editor is clean and the back-link leaves with no confirm', async () => {
      const patchSpy = vi.fn(() => plan({ name: 'Track Review' }));
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}`]: {
          ...plan(),
          criteria: [{ id: 'c1', label: 'Content', kind: 'rating', weight: 1 }],
        },
        [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
        'GET /api/v1/users': listEnvelope([]),
        [`PATCH /api/v1/plans/${PLAN_ID}`]: patchSpy,
      });

      render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
          <Routes>
            <Route path="/review/plans/:planId" element={<PlanEditor />} />
            <Route path="/review" element={<div>Review list page</div>} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument());
      fireEvent.change(screen.getByDisplayValue('Track Review'), { target: { value: 'Renamed Plan' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole('link', { name: '‹ Review' }));
      expect(await screen.findByText('Review list page')).toBeInTheDocument();
      expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument();
    });

    it('DEC-799: anonymize true->false surfaces the ratchet confirm at Save, not at click', async () => {
      const patchSpy = vi.fn(() => plan({ anonymized: false }));
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}`]: {
          ...plan({ anonymized: true }),
          criteria: [{ id: 'c1', label: 'Content', kind: 'rating', weight: 1 }],
        },
        [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
        'GET /api/v1/users': listEnvelope([]),
        [`PATCH /api/v1/plans/${PLAN_ID}`]: patchSpy,
      });

      render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
          <Routes>
            <Route path="/review/plans/:planId" element={<PlanEditor />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument());
      const checkbox = screen.getByRole('checkbox', { name: 'Anonymize speaker identity for reviewers' });
      expect(checkbox).toBeChecked();

      // Unchecking the box drafts the change -- no confirm and no request yet.
      fireEvent.click(checkbox);
      expect(screen.queryByText('Turn off anonymity?')).not.toBeInTheDocument();
      expect(patchSpy).not.toHaveBeenCalled();

      // The ratchet confirm fires at Save time.
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText('Turn off anonymity?')).toBeInTheDocument();
      expect(patchSpy).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Turn off anonymity' }));
      await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
    });

    // w5-e/DEC-745 amendment: GLOBAL-NAV exits (the chrome nav's Review
    // link) must confirm too -- requestLeave is now registered as the
    // shared leave-guard App.tsx's NavLinks consults via guardedNavigate
    // before every chrome nav-link navigation, not just this page's own
    // back-link/Cancel controls.
    it('registers the shared leave-guard while dirty, so a GLOBAL-NAV exit (guardedNavigate) raises the same confirm', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
        [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
        'GET /api/v1/users': listEnvelope([]),
      });

      render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
          <Routes>
            <Route path="/review/plans/:planId" element={<PlanEditor />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument());
      fireEvent.change(screen.getByDisplayValue('Track Review'), { target: { value: 'Renamed Plan' } });

      // Simulates App.tsx's chrome NavLink onClick, which routes every
      // nav-link navigation through guardedNavigate rather than navigating
      // straight away.
      const proceed = vi.fn();
      guardedNavigate(proceed);

      expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
      expect(proceed).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
      await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1));
    });

    it('a clean (non-dirty) editor lets guardedNavigate proceed with no confirm', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
        [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
        'GET /api/v1/users': listEnvelope([]),
      });

      render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
          <Routes>
            <Route path="/review/plans/:planId" element={<PlanEditor />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument());

      const proceed = vi.fn();
      guardedNavigate(proceed);
      expect(proceed).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument();
    });
  });

  // --- w5-e: frame 05/07/08 residue -------------------------------------

  it('renders "Scores average by weight" as a right-aligned uppercase eyebrow on the section rule, not a body sentence', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByDisplayValue('Track Review')).toBeInTheDocument());
    const eyebrow = screen.getByText('Scores average by weight');
    expect(eyebrow.className).toContain('chq-review-criteria-eyebrow');
    expect(eyebrow.closest('.chq-section-head')).not.toBeNull();
    expect(screen.queryByText('Scores average by weight.')).not.toBeInTheDocument();
  });

  it('drops the rating/dropdown KIND column between GUIDANCE and WEIGHT', async () => {
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
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    const { container } = render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByDisplayValue('Content')).toBeInTheDocument());
    // No standalone "rating"/"dropdown" kind cell renders anywhere.
    expect(container.querySelector('.chq-review-criterion-kind')).toBeNull();
    expect(screen.queryByText('rating')).not.toBeInTheDocument();
    // Frame form: the weight cell prints the number once (the input) plus
    // its share -- never the duplicated "N · P%" text.
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.queryByText(/^3 · 75%$/)).not.toBeInTheDocument();
  });

  it('renders the per-reviewer Reset password and the Delete plan controls as quiet section-rule links, not framed buttons', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([
        { id: 'pr-1', userId: 'user-42', email: 'reviewer@example.test', trackId: null, submissionId: null },
      ]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    const resetLink = await screen.findByRole('button', { name: 'Reset password' });
    expect(resetLink.className).toContain('chq-link-button');
    expect(resetLink.className).not.toContain('chq-btn ');
    expect(resetLink.className).not.toContain('chq-btn-secondary');

    const deleteLink = screen.getByRole('button', { name: 'Delete plan' });
    expect(deleteLink.className).toContain('chq-link-button');
    expect(deleteLink.className).not.toContain('chq-btn-tertiary');
    // Delete plan sits on the "Who reviews what" section rule now, not a
    // standalone footer band.
    expect(deleteLink.closest('.chq-section-head')).not.toBeNull();
  });

  // w18-e/DEC-715 amendment: an editable criterion row renders five
  // non-error children (drag handle, label input, guidance input, kind
  // cell, Remove button) -- .chq-review-criterion-row's grid must declare
  // at least that many explicit tracks, or Remove wraps to an implicit
  // second row.
  it('declares at least as many grid tracks as an editable criterion row has non-error children', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [{ id: 'c1', label: 'Content', kind: 'rating', weight: 1 }],
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    const { container } = render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByDisplayValue('Content')).toBeInTheDocument(),
    );
    const row = container.querySelector('.chq-review-criterion-row') as HTMLElement;
    expect(row).not.toBeNull();
    const nonErrorChildren = Array.from(row.children).filter(
      (child) => !child.classList.contains('chq-review-field-error'),
    );
    expect(nonErrorChildren.length).toBe(5);

    const ruleMatch = REVIEW_CSS.match(
      /\.chq-review-criterion-row,\s*\n\.chq-review-criteria-head-row\s*\{\s*\n\s*grid-template-columns:\s*([^;]+);/,
    );
    expect(ruleMatch).not.toBeNull();
    const trackCount = (ruleMatch![1] as string)
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 0).length;
    expect(trackCount).toBeGreaterThanOrEqual(nonErrorChildren.length);
  });

  // w18-e/DEC-715 amendment: a validation-error span is a direct child of
  // the row (so it can be scoped by review.css to span the full row width,
  // not displace the controls after it into a phantom column).
  it('renders a validation error span as a direct child of the criterion row, scoped to span the full row', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        ...plan(),
        criteria: [{ id: 'c1', label: '', kind: 'rating', weight: 1 }],
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
    });

    const { container } = render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText('Criterion label is required.')).toBeInTheDocument(),
    );
    const row = container.querySelector('.chq-review-criterion-row') as HTMLElement;
    const errorSpan = row.querySelector('.chq-review-field-error') as HTMLElement;
    expect(errorSpan).not.toBeNull();
    expect(errorSpan.parentElement).toBe(row);

    expect(REVIEW_CSS).toContain('.chq-review-criterion-row > .chq-review-field-error');
    expect(REVIEW_CSS).toMatch(
      /\.chq-review-criterion-row > \.chq-review-field-error\s*\{\s*\n\s*grid-column:\s*1\s*\/\s*-1;/,
    );
  });

  // w18-e/DEC-745 amendment: "Distribute the unassigned" is preview-then-
  // confirm (DEC-786) -- the section caption must not claim it applies
  // immediately, while the distribute preview's own "nothing is saved
  // until you confirm" copy still renders once opened.
  it('states only "Assign a reviewer applies immediately" on the section caption, not that Distribute does too', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([
        { id: 'pr-1', userId: 'user-42', email: 'reviewer@example.test', trackId: null, submissionId: null },
      ]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/assignments/distribute/preview`]: {
        cap: null,
        items: [],
        perReviewer: [
          { userId: 'user-42', name: 'Ada Lovelace', trackName: null, before: 0, after: 3, added: 3, eligible: true, reason: null },
        ],
        totalAssigned: 3,
        shortfall: [],
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    const caption = await screen.findByText('Assign a reviewer applies immediately.');
    expect(caption.textContent).toBe('Assign a reviewer applies immediately.');
    expect(caption.textContent).not.toMatch(/Distribute/);

    fireEvent.click(screen.getByRole('button', { name: 'Distribute the unassigned' }));
    expect(await screen.findByText('Nothing is saved until you confirm.')).toBeInTheDocument();
  });
});
