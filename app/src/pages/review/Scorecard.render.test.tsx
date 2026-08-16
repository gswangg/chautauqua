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

// w40-b: builds a real ReviewerQueueEnvelope (items/total/unscoredTotal/
// page/perPage/open/recused) -- the queue mocks below need `unscoredTotal`
// computed server-side over the FULL scope (DEC-845 wave 38 amendment),
// which the shared listEnvelope() helper (a generic list-envelope shape)
// doesn't carry, so this test file builds the real shape directly rather
// than editing the shared mockApi.ts helper (out of this task's scope).
function queueEnvelope(
  items: Array<{ submissionId: string; alreadyRatedByMe: boolean; [key: string]: unknown }>,
  overrides: Partial<{ total: number; unscoredTotal: number }> = {},
) {
  return {
    items,
    total: overrides.total ?? items.length,
    unscoredTotal: overrides.unscoredTotal ?? items.filter((i) => !i.alreadyRatedByMe).length,
    page: 1,
    perPage: 200,
    open: true,
    recused: [],
  };
}

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
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    const qualityRadios = within(qualityGroup).getAllByRole('radio');
    expect(qualityRadios).toHaveLength(5);
    expect(qualityRadios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);

    // dropdown criterion -> select with its options
    expect(screen.getByRole('option', { name: 'Great' })).toBeInTheDocument();

    // free-text criterion -> textarea
    expect(screen.getByLabelText('Notes (c3)')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes (c3)').tagName).toBe('TEXTAREA');

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
    const fitRow = screen.getByText('Fit').closest('fieldset')!;
    expect(fitRow.querySelector('.chq-review-criterion-guidance')).toBeNull();
  });

  // DEC-873: (1) rating buttons cover [scale.min, scale.max] with
  // aria-checked on the chosen one; (2) the weight caption reads
  // criterionWeightShares; (3) Overall renders an em dash until every
  // rating criterion is scored, then the computed blend; (4) Save draft
  // PUTs and stays on the page.
  it('renders the scale-bound rating control, weight caption, and overall blend; Save draft does not navigate', async () => {
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
    const fitRow = screen.getByText('Fit').closest('fieldset')!;
    expect(fitRow.querySelector('.chq-review-criterion-weight-caption')).toBeNull();

    // Overall renders an em dash before every rating criterion is scored;
    // frame 03--01: caption + reconciliation merge into one sentence, and
    // before every rating criterion is scored that sentence is just the
    // caption (no reconciliation clause to append yet).
    expect(screen.getByText('Overall')).toBeInTheDocument();
    expect(screen.getByText('Averaged by weight, not editable')).toBeInTheDocument();
    const overallValue = () => document.querySelector('.chq-review-overall-value')!;
    expect(overallValue().textContent).toBe('—');

    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    const depthGroup = screen.getByRole('radiogroup', { name: 'Depth (c2)' });
    fireEvent.click(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
    expect(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 4 of 5' })).toHaveAttribute('aria-checked', 'true');

    // Still incomplete (Depth unscored, Fit unset) -> still an em dash.
    expect(overallValue().textContent).toBe('—');

    fireEvent.click(within(depthGroup).getByRole('radio', { name: 'Depth (c2): 2 of 5' }));
    fireEvent.change(screen.getByRole('option', { name: 'Great' }).closest('select')!, { target: { value: 'Great' } });

    // Complete -> (4*3 + 2*1) / 4 = 3.5.
    await waitFor(() => expect(overallValue().textContent).toBe('3.5'));

    // Save draft PUTs and stays on the page (no navigation away).
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Saved as a draft');
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
        // entirely -- no key at all -- for an anonymised plan, and sets
        // anonymized: true (DEC-018 wave-54 amendment) as the wire's own
        // signal for the reading-column disclosure below.
        anonymized: true,
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
      screen.getByText("The speaker's name and company are hidden while this plan is anonymised."),
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

  it('the rail actions render full-width stacked, primary over secondary, with the secondary labelled Save draft (DEC-873 wave 27 amendment)', async () => {
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
    const actions = document.querySelector('.chq-review-editor-actions')!;
    const buttons = Array.from(actions.querySelectorAll('button'));
    expect(buttons[0]).toHaveTextContent('Submit and next');
    expect(buttons[0]).toHaveClass('chq-btn-primary');
    expect(buttons[1]).toHaveTextContent('Save draft');
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

    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
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
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    within(qualityGroup).getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit and next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();

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

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Quality (c1)' })).getByRole('radio', { name: 'Quality (c1): 5 of 5' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Originality (c2)' })).getByRole('radio', { name: 'Originality (c2): 4 of 5' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Delivery (c3)' })).getByRole('radio', { name: 'Delivery (c3): 4 of 5' }));

    await waitFor(() =>
      expect(document.querySelector('.chq-review-overall-caption')?.textContent).toBe(
        // DEC-147 amendment (w62-d): the caption's plain-average hint now
        // goes through formatScore too (one decimal, same grammar as the
        // Overall value above it), not a bare .toFixed(2).
        'Averaged by weight, not editable — a plain average of 5, 4, 4 would be 4.3',
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
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: queueEnvelope([
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
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: queueEnvelope([
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
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    expect(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 4 of 5' })).toHaveAttribute('aria-checked', 'true');

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
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
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
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: queueEnvelope([]),
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
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Relevance (c1)' })).getByRole('radio', { name: 'Relevance (c1): 4 of 5' }));
    // The notice narrows as blockers clear (still recommendation + format fit).
    expect(
      await screen.findByText('Rate every criterion before submitting — still needed: Recommendation, Format fit'),
    ).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Recommendation (c2)' })).getByRole('radio', { name: 'Recommendation (c2): 3 of 5' }));
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
    const relevanceGroup = screen.getByRole('radiogroup', { name: 'Relevance (c1)' });
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

// DEC-873 (wave 27 amendment, task w27-g): Save draft accepts partial scores
// (no completeness check, no `attempted` gate); Submit and next keeps its
// full validation unchanged.
describe('Scorecard Save draft (DEC-873 wave 27 amendment)', () => {
  function twoRatings() {
    return [
      { id: 'c1', label: 'Relevance', kind: 'rating' as const, weight: 1 },
      { id: 'c2', label: 'Recommendation', kind: 'rating' as const, weight: 1 },
    ];
  }

  it('Save draft with zero criteria scored succeeds, while Submit with zero scored still blocks', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoRatings(),
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

    // Submit and next, with nothing scored, blocks -- no PUT, and the
    // incomplete notice names both criteria.
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));
    expect(
      await screen.findByText('Rate every criterion before submitting — still needed: Relevance, Recommendation'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining(`/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`),
      expect.objectContaining({ method: 'PUT' }),
    );

    // Save draft, with nothing scored, succeeds -- no completeness gate.
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Saved as a draft');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`),
      expect.objectContaining({ method: 'PUT' }),
    );
    const draftCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        typeof input === 'string' &&
        input.includes(`/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`) &&
        (init as RequestInit | undefined)?.method === 'PUT',
    );
    const draftBody = JSON.parse((draftCall?.[1] as RequestInit).body as string) as {
      draft: boolean;
      scores: Record<string, unknown>;
    };
    expect(draftBody.draft).toBe(true);
    expect(draftBody.scores).toEqual({});

    // Save draft did not clear/hide the still-visible incomplete notice
    // from the earlier failed Submit attempt -- Save draft never re-runs
    // the completeness check either way.
    expect(
      screen.getByText('Rate every criterion before submitting — still needed: Relevance, Recommendation'),
    ).toBeInTheDocument();
  });

  it('shows the "Saving a draft skips these checks" caption beside Save draft', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoRatings(),
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
    expect(screen.getByText('Saving a draft skips these checks')).toBeInTheDocument();
  });
});

// w40-b (DEC-845 amendment): the header counter reads the queue envelope's
// own total/unscoredTotal (computed server-side over the reviewer's FULL
// scope before any page slice), never the loaded page of items, and
// "Submit and next" scans for the first not-already-rated, not-current row
// rather than blindly taking items[0] (which the server deliberately keeps
// populated with already-rated rows, sorted rated-last).
describe('Scorecard queue envelope counter and submit-and-next termination (DEC-845 wave 40 amendment)', () => {
  it('renders the header counter from the envelope total/unscoredTotal, not the 200-row page (test a)', async () => {
    // 200 items on the page, but the envelope's own total/unscoredTotal
    // (computed over the reviewer's full scope) say 250/3 -- the header
    // must print 247 of 250, not a figure derived from the 200-row page.
    const items = Array.from({ length: 200 }, (_, i) => ({
      submissionId: `sub-${i}`,
      ref: `S-${i}`,
      title: `Submission ${i}`,
      ratingsCount: 1,
      alreadyRatedByMe: true,
      myScore: 4,
      format: null,
    }));

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
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: queueEnvelope(items, { total: 250, unscoredTotal: 3 }),
    });

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
    await waitFor(() => expect(within(headerSlot).getByText('247 of 250 done')).toBeInTheDocument());
    headerSlot.remove();
  });

  it('lands on the plan route, never a submission route, once unscoredTotal is 0 (test b)', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
      },
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: { ok: true },
      // Every row is already rated by this reviewer (including the one
      // just submitted) and unscoredTotal is 0 -- items[0] would be a
      // scored submission if the old blind-take-first logic survived.
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: queueEnvelope(
        [
          { submissionId: SUBMISSION_ID, ref: 'S-010', title: 'A Deeply Nested Talk', ratingsCount: 1, alreadyRatedByMe: true, myScore: 4, format: null },
          { submissionId: 'sub-other', ref: 'S-011', title: 'Another Talk', ratingsCount: 1, alreadyRatedByMe: true, myScore: 3, format: null },
        ],
        { unscoredTotal: 0 },
      ),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
          <Route path="/review/plans/:planId" element={<div>PLAN ROUTE</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();

    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    fireEvent.click(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`),
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
    expect(await screen.findByText('PLAN ROUTE')).toBeInTheDocument();
  });

  it('advances to the first unscored item that is not the current submission (test c)', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
      },
      [`GET /api/v1/review/submissions/sub-next`]: {
        id: 'sub-next',
        ref: 'S-011',
        title: 'The Next Submission',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
      },
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: { ok: true },
      // The just-submitted submission is still rated-last in the queue
      // (server keeps it), and one genuinely unscored row (`sub-next`)
      // exists -- "Submit and next" must land there, not on itself.
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: queueEnvelope([
        { submissionId: SUBMISSION_ID, ref: 'S-010', title: 'A Deeply Nested Talk', ratingsCount: 1, alreadyRatedByMe: true, myScore: 4, format: null },
        { submissionId: 'sub-next', ref: 'S-011', title: 'The Next Submission', ratingsCount: 0, alreadyRatedByMe: false, myScore: null, format: null },
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

    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    fireEvent.click(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`),
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
    expect(await screen.findByRole('heading', { name: 'The Next Submission' })).toBeInTheDocument();
  });
});

// DEC-939 amendment (CFP-11 P0 lineage): the rating radiogroup honours the
// standard radio keyboard contract -- roving tabindex, arrow/Home/End move
// focus AND set the score in the same store the pills and submit validator
// share, and the handler swallows the event before it reaches the
// page-level number-key handler (ruling A11).
describe('Scorecard rating group keyboard contract (DEC-939 amendment)', () => {
  function twoRatingCriteria() {
    return [
      { id: 'c1', label: 'Quality', kind: 'rating' as const, weight: 1 },
      { id: 'c2', label: 'Depth', kind: 'rating' as const, weight: 1 },
    ];
  }

  async function renderTwoGroups() {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoRatingCriteria(),
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
    const overallValue = () => document.querySelector('.chq-review-overall-value')!;
    return { overallValue };
  }

  it('clicking a pill in the SECOND group commits its value; the Overall blend (the completed-count signal both groups feed) only resolves once both are set', async () => {
    const { overallValue } = await renderTwoGroups();
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    const depthGroup = screen.getByRole('radiogroup', { name: 'Depth (c2)' });

    // Nothing scored yet -> em dash.
    expect(overallValue().textContent).toBe('—');

    fireEvent.click(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
    expect(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 4 of 5' })).toHaveAttribute('aria-checked', 'true');
    // Depth still unscored -> still an em dash.
    expect(overallValue().textContent).toBe('—');

    fireEvent.click(within(depthGroup).getByRole('radio', { name: 'Depth (c2): 2 of 5' }));
    expect(within(depthGroup).getByRole('radio', { name: 'Depth (c2): 2 of 5' })).toHaveAttribute('aria-checked', 'true');
    // Both groups committed -> the Overall blend resolves, proving the
    // second group's click landed in the SAME scores store the first did.
    await waitFor(() => expect(overallValue().textContent).toBe('3.0'));
    // First group's selection is untouched by the second group's click.
    expect(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 4 of 5' })).toHaveAttribute('aria-checked', 'true');
  });

  it('ArrowRight from a focused pill selects the next value and moves focus to it', async () => {
    await renderTwoGroups();
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    const first = within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 1 of 5' });
    first.focus();
    fireEvent.keyDown(qualityGroup, { key: 'ArrowRight' });

    const second = within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 2 of 5' });
    expect(second).toHaveAttribute('aria-checked', 'true');
    expect(second).toHaveFocus();
  });

  it('ArrowLeft wraps from the first value to the last', async () => {
    await renderTwoGroups();
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    const first = within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 1 of 5' });
    first.focus();
    fireEvent.keyDown(qualityGroup, { key: 'ArrowLeft' });

    const last = within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 5 of 5' });
    expect(last).toHaveAttribute('aria-checked', 'true');
    expect(last).toHaveFocus();
  });

  it('Home and End reach the first and last values', async () => {
    await renderTwoGroups();
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 3 of 5' }).focus();
    fireEvent.keyDown(qualityGroup, { key: 'End' });
    const last = within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 5 of 5' });
    expect(last).toHaveAttribute('aria-checked', 'true');
    expect(last).toHaveFocus();

    fireEvent.keyDown(qualityGroup, { key: 'Home' });
    const firstAgain = within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 1 of 5' });
    expect(firstAgain).toHaveAttribute('aria-checked', 'true');
    expect(firstAgain).toHaveFocus();
  });

  it('the group exposes exactly one tab stop, and it tracks the selected value', async () => {
    await renderTwoGroups();
    const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
    const radios = within(qualityGroup).getAllByRole('radio');

    // Nothing selected yet -> the first pill is the one tab stop.
    expect(radios.filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(radios[0]).toHaveAttribute('tabindex', '0');

    fireEvent.click(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 3 of 5' }));
    const radiosAfter = within(qualityGroup).getAllByRole('radio');
    expect(radiosAfter.filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 3 of 5' })).toHaveAttribute('tabindex', '0');
  });
});

// DEC-958 (wave-66 amendment): PUT .../evaluations/:id's fields map renders
// AT its control -- per-criterion messages under the criterion's own row,
// {comment: ...} at the comment textarea, and every key (matched or not)
// gets one anchor in the top-of-rail ErrorSummary. A field-less conflict
// still renders its message verbatim, with no fabricated field marker.
describe('Scorecard server refusal shapes render at their control (DEC-958 wave-66 amendment)', () => {
  function ratingAndTextCriteria() {
    return [
      { id: 'c1', label: 'Quality', kind: 'rating' as const, weight: 1 },
      { id: 'c2', label: 'Notes', kind: 'text' as const, required: false },
    ];
  }

  async function renderScorecard(criteria: ReturnType<typeof ratingAndTextCriteria>) {
    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'A Deeply Nested Talk' })).toBeInTheDocument();
    void criteria;
  }

  it('renders a per-criterion out-of-range refusal under that criterion, anchored from the summary', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: ratingAndTextCriteria(),
      },
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 400,
        body: { error: { code: 'invalid', message: 'Invalid scores', fields: { c1: 'score must be within [1, 5]' } } },
      },
    });

    await renderScorecard(ratingAndTextCriteria());

    // Fill both criteria so the client-side completeness gate passes and
    // the PUT actually fires.
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Quality (c1)' })).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    const message = await screen.findByText('score must be within [1, 5]');
    const criterionRow = document.getElementById('chq-review-criterion-c1');
    expect(criterionRow).not.toBeNull();
    expect(criterionRow!.contains(message)).toBe(true);

    // The summary's anchor for this key points at the same row id.
    const summaryLink = screen.getByRole('link', { name: /Quality: score must be within \[1, 5\]/ });
    expect(summaryLink).toHaveAttribute('href', '#chq-review-criterion-c1');
  });

  it('renders an unknown-criterion key labelled by its raw key, never dropped', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: ratingAndTextCriteria(),
      },
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 400,
        body: { error: { code: 'invalid', message: 'Invalid scores', fields: { stray: 'unknown criterion' } } },
      },
    });

    await renderScorecard(ratingAndTextCriteria());

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Quality (c1)' })).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    const summaryLink = await screen.findByRole('link', { name: /stray: unknown criterion/ });
    expect(summaryLink).toHaveAttribute('href', '#stray');
  });

  it('renders the comment-cap refusal at the comment textarea', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: ratingAndTextCriteria(),
      },
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 400,
        body: { error: { code: 'invalid', message: 'Invalid comment', fields: { comment: 'Max 20000' } } },
      },
    });

    await renderScorecard(ratingAndTextCriteria());

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Quality (c1)' })).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    const message = await screen.findByText('Max 20000');
    const commentField = screen.getByLabelText('Comment to the committee');
    expect(commentField).toHaveAttribute('id', 'chq-review-comment-field');
    // The message sits right beside the field it names.
    expect(message.previousElementSibling === commentField || message.parentElement?.contains(commentField)).toBeTruthy();

    const summaryLink = screen.getByRole('link', { name: /Comment to the committee: Max 20000/ });
    expect(summaryLink).toHaveAttribute('href', `#${commentField.id}`);
  });

  it('renders the {scores: required} refusal as an unmatched key, not the generic message', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: ratingAndTextCriteria(),
      },
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 400,
        body: { error: { code: 'invalid', message: 'scores is required', fields: { scores: 'required' } } },
      },
    });

    await renderScorecard(ratingAndTextCriteria());

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Quality (c1)' })).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    const summaryLink = await screen.findByRole('link', { name: /scores: required/ });
    expect(summaryLink).toHaveAttribute('href', '#scores');
  });

  it('renders a field-less conflict verbatim, with no ErrorSummary and no fabricated field marker', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: ratingAndTextCriteria(),
      },
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 409,
        body: { error: { code: 'conflict', message: 'This review plan is not currently open' } },
      },
    });

    await renderScorecard(ratingAndTextCriteria());

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Quality (c1)' })).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    expect(await screen.findByText('This review plan is not currently open')).toBeInTheDocument();
    expect(document.querySelector('.chq-error-summary')).toBeNull();
    expect(document.getElementById('chq-review-criterion-c1')?.querySelector('.chq-field-error')).toBeNull();
  });

  it('a draft save still renders the per-criterion message (DEC-873: only completeness is skipped)', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: ratingAndTextCriteria(),
      },
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 400,
        body: { error: { code: 'invalid', message: 'Invalid scores', fields: { c1: 'score must be within [1, 5]' } } },
      },
    });

    await renderScorecard(ratingAndTextCriteria());

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const message = await screen.findByText('score must be within [1, 5]');
    const criterionRow = document.getElementById('chq-review-criterion-c1');
    expect(criterionRow!.contains(message)).toBe(true);
  });
});

