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

    // DEC-939: the scorecard clamps to the product measure like every
    // other single-column surface.
    expect(document.querySelector('.chq-page')).toHaveClass('chq-measure');

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

    // DEC-889: the answer lists live behind the disclosure -- collapsed by
    // default, they don't render at all until the reviewer opts in.
    expect(screen.queryByText('Talk length')).not.toBeInTheDocument();
    expect(screen.queryByText('45 minutes')).not.toBeInTheDocument();
    expect(screen.queryByText('AV needs')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Speaker answers' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Read the full submission ›' }));

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

// DEC-889: the abstract clamps to its first ~60 words and a single
// disclosure -- not a second copy of the submission detail -- owns both
// the clamped remainder and the two answer lists.
describe('Scorecard abstract clamp and disclosure (DEC-889)', () => {
  function longDescription(wordCount: number) {
    return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(' ');
  }

  it('collapsed default renders the clamped abstract exactly once and neither answer list', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        description: longDescription(90),
        sessionAnswers: [{ fieldId: 'f1', label: 'Talk length', kind: 'dropdown', value: '45 minutes' }],
        speakerAnswers: [{ fieldId: 'f3', label: 'Bio', kind: 'text', value: 'Mathematician and writer.' }],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
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

    // The abstract renders exactly once, clamped to the first 60 words
    // with a trailing ellipsis -- word60 is the first word cut.
    const abstracts = document.querySelectorAll('.chq-review-scorecard-abstract');
    expect(abstracts).toHaveLength(1);
    const abstractText = abstracts[0]!.textContent ?? '';
    expect(abstractText).toContain('word59');
    expect(abstractText).not.toContain('word60');
    expect(abstractText.endsWith('…')).toBe(true);
    expect(document.body.textContent).not.toContain(longDescription(90));

    // Neither answer list renders before the disclosure is activated.
    expect(screen.queryByText('Talk length')).not.toBeInTheDocument();
    expect(screen.queryByText('Bio')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Submission answers' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Speaker answers' })).not.toBeInTheDocument();

    const disclosure = screen.getByRole('button', { name: 'Read the full submission ›' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  });

  it('activating the disclosure reveals the abstract remainder and both answer lists', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        description: longDescription(90),
        sessionAnswers: [{ fieldId: 'f1', label: 'Talk length', kind: 'dropdown', value: '45 minutes' }],
        speakerAnswers: [{ fieldId: 'f3', label: 'Bio', kind: 'text', value: 'Mathematician and writer.' }],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
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

    fireEvent.click(screen.getByRole('button', { name: 'Read the full submission ›' }));

    expect(screen.getByRole('button', { name: 'Hide the full submission ‹' })).toHaveAttribute('aria-expanded', 'true');
    // The remainder (word60 onward) is now visible.
    expect(document.body.textContent).toContain('word89');
    expect(screen.getByText('Talk length')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Submission answers' })).toBeInTheDocument();
    expect(screen.getByText('Bio')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Speaker answers' })).toBeInTheDocument();
  });

  it('a short abstract renders no clamp ellipsis but still hides the answer lists behind the disclosure', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        description: 'A short abstract about testing scorecards.',
        sessionAnswers: [{ fieldId: 'f1', label: 'Talk length', kind: 'dropdown', value: '45 minutes' }],
        speakerAnswers: [],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
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

    const abstract = document.querySelector('.chq-review-scorecard-abstract')!;
    expect(abstract.textContent).toBe('A short abstract about testing scorecards.');
    expect(abstract.textContent?.endsWith('…')).toBe(false);

    // The disclosure still owns the (non-empty) answer list -- hidden by
    // default even though the abstract itself didn't clamp.
    expect(screen.queryByText('Talk length')).not.toBeInTheDocument();
    const disclosure = screen.getByRole('button', { name: 'Read the full submission ›' });
    fireEvent.click(disclosure);
    expect(screen.getByText('Talk length')).toBeInTheDocument();
  });
});

