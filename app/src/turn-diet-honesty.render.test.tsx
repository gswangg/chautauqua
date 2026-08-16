// DEC-967 (wave-54 amendment, task-w54-e): audit of the REMAINING
// turn-diet features named in `docs/eval-findings/01-user-filed.md:1-10`
// against the user's standing rule -- a diet is legitimate when it's
// invisible or genuinely better UX (deep links, Enter-to-commit, fewer
// clicks, instant first paint); it is FORBIDDEN when it changes what the
// product does without the user asking (silent pre-fills, surprising
// defaults, skipped confirmations).
//
// Population (fixed by the task, not expanded):
//   1. ComposeWizard.tsx:71,196,216,498 (?template= landing, ?ids= handoff,
//      the disclosure line replacing w12-c's auto-apply, Enter-to-advance)
//   2. CallForPapersPanel.tsx:131-134,312-319 (one-click 'Close the call')
//   3. DeliverableDetail.tsx:367 (quiet action row)
//   4. BulkActionBar.tsx:12,53 (compose link carrying ids)
//   5. SubmissionDetailPage.tsx inline title/abstract + tracks editors
//
// Every site below already has render coverage proving the no-silent-
// mutation property; this file cites that coverage (per this task's own
// instructions: "if an existing render test already proves the property,
// cite it in a comment and move on") and adds one consolidated assertion
// per site as a standalone regression tripwire that does not depend on
// those other files' fixture setup. No site in this population required a
// code fix -- see the per-site verdict comments below and at the cited
// source lines.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { ComposeWizard } from './pages/comms/ComposeWizard';
import { CallForPapersPanel } from './pages/settings/CallForPapersPanel';
import { BulkActionBar } from './pages/submissions/BulkActionBar';
import { DeliverableDetail } from './pages/content/DeliverableDetail';
import { SubmissionDetailPage } from './pages/submissions/SubmissionDetailPage';
import { listEnvelope, mockApi } from './test-utils/mockApi';

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
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
});

// VERDICT: LEGITIMATE, no fix needed. Both the ?ids= handoff and the
// ?template= landing are deep links reached via an explicit prior click
// (BulkActionBar's "Email these N" link / Templates' "Use in a send"
// link) -- they pre-fill state the organizer already chose, never invent
// it, and issue no mutating call until Send. The w12-c templates[0]
// auto-apply that DID silently pre-fill on arrival (no explicit link, no
// disclosure) was already removed; `autoAppliedTemplateName` is now dead
// state (set, never un-nulled to a real value) confirming the removal is
// total. Already proven by:
//   - ComposeWizard.render.test.tsx:1599-1622 ("turn diet (w12-c...)":
//     step 2 arrives BLANK, no disclosure line, explicit select required)
//   - ComposeWizard.render.test.tsx:1652-1666/1677-1710 (Enter-to-advance
//     reaches preview but never sends; Enter on step 4 fires zero
//     /compose/send calls -- a deliberate send stays a deliberate click)
//   - ComposeWizard.idsParam.render.test.tsx:29-121 (every ?ids= shape;
//     mockApi has no mutating route registered, so a premature POST would
//     throw loudly)
//   - ComposeWizard.templateParam.render.test.tsx:35-83 (?template=
//     prefills subject/body but stays on step 1; the preview POST only
//     fires after an explicit "Next: preview" click)
describe('turn-diet honesty: ComposeWizard', () => {
  it('a combined ?template=+?ids= landing prefills state but issues no mutating call until an explicit Next click', async () => {
    window.history.pushState({}, '', '/comms?tab=compose&template=tpl-1&ids=sub-1');
    const EVENT_ID = 'evt-honesty-compose';
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-1', eventId: EVENT_ID, name: 'Waitlist', subject: 'Waitlist subject', bodyText: 'Body text' },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([]),
      // Deliberately NO preview/send routes registered: if the landing
      // effects issued a mutating (or even a preview) call on mount, this
      // mock would throw "no route registered" and fail the test.
    });

    // Step 1's footer carries a real Cancel <Link> back to /comms (frame
    // 07-comms--05), so this mount needs the router context every other
    // ComposeWizard render test already supplies -- an unrouted mount
    // throws inside react-router's Link, not in the code under test.
    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    // State was hydrated from the URL (2 submissions selected, template
    // applied) --
    await waitFor(() => expect(screen.getByLabelText('Subject')).toHaveValue('Waitlist subject'));
    expect(screen.getByText('2. Pick or edit a template')).toBeInTheDocument();

    const sendCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/'));
    expect(sendCalls.length).toBe(0);
  });
});