// DEC-939 (wave-61 amendment): scorecard a11y -- two criteria whose labels
// collide must still be two distinct groups in the accessibility tree. Each
// row is a real <fieldset> with a visible <legend>, and the group's/each
// radio's accessible name is derived from the criterion's own id as well as
// its label, so it stays unique even when the (user-editable) label is not.
describe('Scorecard a11y: colliding criterion labels stay distinct groups (DEC-939 wave-61 amendment)', () => {
  function twoCollidingRatingCriteria() {
    return [
      { id: 'crit-a', label: 'Relevance', kind: 'rating' as const, weight: 1 },
      { id: 'crit-b', label: 'Relevance', kind: 'rating' as const, weight: 1 },
    ];
  }

  it('renders two fieldsets with two distinct group names and ten distinct radio names', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoCollidingRatingCriteria(),
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

    // Two <fieldset> rows, one per criterion, each with a <legend> carrying
    // the (colliding) visible label text.
    const fieldsets = document.querySelectorAll('fieldset.chq-review-criterion');
    expect(fieldsets).toHaveLength(2);
    fieldsets.forEach((fs) => {
      const legend = fs.querySelector('legend');
      expect(legend).not.toBeNull();
      expect(legend!.textContent).toContain('Relevance');
    });

    // The two radiogroups are distinct accessible-name-addressable groups
    // even though both criteria share the visible label 'Relevance'.
    const groupA = screen.getByRole('radiogroup', { name: 'Relevance (crit-a)' });
    const groupB = screen.getByRole('radiogroup', { name: 'Relevance (crit-b)' });
    expect(groupA).not.toBe(groupB);
    const allGroups = screen.getAllByRole('radiogroup');
    const groupNames = allGroups.map((g) => g.getAttribute('aria-label'));
    expect(new Set(groupNames).size).toBe(2);

    // Ten radios total (5 per group), every one with a distinct accessible
    // name -- the collision would otherwise flatten value 'N' from group A
    // and value 'N' from group B into the same name.
    const allRadios = screen.getAllByRole('radio');
    expect(allRadios).toHaveLength(10);
    const radioNames = allRadios.map((r) => r.getAttribute('aria-label'));
    expect(new Set(radioNames).size).toBe(10);
    radioNames.forEach((name) => expect(name).not.toMatch(/^\d+$/));
  });

  it('keeps the arrow-key roving-focus contract working inside a collided group', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        sessionAnswers: [],
        myEvaluation: undefined,
        criteria: twoCollidingRatingCriteria(),
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

    const groupA = screen.getByRole('radiogroup', { name: 'Relevance (crit-a)' });
    const first = within(groupA).getByRole('radio', { name: 'Relevance (crit-a): 1 of 5' });
    first.focus();
    fireEvent.keyDown(groupA, { key: 'ArrowRight' });

    const second = within(groupA).getByRole('radio', { name: 'Relevance (crit-a): 2 of 5' });
    expect(second).toHaveAttribute('aria-checked', 'true');
    expect(second).toHaveFocus();
  });
});