// DEC-939: the recusal block moves below the work (Comment field) and
// above the actions; the conflict control is a real checkbox that reveals
// the optional reason field only once checked.
describe('Scorecard recusal placement and checkbox reveal (DEC-939)', () => {
  it('renders the recusal block after Comment and before the editor actions, with the reason field hidden until checked', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
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

    const root = document.querySelector('.chq-page')!;
    const commentField = screen.getByText('Comment to the committee').closest('label')!;
    const recusalBlock = document.querySelector('.chq-review-recusal')!;
    const actions = document.querySelector('.chq-review-editor-actions')!;
    const children = Array.from(root.children);
    const commentIndex = children.indexOf(commentField);
    const recusalIndex = children.indexOf(recusalBlock);
    const actionsIndex = children.indexOf(actions);
    expect(commentIndex).toBeGreaterThanOrEqual(0);
    expect(recusalIndex).toBeGreaterThan(commentIndex);
    expect(actionsIndex).toBeGreaterThan(recusalIndex);

    // DEC-939 (bare recusal amendment): the control is a bare checkbox with
    // no sibling button and no reason field -- nothing to reveal.
    const checkbox = screen.getByRole('checkbox', { name: /conflict of interest/i });
    expect(checkbox).toBeInstanceOf(HTMLInputElement);
    expect((checkbox as HTMLInputElement).type).toBe('checkbox');
    expect(screen.queryByPlaceholderText('Reason (optional)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /declare conflict of interest/i })).not.toBeInTheDocument();
    expect(recusalBlock.querySelector('button')).toBeNull();
  });

  it('rating group segment count matches the plan scale, without aria-pressed (DEC-939)', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
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

    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality' });
    const buttons = within(qualityGroup).getAllByRole('radio');
    expect(buttons).toHaveLength(5);
    buttons.forEach((b) => expect(b).not.toHaveAttribute('aria-pressed'));

    const root = document.querySelector('.chq-page') as HTMLElement;
    expect(root.style.getPropertyValue('--chq-review-scale-steps')).toBe('5');
  });
});

// DEC-984: a recusal must survive a reload -- the recused branch renders
// straight off the fetched detail's `myRecusal`, never only after a
// client-side POST.
describe('Scorecard recusal survives reload (DEC-984)', () => {
  it('renders the recused branch on first paint from a fetched detail carrying myRecusal, with no POST', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        myRecusal: { reason: 'Co-author on this submission', createdAt: 1700000000000 },
        criteria: [
          { id: 'c1', label: 'Quality', kind: 'rating', weight: 1 },
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

    expect(await screen.findByText('You recused yourself from this submission.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /conflict of interest/i })).not.toBeInTheDocument();

    // Every rating/dropdown control and both action buttons are disabled.
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality' });
    within(qualityGroup).getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit and next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    // No client-side POST was made to establish this -- it rendered straight
    // off the GET response.
    const postCalls = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });
});

// w41-e (DEC-939 amendment): reconciliation line, header progress counter,
// committee-facing comment label, bare recusal control.
describe('Scorecard reconciliation line (DEC-939)', () => {
  function criteria() {
    return [
      { id: 'c1', label: 'Quality', kind: 'rating' as const, weight: 1 },
      { id: 'c2', label: 'Originality', kind: 'rating' as const, weight: 1 },
      { id: 'c3', label: 'Delivery', kind: 'rating' as const, weight: 1 },
    ];
  }

  it('is absent while the submission is unscored', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
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

    expect(await screen.findByRole('heading', { name: 'S-010 — A Deeply Nested Talk' })).toBeInTheDocument();
    expect(document.querySelector('.chq-review-overall-reconciliation')).toBeNull();
  });

  it('prints the unweighted mean of a 5, 4, 4 rating set once every criterion is scored', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
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

    expect(await screen.findByRole('heading', { name: 'S-010 — A Deeply Nested Talk' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Quality' })).getByRole('radio', { name: '5' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Originality' })).getByRole('radio', { name: '4' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Delivery' })).getByRole('radio', { name: '4' }));

    await waitFor(() =>
      expect(document.querySelector('.chq-review-overall-reconciliation')?.textContent).toBe(
        'A plain average of 5, 4, 4 would be 4.33',
      ),
    );
  });
});

describe('Scorecard header progress counter (DEC-939)', () => {
  it('renders the same N of N done figure the reviewer queue computes', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
      },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: listEnvelope([
        { submissionId: 'sub-a', ref: 'S-001', title: 'Rated', ratingsCount: 1, alreadyRatedByMe: true, myScore: 4, format: null },
        { submissionId: 'sub-b', ref: 'S-002', title: 'Unrated', ratingsCount: 0, alreadyRatedByMe: false, myScore: null, format: null },
        { submissionId: 'sub-c', ref: 'S-003', title: 'Also rated', ratingsCount: 1, alreadyRatedByMe: true, myScore: 5, format: null },
      ]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'S-010 — A Deeply Nested Talk' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('2 of 3 done')).toBeInTheDocument());
  });

  it('renders nothing when the queue fetch cannot be resolved', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
      },
      // No queue route registered -- the independent fetch rejects and the
      // counter must render nothing rather than a fabricated figure.
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'S-010 — A Deeply Nested Talk' })).toBeInTheDocument();
    expect(screen.queryByText(/of .* done/)).not.toBeInTheDocument();
  });
});

describe('Scorecard comment label (frame 03--01)', () => {
  it('labels the comment field for the committee', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
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
    expect(screen.getByText('Comment to the committee')).toBeInTheDocument();
    expect(screen.queryByText('Comment', { exact: true })).not.toBeInTheDocument();
  });
});