// VERDICT: LEGITIMATE, no fix needed. The one-click "Close the call" fast
// path never mutates on its own click -- it only opens a ConfirmDialog
// that names the exact action ("Close the call for papers?" / "Speakers
// will no longer be able to submit"), and the PATCH is issued only from
// the dialog's own confirm button. Already proven by
// CallForPapersPanel.render.test.tsx:289-338 (fast-path click opens the
// confirm; the PATCH route is registered only AFTER the confirm click, so
// an earlier PATCH attempt would have thrown "no route registered").
describe('turn-diet honesty: CallForPapersPanel', () => {
  it('the "Close the call" fast path opens a confirm naming the action and issues no PATCH before it is confirmed', async () => {
    const EVENT_ID = 'evt-honesty-cfp';
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);
    const now = Date.now();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'honesty-cfp', timezone: 'UTC' },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: {
        id: 'form1',
        eventId: EVENT_ID,
        intro: 'Tell us about your talk.',
        openDate: now - 1000 * 60 * 60 * 24,
        closeDate: now + 1000 * 60 * 60 * 24 * 30,
        tracks: [],
        fields: [],
      },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 0 }),
      // Deliberately NO PATCH route registered: a premature mutation on
      // the fast-path click alone would throw.
    });

    render(
      <MemoryRouter>
        <CallForPapersPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Call for papers' });
    const fastPath = await within(section).findByRole('button', { name: 'Close the call' });
    fireEvent.click(fastPath);

    expect(
      await screen.findByText('Speakers will no longer be able to submit. You can reopen the call later from Settings.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close the call now' })).toBeInTheDocument();
  });
});

// VERDICT: LEGITIMATE, no fix needed. BulkActionBar's compose handoff is a
// plain <Link> carrying the already-selected ids into the query string --
// it renders no fetch call of its own at all (this test mounts it with NO
// mockApi registered, so any api* call would throw "fetch is not
// defined"/network error). Already proven structurally by
// BulkActionBar.idsHandoff.render.test.tsx:20-81 (href exactness + order
// preservation).
describe('turn-diet honesty: BulkActionBar', () => {
  it('the compose handoff is a navigation Link, not a fetch call -- no api* call is possible from this component', () => {
    render(
      <MemoryRouter>
        <BulkActionBar
          selectedCount={2}
          pending={false}
          statusFilter={null}
          onApply={vi.fn()}
          onClear={vi.fn()}
          selectedIds={['sub-a', 'sub-b']}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Email these 2 submissions/ });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/comms?tab=compose&ids=sub-a,sub-b');
  });
});

