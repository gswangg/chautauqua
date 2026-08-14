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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();

    // DEC-939 (wave-65 amendment): the loaded scorecard is a two-column
    // work surface -- it clamps at the wide measure, not the single-column
    // reading measure (the loading/error branches keep that one).
    expect(document.querySelector('.chq-page')).toHaveClass('chq-measure-wide');

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

    // DEC-889 (wave-72 amendment): the FORM ANSWERS block is at rest, not
    // behind a disclosure -- session and speaker answers render immediately.
    expect(screen.getByRole('heading', { name: 'Form answers' })).toBeInTheDocument();
    expect(screen.getByText('Talk length')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.getByText('AV needs')).toBeInTheDocument();
    // The em dash appears twice: the null AV-needs answer, and the
    // un-scored Overall block (DEC-873) -- assert at least one exists
    // rather than a single unique match.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);

    // speakerAnswers render in the same block, at rest.
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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();

    // Weight caption: 3 and 1 share a total weight of 4 -> 75% / 25%.
    expect(screen.getByText('Weight 3 · 75%')).toBeInTheDocument();
    expect(screen.getByText('Weight 1 · 25%')).toBeInTheDocument();
    // 'Fit' (dropdown, no weight) prints no weight caption.
    const fitRow = screen.getByText('Fit').closest('div')!;
    expect(fitRow.querySelector('.chq-review-criterion-weight-caption')).toBeNull();

    // Overall renders an em dash before every rating criterion is scored;
    // frame 03--01: caption + reconciliation merge into one sentence, and
    // before every rating criterion is scored that sentence is just the
    // caption (no reconciliation clause to append yet).
    expect(screen.getByText('Overall')).toBeInTheDocument();
    expect(screen.getByText('Averaged by weight, not editable')).toBeInTheDocument();
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
    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
  });
});

