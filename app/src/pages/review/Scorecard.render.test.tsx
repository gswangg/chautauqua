// DEC-144 layer-2 harness, DEC-147/DEC-148 regression: mounts Scorecard with
// a submission whose resolved criteria (GET /review/submissions/:id's
// `criteria` field -- criteriaForRound's per-round resolution) include all
// three criterion kinds (rating, dropdown, free-text), asserting each
// control renders. DEC-148: text criteria must render alongside
// rating/dropdown without participating in the weighted math -- covered
// here only as a render assertion, not a re-derivation of criteriaForRound
// itself.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Scorecard } from './Scorecard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const PLAN_ID = 'plan-scorecard-1';
const SUBMISSION_ID = 'sub-scorecard-1';

function plan() {
  return {
    id: PLAN_ID,
    eventId: 'evt-1',
    name: 'Track Review',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
    rounds: 2,
    currentRound: 2,
    // DEC-147: round 2 overrides the base criteria with all three kinds.
    roundCriteria: {
      '2': [
        { id: 'c1', label: 'Quality', kind: 'rating', weight: 1 },
        { id: 'c2', label: 'Fit', kind: 'dropdown', options: ['Poor', 'OK', 'Great'] },
        { id: 'c3', label: 'Notes', kind: 'text', required: false },
      ],
    },
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

describe('Scorecard render smoke', () => {
  it('renders rating, dropdown, and free-text criteria from the round-resolved criteria list', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        description: 'A talk about testing scorecards.',
        speakers: [{ contactId: 'c1', name: 'Ada Lovelace', company: 'Analytical Engines', title: 'Founder' }],
        sessionAnswers: [
          { fieldId: 'f1', label: 'Talk length', kind: 'dropdown', value: '45 minutes' },
          { fieldId: 'f2', label: 'AV needs', kind: 'text', value: null },
        ],
        speakerAnswers: [{ fieldId: 'f3', label: 'Bio', kind: 'text', value: 'Mathematician and writer.' }],
        myEvaluation: undefined,
        // Server-resolved via criteriaForRound for the plan's active round.
        criteria: [
          { id: 'c1', label: 'Quality', kind: 'rating', weight: 1 },
          { id: 'c2', label: 'Fit', kind: 'dropdown', options: ['Poor', 'OK', 'Great'] },
          { id: 'c3', label: 'Notes', kind: 'text', required: false },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'S-010 — A Deeply Nested Talk' })).toBeInTheDocument();

    // rating criterion -> segmented radiogroup, one radio per scale value
    // (DEC-873: plan.scale is {min:1, max:5}).
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality' });
    const qualityRadios = within(qualityGroup).getAllByRole('radio');
    expect(qualityRadios).toHaveLength(5);
    expect(qualityRadios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);

    // dropdown criterion -> select with its options
    expect(screen.getByRole('option', { name: 'Great' })).toBeInTheDocument();

    // free-text criterion -> textarea
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');

    // sessionAnswers render as label + formatted value, in delivered order.
    expect(screen.getByText('Talk length')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.getByText('AV needs')).toBeInTheDocument();
    // The em dash appears twice: the null AV-needs answer, and the
    // un-scored Overall block (DEC-873) -- assert at least one exists
    // rather than a single unique match.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);

    // speakerAnswers render under their own heading.
    expect(screen.getByRole('heading', { name: 'Speaker answers' })).toBeInTheDocument();
    expect(screen.getByText('Bio')).toBeInTheDocument();
    expect(screen.getByText('Mathematician and writer.')).toBeInTheDocument();

    // DEC-561 regression bar: no rendered surface may contain "undefined"
    // or the shape of an un-stringified object.
    expect(document.body.textContent).not.toContain('undefined');
    expect(document.body.textContent).not.toContain('[object Object]');
  });

  // DEC-676: each criterion's guidance renders under its label; nothing
  // renders for a criterion that has none.
  it('renders criterion guidance under the label, and nothing when absent', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [
          { id: 'c1', label: 'Quality', kind: 'rating', weight: 1, guidance: 'Rate the depth of the argument.' },
          { id: 'c2', label: 'Fit', kind: 'dropdown', options: ['Poor', 'OK', 'Great'] },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Rate the depth of the argument.')).toBeInTheDocument();
    // 'Fit' has no guidance -- nothing renders for it beyond its label.
    const fitRow = screen.getByText('Fit').closest('div')!;
    expect(fitRow.querySelector('.chq-review-criterion-guidance')).toBeNull();
  });

  // DEC-873: (1) rating buttons cover [scale.min, scale.max] with
  // aria-checked on the chosen one; (2) the weight caption reads
  // criterionWeightShares; (3) Overall renders an em dash until every
  // rating criterion is scored, then the computed blend; (4) Save PUTs and
  // stays on the page.
  it('renders the scale-bound rating control, weight caption, and overall blend; Save does not navigate', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [
          { id: 'c1', label: 'Quality', kind: 'rating', weight: 3 },
          { id: 'c2', label: 'Depth', kind: 'rating', weight: 1 },
          { id: 'c3', label: 'Fit', kind: 'dropdown', options: ['Poor', 'OK', 'Great'] },
        ],
      },
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: { ok: true },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'S-010 — A Deeply Nested Talk' })).toBeInTheDocument();

    // Weight caption: 3 and 1 share a total weight of 4 -> 75% / 25%.
    expect(screen.getByText('Weight 3 · 75%')).toBeInTheDocument();
    expect(screen.getByText('Weight 1 · 25%')).toBeInTheDocument();
    // 'Fit' (dropdown, no weight) prints no weight caption.
    const fitRow = screen.getByText('Fit').closest('div')!;
    expect(fitRow.querySelector('.chq-review-criterion-weight-caption')).toBeNull();

    // Overall renders an em dash before every rating criterion is scored.
    expect(screen.getByText('Overall')).toBeInTheDocument();
    expect(screen.getByText('Averaged by weight · not editable')).toBeInTheDocument();
    const overallValue = () => document.querySelector('.chq-review-overall-value')!;
    expect(overallValue().textContent).toBe('—');

    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality' });
    const depthGroup = screen.getByRole('radiogroup', { name: 'Depth' });
    fireEvent.click(within(qualityGroup).getByRole('radio', { name: '4' }));
    expect(within(qualityGroup).getByRole('radio', { name: '4' })).toHaveAttribute('aria-checked', 'true');

    // Still incomplete (Depth unscored, Fit unset) -> still an em dash.
    expect(overallValue().textContent).toBe('—');

    fireEvent.click(within(depthGroup).getByRole('radio', { name: '2' }));
    fireEvent.change(screen.getByRole('option', { name: 'Great' }).closest('select')!, { target: { value: 'Great' } });

    // Complete -> (4*3 + 2*1) / 4 = 3.5.
    await waitFor(() => expect(overallValue().textContent).toBe('3.5'));

    // Save PUTs the same body and stays on the page (no navigation away).
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`),
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(await screen.findByRole('heading', { name: 'S-010 — A Deeply Nested Talk' })).toBeInTheDocument();
  });
});