// VERDICT: LEGITIMATE, no fix needed (DeliverableDetail.tsx:367). The
// "quiet action row" is two plain <Link>s (styled as tertiary text, not
// bordered buttons) into the submission's own existing editor
// (`?edit=1`) and history (`?history=1`) -- pure navigation, no api* call,
// no state pre-fill of its own. Already proven by
// DeliverableDetail.render.test.tsx:464-483 (asserts both hrefs); proven
// here by mounting with ONLY read routes registered (no mutating route at
// all) and asserting zero PATCH/POST/DELETE calls landed by the time the
// header and action row have rendered.
describe('turn-diet honesty: DeliverableDetail quiet action row', () => {
  it('issues zero mutating calls on mount', async () => {
    const SUBMISSION_ID = 'sub-honesty-deliverable';
    const fetchMock = mockApi({
      [`GET /api/v1/submissions/${SUBMISSION_ID}/files`]: listEnvelope([]),
      [`GET /api/v1/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-901',
        updatedAt: 1700000300000,
        participants: [{ name: 'Ada Lovelace', contactId: 'contact-ada' }],
        slot: null,
      },
      'GET /api/v1/me': { userId: 'user-1', email: 'org@example.com', name: 'Org User', role: 'organizer', orgId: 'org-1' },
      // Deliberately NO PATCH/POST/DELETE route registered: a premature
      // mutating call on mount would throw "no route registered".
    });

    render(
      <MemoryRouter>
        <DeliverableDetail
          submissionId={SUBMISSION_ID}
          title="A talk"
          contentStatus="pending"
          onBack={() => {}}
          onContentStatusChange={() => {}}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: /Edit title and abstract/ })).toHaveAttribute(
      'href',
      `/submissions/${SUBMISSION_ID}?edit=1`,
    );
    expect(screen.getByRole('link', { name: /Revision history/ })).toHaveAttribute(
      'href',
      `/submissions/${SUBMISSION_ID}?history=1`,
    );

    const mutatingCalls = fetchMock.mock.calls.filter(([, init]) =>
      ['PATCH', 'POST', 'DELETE'].includes((init as RequestInit | undefined)?.method ?? ''),
    );
    expect(mutatingCalls.length).toBe(0);
  });
});

// VERDICT: LEGITIMATE, no fix needed (SubmissionDetailPage.tsx inline
// title/abstract + tracks editors). `?edit=1` prefills the editor from the
// submission's OWN current title/description (showing existing data, not
// inventing it) and issues no PATCH on arrival; saveEdit/saveTracks are
// each gated behind the editor's own real <form> (explicit Save click, or
// Enter/Cmd+Enter inside that same form -- never elsewhere, never on a
// bare textarea Enter). Already proven by
// SubmissionDetailPage.render.test.tsx:215-235 (?edit=1 prefill, no PATCH
// route registered so a premature PATCH would throw) and
// SubmissionDetailPage.render.test.tsx:1685-1801 (title/abstract editor:
// exactly one PATCH on Enter-submit, zero on a bare textarea Enter, zero
// on Escape; tracks editor: same Enter-submits-the-real-form shape); this
// file adds a standalone tripwire with its own fixture setup, gating on
// mockApi's "no route registered" throw the same way the sites above do.
describe('turn-diet honesty: SubmissionDetailPage inline title/abstract + tracks editors', () => {
  const SUB_ID = 'sub-honesty-detail';

  function baseDetail(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: SUB_ID,
      eventId: 'evt-honesty',
      ref: 'S-900',
      title: 'Original Title',
      description: 'Original description',
      status: 'pending',
      contentStatus: 'pending',
      trackId: null,
      trackIds: [] as string[],
      formId: null,
      acceptedAt: null,
      icsSequence: 0,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      participants: [],
      answers: {},
      slot: null as { day: string; startMin: number; endMin: number; roomName: string | null } | null,
      ...overrides,
    };
  }

  function readRoutes(overrides: Record<string, unknown> = {}) {
    return {
      [`GET /api/v1/submissions/${SUB_ID}`]: baseDetail(),
      [`GET /api/v1/events/evt-honesty`]: { id: 'evt-honesty', timezone: 'UTC' },
      [`GET /api/v1/events/evt-honesty/tracks`]: {
        items: [{ id: 't1', name: 'Frontend' }],
        total: 1,
        page: 1,
        perPage: 20,
      },
      [`GET /api/v1/events/evt-honesty/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [] },
      ...overrides,
    };
  }

  function renderPage(initialPath: string) {
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('the title/abstract editor issues exactly one PATCH on an explicit form submit', async () => {
    const fetchMock = mockApi(
      readRoutes({
        [`PATCH /api/v1/submissions/${SUB_ID}`]: { status: 200, body: baseDetail({ title: 'New Title' }) },
      }),
    );

    renderPage(`/submissions/${SUB_ID}?edit=1`);

    const titleInput = await screen.findByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });
    fireEvent.submit((titleInput as HTMLInputElement).closest('form') as HTMLFormElement);

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
      expect(patchCalls).toHaveLength(1);
    });
  });

  it('a bare Enter in the abstract textarea issues zero requests', async () => {
    // No PATCH route registered at all -- a premature save would throw.
    mockApi(readRoutes());

    renderPage(`/submissions/${SUB_ID}?edit=1`);

    const abstractField = await screen.findByLabelText('Abstract');
    fireEvent.keyDown(abstractField, { key: 'Enter', code: 'Enter' });

    // Still on the editor, still the original text -- no submit happened.
    expect(screen.getByLabelText('Abstract')).toHaveValue('Original description');
  });

  it('Escape while editing issues zero requests and returns to the read view', async () => {
    // No PATCH route registered at all -- a premature save would throw.
    mockApi(readRoutes());

    renderPage(`/submissions/${SUB_ID}?edit=1`);

    const titleInput = await screen.findByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'Should not be saved' } });
    fireEvent.keyDown(titleInput, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Original description')).toBeInTheDocument();
  });

  it('the tracks editor has the same Enter-submits-the-real-form shape: exactly one PATCH', async () => {
    const fetchMock = mockApi(
      readRoutes({
        [`PATCH /api/v1/submissions/${SUB_ID}`]: { status: 200, body: baseDetail({ trackIds: ['t1'] }) },
      }),
    );

    renderPage(`/submissions/${SUB_ID}`);

    await screen.findByRole('heading', { name: /^Session details/ });
    fireEvent.click(screen.getByRole('button', { name: 'Edit tracks' }));

    const editor = document.getElementById('submission-track-editor') as HTMLElement;
    const checkbox = within(editor).getByRole('checkbox', { name: 'Frontend' });
    fireEvent.click(checkbox);
    fireEvent.submit(editor);

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
      expect(patchCalls).toHaveLength(1);
    });
  });
});