// DEC-889 (wave-72 amendment): the reading column IS the frame's body --
// the full abstract under an ABSTRACT eyebrow, and the session/speaker
// answers as a FORM ANSWERS block of label|value rows, at rest (no clamp,
// no disclosure).
describe('Scorecard reading column at rest (DEC-889 wave-72 amendment)', () => {
  function longDescription(wordCount: number) {
    return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(' ');
  }

  it('renders the full, un-clamped abstract under an ABSTRACT eyebrow, with no disclosure control', async () => {
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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();

    // The abstract renders exactly once, in full -- no 60-word clamp, no
    // trailing ellipsis, word89 (the last word) is present.
    const abstracts = document.querySelectorAll('.chq-review-scorecard-abstract');
    expect(abstracts).toHaveLength(1);
    const abstractText = abstracts[0]!.textContent ?? '';
    expect(abstractText).toContain('word0');
    expect(abstractText).toContain('word89');
    expect(abstractText.endsWith('…')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Abstract' })).toBeInTheDocument();

    // No disclosure control survives -- the answer lists are already
    // rendered, at rest.
    expect(screen.queryByRole('button', { name: /read the full submission/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Form answers' })).toBeInTheDocument();
    expect(screen.getByText('Talk length')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.getByText('Bio')).toBeInTheDocument();
    expect(screen.getByText('Mathematician and writer.')).toBeInTheDocument();
  });

  it('prints the anonymised-plan notice when plan.anonymized is true, and omits it otherwise', async () => {
    const anonPlan = { ...plan(), anonymized: true };
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([anonPlan]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        description: 'An abstract.',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
        // Server-side anonymizeForReviewer strips speakers/speakerAnswers
        // entirely -- no key at all -- for an anonymised plan.
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    expect(
      screen.getByText("The speaker's name and company are hidden while this plan is anonymised"),
    ).toBeInTheDocument();
  });

  it('omits the anonymised-plan notice when the plan is not anonymised', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        description: 'An abstract.',
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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    expect(screen.queryByText(/hidden while this plan is anonymised/)).not.toBeInTheDocument();
  });

  it('the rail actions render full-width stacked, primary over secondary, with the secondary labelled Save (DEC-873)', async () => {
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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    expect(screen.queryByText('Save draft')).not.toBeInTheDocument();
    const actions = document.querySelector('.chq-review-editor-actions')!;
    const buttons = Array.from(actions.querySelectorAll('button'));
    expect(buttons[0]).toHaveTextContent('Submit and next');
    expect(buttons[0]).toHaveClass('chq-btn-primary');
    expect(buttons[1]).toHaveTextContent('Save');
    expect(buttons[1]).toHaveClass('chq-btn-secondary');
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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();

    // DEC-939 (wave-65 amendment): Comment, the recusal declaration, and
    // the editor actions all now live inside the scoring rail (aside),
    // not as direct children of the page root -- the ordering contract
    // still holds, just scoped to the rail.
    const rail = document.querySelector('.chq-review-scorecard-rail')!;
    const commentField = screen.getByText('Comment to the committee').closest('label')!;
    const recusalBlock = document.querySelector('.chq-review-recusal')!;
    const actions = document.querySelector('.chq-review-editor-actions')!;
    expect(rail.contains(commentField)).toBe(true);
    expect(rail.contains(recusalBlock)).toBe(true);
    expect(rail.contains(actions)).toBe(true);
    const children = Array.from(rail.children);
    const commentIndex = children.indexOf(commentField);
    const recusalIndex = children.indexOf(recusalBlock);
    const actionsIndex = children.indexOf(actions);
    expect(commentIndex).toBeGreaterThanOrEqual(0);
    expect(recusalIndex).toBeGreaterThan(commentIndex);
    expect(actionsIndex).toBeGreaterThan(recusalIndex);

    // DEC-939 (bare recusal amendment): the control is a bare checkbox with
    // no sibling button and no reason field -- nothing to reveal.
    const checkbox = screen.getByRole('checkbox', { name: /recuse me/i });
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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();

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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    // frame 03--01: the caption and the reconciliation clause are one
    // merged sentence now -- unscored means the caption alone, with no
    // reconciliation clause appended.
    expect(document.querySelector('.chq-review-overall-caption')!.textContent).toBe('Averaged by weight, not editable');
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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Quality' })).getByRole('radio', { name: '5' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Originality' })).getByRole('radio', { name: '4' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Delivery' })).getByRole('radio', { name: '4' }));

    await waitFor(() =>
      expect(document.querySelector('.chq-review-overall-caption')?.textContent).toBe(
        'Averaged by weight, not editable — a plain average of 5, 4, 4 would be 4.33',
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

    // frame 03--01: the counter leaves the reading column and portals into
    // App's own #chq-header-slot node -- simulate that node's presence the
    // way App.tsx renders it, since Scorecard is mounted alone here (no
    // App shell).
    const headerSlot = document.createElement('div');
    headerSlot.id = 'chq-header-slot';
    document.body.appendChild(headerSlot);

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    await waitFor(() => expect(within(headerSlot).getByText('2 of 3 done')).toBeInTheDocument());
    headerSlot.remove();
  });

  it('renders nothing when mounted with no #chq-header-slot node in the document', async () => {
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
      ]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    expect(document.getElementById('chq-header-slot')).toBeNull();
    expect(screen.queryByText(/of .* done/)).not.toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    expect(screen.getByText('Comment to the committee')).toBeInTheDocument();
    expect(screen.queryByText('Comment', { exact: true })).not.toBeInTheDocument();
  });
});

// DEC-939 (wave-65 amendment): the two-column work surface (frame 03--01)
// and the focus ring gated to keyboard use only.
describe('Scorecard two-column work surface and armed focus ring (DEC-939 wave-65 amendment)', () => {
  function twoCriteria() {
    return [
      { id: 'c1', label: 'Quality', kind: 'rating' as const, weight: 1 },
      { id: 'c2', label: 'Originality', kind: 'rating' as const, weight: 1 },
    ];
  }

  it('renders no chq-focused element on a fresh mount', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoCriteria(),
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    expect(document.querySelector('.chq-focused')).toBeNull();
  });

  it('pressing a number key sets the focused criterion score and arms the ring', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoCriteria(),
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    expect(document.querySelector('.chq-focused')).toBeNull();

    const root = document.querySelector('.chq-page')!;
    fireEvent.keyDown(root, { key: '4' });

    // The first rating criterion (pre-armed focusedId) receives the score.
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality' });
    expect(within(qualityGroup).getByRole('radio', { name: '4' })).toHaveAttribute('aria-checked', 'true');

    // And the ring is now armed on that same criterion's row.
    const focused = document.querySelectorAll('.chq-focused');
    expect(focused).toHaveLength(1);
    expect(focused[0]).toContainElement(qualityGroup);
  });

  it('renders no "Tip: number keys" hint text', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoCriteria(),
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Tip: number keys');
  });

  it('the rating radiogroup and Submit and next live inside the scoring rail, while the abstract does not', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        description: 'A talk about testing scorecards.',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoCriteria(),
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();

    const rail = document.querySelector('.chq-review-scorecard-rail')!;
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality' });
    const submitButton = screen.getByRole('button', { name: 'Submit and next' });
    expect(rail.contains(qualityGroup)).toBe(true);
    expect(rail.contains(submitButton)).toBe(true);

    const abstract = document.querySelector('.chq-review-scorecard-abstract')!;
    expect(rail.contains(abstract)).toBe(false);
  });
});

// DEC-939 (wave-3 amendment): the run-4 ABS killer -- a reviewer who fills
// every criterion after a first failed submit attempt can actually submit,
// and typing a comment never gets hijacked by the page-level key handler.
describe('Scorecard completeness notice and form-field key guard (DEC-939 wave-3 amendment)', () => {
  function twoRatingsAndDropdown() {
    return [
      { id: 'c1', label: 'Relevance', kind: 'rating' as const, weight: 1 },
      { id: 'c2', label: 'Recommendation', kind: 'rating' as const, weight: 1 },
      { id: 'c3', label: 'Format fit', kind: 'dropdown' as const, options: ['Yes', 'No'] },
    ];
  }

  it('names the missing criteria after a failed attempt, then clears and submits once every control is filled', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoRatingsAndDropdown(),
      },
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: { ok: true },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    expect(screen.queryByText(/Rate every criterion before submitting/)).not.toBeInTheDocument();

    // First attempt with nothing filled -- the notice names every blocker.
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));
    expect(
      await screen.findByText('Rate every criterion before submitting — still needed: Relevance, Recommendation, Format fit'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining(`/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`),
      expect.objectContaining({ method: 'PUT' }),
    );

    // Fill both ratings and the dropdown -- clicking every control.
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Relevance' })).getByRole('radio', { name: '4' }));
    // The notice narrows as blockers clear (still recommendation + format fit).
    expect(
      await screen.findByText('Rate every criterion before submitting — still needed: Recommendation, Format fit'),
    ).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Recommendation' })).getByRole('radio', { name: '3' }));
    fireEvent.change(screen.getByRole('option', { name: 'Yes' }).closest('select')!, { target: { value: 'Yes' } });

    // The notice vanishes the instant the last criterion is answered --
    // no second submit click required to clear it.
    await waitFor(() => expect(screen.queryByText(/Rate every criterion before submitting/)).not.toBeInTheDocument());
    expect(document.querySelector('.chq-review-criterion-missing')).toBeNull();

    // Type a comment, then actually submit -- the PUT fires.
    fireEvent.change(screen.getByLabelText('Comment to the committee'), { target: { value: 'Strong talk.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`),
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
  });

  it('typing "4" then Enter inside the comment textarea neither changes a score nor submits', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoRatingsAndDropdown(),
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

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();

    const commentField = screen.getByLabelText('Comment to the committee');
    fireEvent.keyDown(commentField, { key: '4' });
    fireEvent.keyDown(commentField, { key: 'Enter' });

    // Neither the focused (first) rating criterion nor any other picked up
    // a score, and no PUT (submit) fired.
    const relevanceGroup = screen.getByRole('radiogroup', { name: 'Relevance' });
    within(relevanceGroup)
      .getAllByRole('radio')
      .forEach((r) => expect(r).toHaveAttribute('aria-checked', 'false'));
    expect(document.querySelector('.chq-focused')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining(`/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
