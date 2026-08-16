// DEC-350 layer-2 harness for the J5 compose recipient picker
// (app/src/pages/comms/ComposeWizard.tsx): the picker must be server-paged
// and searchable, exactly like the onboarding grid (DEC-340) and the
// submissions worklist (DEC-341) — no client-side filter/sort over a single
// fetched page, and selection must span pages.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComposeWizard } from './ComposeWizard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-compose-render';

function submission(n: number) {
  return {
    id: `sub-${n}`,
    ref: `S-${String(n).padStart(3, '0')}`,
    title: `Talk number ${n}`,
    status: 'accepted',
    contentStatus: 'approved',
    speakers: [{ contactId: `c${n}`, name: `Speaker ${n}` }],
    trackIds: [],
    submittedAt: null,
    createdAt: 1700000000000,
  };
}

function page1() {
  return Array.from({ length: 50 }, (_, i) => submission(i + 1));
}

function page2() {
  return Array.from({ length: 50 }, (_, i) => submission(i + 51));
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

describe('ComposeWizard recipient picker', () => {
  it('renders the range label and an enabled Next on a first page of 50', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Talk number 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–50 of 340')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('requests page=2 when Next is clicked', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: () => listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(urls.some((u) => u.includes('/submissions') && /[?&]page=2\b/.test(u))).toBe(true);
    });
  });

  it('keeps a page-1 checkbox selection counted after paging to page 2', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: (() => {
        let call = 0;
        return () => {
          call += 1;
          return call === 1
            ? listEnvelope(page1(), { total: 340, page: 1, perPage: 50 })
            : listEnvelope(page2(), { total: 340, page: 2, perPage: 50 });
        };
      })(),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    expect(screen.getByRole('button', { name: /1 submission selected/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Talk number 51');

    expect(screen.getByRole('button', { name: /1 submission selected/ })).toBeInTheDocument();
  });

  it('issues a request with q= and resets page to 1 when searching', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: () => listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'testing' } });

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(urls.some((u) => u.includes('/submissions') && u.includes('q=testing'))).toBe(true);
      const last = urls.filter((u) => u.includes('/submissions')).pop()!;
      expect(/[?&]page=1\b/.test(last) || !/[?&]page=/.test(last)).toBe(true);
    });
  });

  // DEC-678 (B7 rule 6, wave 47): the status set IS the facet narrowing this
  // list to nothing, so an empty step-1 result renders the shared EmptyState
  // 'filtered' block -- naming the selected statuses, offering a single
  // escape that restores the default selection -- and never the bare
  // `<td colSpan={4}>No submissions...</td>` row or the table underneath it.
  it('renders EmptyState filtered (not a bare <td> apology) when no submissions match the selected statuses', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 0, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No submissions match the selected statuses.')).toBeInTheDocument();
    // DEC-967 amendment (wave 18): the default is Accepted alone, not
    // Accepted+Declined.
    expect(screen.getByText(/Filtered by status: Accepted$/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // The status controls stay visible above the message -- 'filtered' never
    // hides the chrome that produced the empty result.
    expect(screen.getByRole('checkbox', { name: 'Pending' })).toBeInTheDocument();
    // DEC-678 amendment (B7 rule 5, wave 53): this step-1 zero-state is
    // always 'filtered' (the status set is always the facet), never fresh
    // -- the pager stays, because chrome is how a filter gets undone.
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 0')).toBeInTheDocument();

    // Deselecting the last remaining status is a no-op -- an empty status
    // filter is unreachable.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Accepted' }));
    expect(screen.getByRole('checkbox', { name: 'Accepted' })).toBeChecked();

    // Narrow further (check Declined, then uncheck Accepted) so the facet
    // actually changes, then take the escape -- it must restore the
    // DEFAULT status selection (Accepted alone), not "every status"
    // literally.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Declined' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Accepted' }));
    expect(screen.getByRole('checkbox', { name: 'Accepted' })).not.toBeChecked();

    await screen.findByText(/Filtered by status: Declined$/);
    fireEvent.click(screen.getByRole('button', { name: 'Select every status' }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Accepted' })).toBeChecked();
    });
    expect(screen.getByRole('checkbox', { name: 'Declined' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pending' })).not.toBeChecked();
  });

  // w8-b: DEC-406/DEC-402 re-skin of compose steps 1-2 — the picker table
  // must carry both the shared .chq-table class and its page-prefixed
  // second class, and every rendered <button> must carry a shell chq-*
  // class (no browser-default buttons on this page).
  it('renders the step-1 picker table with both chq-table classes and every button shell-classed', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');

    const table = document.querySelector('table');
    expect(table).not.toBeNull();
    expect(table).toHaveClass('chq-table');
    expect(table).toHaveClass('chq-comms-compose-table');

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toMatch(/chq-/);
    }
  });

  // w8-d (DEC-051/DEC-780 amendment, findings wave 8): the fact that decides
  // whether a calendar invite can be attached moves to step 1, where it is
  // still cheap to fix -- a scheduled row prints its event-local day+start
  // time, an unscheduled row prints 'No slot yet' in the ink micro-label
  // register (chq-flag), never a dash. The step primary sits in a footer
  // row, not loose under the table.
  it('renders the Slot column: event-local day+time for a scheduled row, "No slot yet" (chq-flag) for an unscheduled row, and moves the primary into a footer row', async () => {
    const rows = [
      { ...submission(1), slot: { day: '2026-08-18', startMin: 600, endMin: 660, roomName: 'Room 2A' } },
      { ...submission(2), slot: null },
    ];
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(rows, { total: 2, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');

    expect(screen.getByRole('columnheader', { name: 'Slot' })).toBeInTheDocument();
    expect(screen.getByText('Tue 18 Aug 10:00')).toBeInTheDocument();

    const noSlot = screen.getByText('No slot yet');
    expect(noSlot).toBeInTheDocument();
    expect(noSlot).toHaveClass('chq-flag');

    const primary = screen.getByRole('button', { name: /Next: choose template/ });
    expect(primary.closest('.chq-comms-select-actions')).not.toBeNull();
  });

  // Ruling B1 (DEC-967 amendment, wave 25): Send moves to step 4, and step
  // 4 post-send is a report ABOUT RECIPIENTS -- headline audience count,
  // then each failed recipient named individually as a row (not a bare
  // <ul> of addresses, and never describeSendResult's sentence as the
  // headline here).
  it('renders no Send control on the preview step, then names sent/total and each failed recipient on step 4', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: {
        sent: 2,
        failed: [{ email: 'bad@example.com', message: 'bounced' }],
        items: [],
      },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByText('Attachments');
    expect(screen.queryByRole('button', { name: /^Send \d+ emails?$/ })).not.toBeInTheDocument();

    const nextToSend = screen.getByRole('button', { name: 'Next: send ›' });
    fireEvent.click(nextToSend);

    const sendButton = await screen.findByRole('button', { name: /^Send \d+ emails?$/ });
    fireEvent.click(sendButton);

    expect(await screen.findByText('2 of 3 speakers were emailed')).toBeInTheDocument();
    expect(screen.getByText('bad@example.com')).toBeInTheDocument();
    expect(screen.getByText('bounced')).toBeInTheDocument();
  });

  it('carries chq-input/chq-textarea on step 2 subject/body and shell classes on its buttons', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    const body = screen.getByLabelText('Body');
    expect(subject).toHaveClass('chq-input');
    expect(body).toHaveClass('chq-textarea');

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toMatch(/chq-/);
    }
  });
});

// DEC-793/DEC-993: the body step's 'Insert a field ▾' control inserts at the
// caret (not appended blindly), and the attachments panel is retitled to
// name only what it actually holds.
describe('ComposeWizard body merge-field menu (DEC-793, DEC-993)', () => {
  async function goToTemplateStep() {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));
    await screen.findByLabelText('Body');
  }

  it('renders one "Insert a field" trigger, not a row of per-field chips', async () => {
    await goToTemplateStep();

    expect(screen.getByRole('button', { name: /Insert a field/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '{speaker_name}' })).not.toBeInTheDocument();
    expect(screen.queryByText('{talk_title}')).not.toBeInTheDocument();
  });

  it('lists every offered token with its sample value once opened', async () => {
    await goToTemplateStep();

    fireEvent.click(screen.getByRole('button', { name: /Insert a field/ }));

    const menu = screen.getByRole('menu', { name: /Insert a field/ });
    const item = within(menu).getByRole('menuitem', { name: '{speaker_name}' });
    expect(within(item).getByText('Marcus Okafor')).toBeInTheDocument();
  });

  it('inserts a chosen merge field at the textarea caret position', async () => {
    await goToTemplateStep();

    const body = screen.getByLabelText('Body') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: 'Hello , see you soon' } });
    body.setSelectionRange(6, 6);

    fireEvent.click(screen.getByRole('button', { name: /Insert a field/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '{speaker_name}' }));

    expect(body.value).toBe('Hello {speaker_name}, see you soon');
  });

  it('Escape closes the menu and returns focus to the trigger', async () => {
    await goToTemplateStep();

    const trigger = screen.getByRole('button', { name: /Insert a field/ });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: /Insert a field/ })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: /Insert a field/ })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('titles the preview-step panel "Attachments" (attachments only)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    expect(await screen.findByText('Attachments')).toBeInTheDocument();
    expect(screen.queryByText('Attachments and merge fields')).not.toBeInTheDocument();
  });
});

// DEC-856: a 400 naming rejected `<contactId>:<submissionId>` recipients
// renders each PERSON's name with EVERY field they're missing (not just the
// first), resolved through the already-loaded submissions' speakers, and the
// banner announces itself via role="alert".
describe('ComposeWizard missing-merge-field errors (DEC-856)', () => {
  it('names both people a preflight rejects, listing every missing field for one of them, in an alert banner', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(
        [
          { ...submission(1) },
          { ...submission(2) },
        ],
        { total: 2, page: 1, perPage: 50 },
      ),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: {
        status: 400,
        body: {
          error: {
            code: 'invalid',
            message: 'One or more recipients are missing merge fields',
            fields: {
              'c1:sub-1': 'missing merge fields: speaker_name, talk_title',
              'c2:sub-2': 'missing merge fields: speaker_name',
            },
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByLabelText('Select Talk number 2'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    expect(await screen.findByText(/Speaker 1.*missing \{speaker_name\}, \{talk_title\}/)).toBeInTheDocument();
    expect(screen.getByText(/Speaker 2.*missing \{speaker_name\}/)).toBeInTheDocument();
    // Gate-8 P0: the refusal announces at the top banner AND repeats at the
    // template step's action row, so a scrolled step never dead-ends.
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((el) => el.classList.contains('chq-error-banner'))).toBe(true);
    expect(alerts.some((el) => el.classList.contains('chq-field-error'))).toBe(true);
  });
});

// DEC-317 amendment (wave 60): the third fields-map refusal shape (a
// submission whose active-invite participants all declined/never accepted)
// must name the blocked sessions, resolved through submissionLabel -- never
// a raw submission id -- exactly like the other two refusal shapes above.
describe('ComposeWizard no-eligible-recipients errors (DEC-317 amendment wave 60)', () => {
  it('names both blocked sessions by REF — title, in an alert banner, with no raw ULID', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(
        [{ ...submission(1) }, { ...submission(2) }],
        { total: 2, page: 1, perPage: 50 },
      ),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: {
        status: 400,
        body: {
          error: {
            code: 'invalid',
            message:
              '2 of 2 selected sessions have no eligible recipients — every speaker on them has declined or has not been invited yet.',
            fields: {
              'sub-1': 'no eligible recipients',
              'sub-2': 'no eligible recipients',
            },
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByLabelText('Select Talk number 2'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    // Gate-8 P0: the refusal may announce at TWO alerts (top banner + the
    // at-control repeat on the template step) — assert on the banner.
    const banner = (await screen.findAllByRole('alert')).find((el) =>
      el.classList.contains('chq-error-banner'),
    )!;
    expect(banner.textContent).toContain('2 of 2 selected sessions have no eligible recipients');
    expect(banner.textContent).toContain('S-001 — Talk number 1');
    expect(banner.textContent).toContain('S-002 — Talk number 2');
    expect(banner.textContent).not.toContain('sub-1');
    expect(banner.textContent).not.toContain('sub-2');
  });
});

// DEC-832: selecting a template copies its text into the composer's own
// fields and clears the selection -- an edit to the body after picking a
// template is what actually gets posted, never the stored template text.
describe('ComposeWizard template selection copies text, edits win (DEC-832)', () => {
  it('posts the edited body (not the stored template text) to compose/preview, and never sends templateId', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-1', eventId: EVENT_ID, name: 'Acceptance', subject: 'You are in', bodyText: 'Original body' },
      ]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const templateSelect = await screen.findByLabelText(/Template/);
    fireEvent.change(templateSelect, { target: { value: 'tpl-1' } });

    // Selecting the template copies its text in and reverts the dropdown
    // to "Write from scratch" (the selection is cleared, DEC-832).
    expect(await screen.findByLabelText('Subject')).toHaveValue('You are in');
    expect(screen.getByLabelText('Body')).toHaveValue('Original body');
    expect(templateSelect).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Edited body wins' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await waitFor(() => {
      const previewCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/preview'));
      expect(previewCalls.length).toBeGreaterThan(0);
      const lastBody = JSON.parse(String(previewCalls[previewCalls.length - 1]?.[1]?.body ?? '{}'));
      expect(lastBody.subject).toBe('You are in');
      expect(lastBody.bodyText).toBe('Edited body wins');
      expect(lastBody.templateId).toBeUndefined();
    });
  });
});

// DEC-682: the "include reviewer feedback" toggle must be paired with a
// plan picker naming exactly which plan+round to attach — never left to the
// server to guess, and never silently omitted from the compose request.
describe('ComposeWizard feedback plan picker (DEC-682)', () => {
  function plan(id: string, name: string, currentRound: number, rounds = 3) {
    return { id, eventId: EVENT_ID, name, openDate: null, closeDate: null, filters: null, anonymized: false, scale: { min: 1, max: 5 }, criteria: [], rounds, currentRound };
  }

  async function goToPreview(fetchMock: ReturnType<typeof mockApi>) {
    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByText('Attachments');
    return fetchMock;
  }

  it('shows a required plan select naming "Round N of <plan name>" once the feedback toggle is on, and hides it while off', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan('plan-a', 'Track A Review', 2)]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    await goToPreview(fetchMock);

    expect(screen.queryByText(/Evaluation plan/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Include reviewer feedback'));

    const select = await screen.findByLabelText('Evaluation plan');
    expect(select).toBeRequired();

    fireEvent.change(select, { target: { value: 'plan-a' } });
    expect(await screen.findByText('Round 2 of Track A Review')).toBeInTheDocument();
  });

  it('sends feedbackPlanId in the compose preview body and re-runs the preview when the plan changes', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan('plan-a', 'Track A Review', 2), plan('plan-b', 'Track B Review', 1)]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    await goToPreview(fetchMock);
    fireEvent.click(screen.getByLabelText('Include reviewer feedback'));
    const select = await screen.findByLabelText('Evaluation plan');

    fireEvent.change(select, { target: { value: 'plan-b' } });
    await screen.findByText('Round 1 of Track B Review');

    await waitFor(() => {
      const previewCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/preview'));
      expect(previewCalls.length).toBeGreaterThan(0);
      const lastBody = JSON.parse(String(previewCalls[previewCalls.length - 1]?.[1]?.body ?? '{}'));
      expect(lastBody.feedbackPlanId).toBe('plan-b');
      expect(lastBody.includeFeedback).toBe(true);
    });
  });
});

// DEC-883: checking "Include reviewer feedback" alone must never fire a
// request (the server 400s includeFeedback without a plan) -- it only
// reveals the plan select and a note; the request fires on the plan choice,
// and unchecking clears the plan and re-previews without feedback.
describe('ComposeWizard include-feedback toggle reachability (DEC-883)', () => {
  function plan(id: string, name: string, currentRound: number, rounds = 3) {
    return { id, eventId: EVENT_ID, name, openDate: null, closeDate: null, filters: null, anonymized: false, scale: { min: 1, max: 5 }, criteria: [], rounds, currentRound };
  }

  async function goToPreview(fetchMock: ReturnType<typeof mockApi>) {
    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByText('Attachments');
    return fetchMock;
  }

  function previewCallCount(fetchMock: ReturnType<typeof mockApi>) {
    return fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/preview')).length;
  }

  it('checking the box with no plan chosen issues zero further preview requests and shows the note', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan('plan-a', 'Track A Review', 2)]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    await goToPreview(fetchMock);
    const before = previewCallCount(fetchMock);

    fireEvent.click(screen.getByLabelText('Include reviewer feedback'));

    expect(await screen.findByText('Choose a plan to merge its feedback.')).toBeInTheDocument();
    expect(previewCallCount(fetchMock)).toBe(before);
  });

  it('choosing a plan issues exactly one preview request', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan('plan-a', 'Track A Review', 2)]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    await goToPreview(fetchMock);
    fireEvent.click(screen.getByLabelText('Include reviewer feedback'));
    await screen.findByText('Choose a plan to merge its feedback.');
    const before = previewCallCount(fetchMock);

    const select = screen.getByLabelText('Evaluation plan');
    fireEvent.change(select, { target: { value: 'plan-a' } });

    await waitFor(() => {
      expect(previewCallCount(fetchMock)).toBe(before + 1);
    });
  });

  it('unchecking the box clears the chosen plan and re-runs the preview without feedback', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan('plan-a', 'Track A Review', 2)]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    await goToPreview(fetchMock);
    fireEvent.click(screen.getByLabelText('Include reviewer feedback'));
    const select = await screen.findByLabelText('Evaluation plan');
    fireEvent.change(select, { target: { value: 'plan-a' } });
    await waitFor(() => expect(previewCallCount(fetchMock)).toBeGreaterThan(0));

    fireEvent.click(screen.getByLabelText('Include reviewer feedback'));

    expect(screen.queryByLabelText('Evaluation plan')).not.toBeInTheDocument();
    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/preview'));
      const last = calls[calls.length - 1];
      const lastBody = JSON.parse(String(last?.[1]?.body ?? '{}'));
      expect(lastBody.includeFeedback).toBe(false);
      expect(lastBody.feedbackPlanId).toBeUndefined();
    });
  });
});

// DEC-846: the composer sends what it shows -- selecting a template only
// prefills subject/bodyText, so an edit made afterward (including a merge
// chip insert) is what actually goes out, and templateId is never sent.
describe('ComposeWizard sends edited body, not the template id (DEC-846)', () => {
  it('posts the edited subject/bodyText after selecting a template, with no templateId', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-1', eventId: EVENT_ID, name: 'Acceptance', subject: 'You are in', bodyText: 'Congrats {speaker_name}' },
      ]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const templateSelect = await screen.findByLabelText(/Template/);
    fireEvent.change(templateSelect, { target: { value: 'tpl-1' } });

    const subject = screen.getByLabelText('Subject') as HTMLInputElement;
    const body = screen.getByLabelText('Body') as HTMLTextAreaElement;
    expect(subject.value).toBe('You are in');
    expect(body.value).toBe('Congrats {speaker_name}');

    // Edit both fields after the template prefill.
    fireEvent.change(subject, { target: { value: 'You are in (edited)' } });
    fireEvent.change(body, { target: { value: 'Congrats {speaker_name}, edited body' } });

    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await waitFor(() => {
      const previewCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/preview'));
      expect(previewCalls.length).toBeGreaterThan(0);
      const lastBody = JSON.parse(String(previewCalls[previewCalls.length - 1]?.[1]?.body ?? '{}'));
      expect(lastBody.templateId).toBeUndefined();
      expect(lastBody.subject).toBe('You are in (edited)');
      expect(lastBody.bodyText).toBe('Congrats {speaker_name}, edited body');
    });
  });
});

// DEC-912: the step-3 recipient row names the talk (ref) and states the
// slot (scheduled), and the flag is unconditional -- rendered whether or
// not "Attach calendar invite" is checked. The frame's list footer reads
// the recipient-cap constant, never a second literal 100.
describe('ComposeWizard recipient rows name the talk and state the slot (DEC-912)', () => {
  function recipient(contactId: string, submissionId: string, name: string, ref: string, scheduled: boolean) {
    return {
      contactId,
      submissionId,
      email: `${contactId}@example.com`,
      name,
      ref,
      scheduled,
      subject: 'You are in!',
      text: 'See you there',
    };
  }

  async function goToPreviewWith(items: ReturnType<typeof recipient>[]) {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByText('Attachments');
  }

  it('renders name on the first line and "<email> · <ref>" on the second, with the scheduled flag ungated', async () => {
    await goToPreviewWith([
      recipient('c1', 'sub-1', 'Priya Raman', 'DFC-014', true),
      recipient('c2', 'sub-2', 'Nadia Ferrone', 'DFC-041', false),
    ]);

    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('c1@example.com · DFC-014')).toBeInTheDocument();
    expect(screen.getByText('Nadia Ferrone')).toBeInTheDocument();
    expect(screen.getByText('c2@example.com · DFC-041')).toBeInTheDocument();

    // Both flags render even though "Attach calendar invite" was never
    // checked -- DEC-912's flag is unconditional. Scope to the recipient
    // rows: the PreviewPane's own To-line flag (also ungated, DEC-912)
    // would otherwise also match "Scheduled".
    const row = screen.getByText('Priya Raman').closest('.chq-comms-recipient-row');
    expect(row).not.toBeNull();
    expect(row!.querySelector('.chq-flag')?.textContent).toBe('Scheduled');
    const otherRow = screen.getByText('Nadia Ferrone').closest('.chq-comms-recipient-row');
    expect(otherRow!.querySelector('.chq-flag')?.textContent).toBe('No slot yet');
  });

  it('shows the flag unchanged after toggling Attach calendar invite on', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: () => ({
        items: [recipient('c1', 'sub-1', 'Priya Raman', 'DFC-014', true)],
      }),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));
    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByText('Priya Raman');
    const rowFlag = () => screen.getByText('Priya Raman').closest('.chq-comms-recipient-row')!.querySelector('.chq-flag');
    expect(rowFlag()?.textContent).toBe('Scheduled');

    fireEvent.click(screen.getByLabelText('Attach calendar invite'));

    await waitFor(() => expect(rowFlag()?.textContent).toBe('Scheduled'));
  });

  it('reads the recipient cap from the shared constant: "under" below the cap, "at" at the cap', async () => {
    const under = Array.from({ length: 3 }, (_, i) => recipient(`c${i}`, `sub-${i}`, `Speaker ${i}`, `DFC-0${i}`, true));
    await goToPreviewWith(under);
    expect(screen.getByText(/3 is under the 100-recipient cap/)).toBeInTheDocument();
  });

  it('switches to "at the cap" wording when total meets the cap', async () => {
    const atCap = Array.from({ length: 100 }, (_, i) => recipient(`c${i}`, `sub-${i}`, `Speaker ${i}`, `DFC-0${i}`, true));
    await goToPreviewWith(atCap);
    expect(screen.getByText(/100 is at the 100-recipient cap/)).toBeInTheDocument();
  });
});

// Ruling B1 (DEC-967 amendment, wave 25): Send moves to step 4 -- the
// preview step's primary only advances ("Next: send ›"); step 4 pre-send IS
// the one confirmation the batch gets before it leaves, so click depth is
// unchanged even though the standalone ConfirmDialog is gone.
describe('ComposeWizard: Send moves to step 4 (ruling B1)', () => {
  function recipient(contactId: string, submissionId: string, name: string, ref: string, scheduled: boolean) {
    return {
      contactId,
      submissionId,
      email: `${contactId}@example.com`,
      name,
      ref,
      scheduled,
      subject: 'You are in!',
      text: 'See you there',
    };
  }

  async function goToPreviewWith(fetchMock: ReturnType<typeof mockApi>) {
    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByText('Priya Raman');
    return fetchMock;
  }

  function sendCallCount(fetchMock: ReturnType<typeof mockApi>) {
    return fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/send')).length;
  }

  it('issues no POST to compose/send until step 4\'s own Send primary is clicked', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [recipient('c1', 'sub-1', 'Priya Raman', 'DFC-014', true)] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: { sent: 1, failed: [] },
    });

    await goToPreviewWith(fetchMock);

    expect(screen.queryByRole('button', { name: /^Send \d+ emails?$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));

    const step4Send = await screen.findByRole('button', { name: /^Send \d+ emails?$/ });
    expect(sendCallCount(fetchMock)).toBe(0);

    fireEvent.click(step4Send);

    await waitFor(() => expect(sendCallCount(fetchMock)).toBe(1));
  });

  it('names the recipient count and resolved subject on step 4 before sending', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [recipient('c1', 'sub-1', 'Priya Raman', 'DFC-014', true)] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: { sent: 1, failed: [] },
    });

    await goToPreviewWith(fetchMock);
    fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));

    expect(await screen.findByText(/1 recipient.*You are in!/)).toBeInTheDocument();
    expect(sendCallCount(fetchMock)).toBe(0);
  });
});

// DEC-238 amendment (wave 3): step 4's post-send report states the ruling's
// three plain lines (sent/skipped/remaining) and, when the dedupe window
// held any recipient back, names each one with its retry time -- never a
// silent narrowing and never a 'send anyway' control (foreclosed this
// wave).
describe('ComposeWizard skipped (already-sent-recently) report (DEC-238 amendment)', () => {
  it('renders the three-line report and names both skipped recipients with their retry times', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: {
        sent: 1,
        failed: [],
        skipped: [
          {
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            submissionId: 'sub-1',
            reason: 'already_sent_recently',
            retryAtIso: '2026-08-15T13:00:00.000Z',
          },
          {
            email: 'grace@example.com',
            name: 'Grace Hopper',
            submissionId: 'sub-2',
            reason: 'already_sent_recently',
            retryAtIso: '2026-08-15T14:30:00.000Z',
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByText('Attachments');
    fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));

    const sendButton = await screen.findByRole('button', { name: /^Send \d+ emails?$/ });
    fireEvent.click(sendButton);

    await screen.findByText(/1 of 1 speakers were emailed/);

    // DEC-238 amendment (findings wave 5): the interim counts paragraph is
    // gone -- sent lives in the headline, skipped in its own named section.
    expect(document.querySelector('.chq-comms-send-report-counts')).toBeNull();
    expect(screen.getByText('Two were skipped')).toBeInTheDocument();
    expect(screen.getByText('Nothing was sent to these two')).toBeInTheDocument();

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('grace@example.com')).toBeInTheDocument();
    // The retry action is derived from the server's own retryAtIso.
    expect(screen.getAllByText(/^Send in \d+ minutes?$/).length).toBe(2);
    expect(
      screen.getByText(/The dedupe window stops a speaker being emailed twice in an hour/),
    ).toBeInTheDocument();
    // No 'send anyway' override control this wave (ruling item 4).
    expect(screen.queryByRole('button', { name: /send anyway/i })).not.toBeInTheDocument();
  });

  it('renders a duplicate_in_batch skip with the batch-specific copy and no retry line (DEC-238 wave-15 amendment)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: {
        sent: 1,
        failed: [],
        skipped: [
          {
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            submissionId: 'sub-1',
            reason: 'duplicate_in_batch',
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByText('Attachments');
    fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));

    const sendButton = await screen.findByRole('button', { name: /^Send \d+ emails?$/ });
    fireEvent.click(sendButton);

    await screen.findByText(/1 of 1 speakers were emailed/);

    expect(screen.getByText('Same message, same address, already in this batch.')).toBeInTheDocument();
    expect(screen.queryByText(/^Send in \d+ minutes?$/)).not.toBeInTheDocument();
  });

  it('reports zero skipped and renders no skipped list when the server has not landed the field yet', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: { sent: 1, failed: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByText('Attachments');
    fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));

    const sendButton = await screen.findByRole('button', { name: /^Send \d+ emails?$/ });
    fireEvent.click(sendButton);

    await screen.findByText(/1 of 1 speakers were emailed/);

    expect(document.querySelector('.chq-comms-send-report-counts')).toBeNull();
    expect(document.querySelector('.chq-comms-send-report-skipped')).toBeNull();
    expect(screen.queryByText(/already sent within the hour/)).not.toBeInTheDocument();
  });
});

// DEC-238 amendment (findings wave 5): step 4 becomes the framed send
// REPORT (docs/design/Chautauqua Comms.dc.html :495-536) -- eyebrow +
// headline + "All history" on one row, a TEMPLATE / SUBJECT THEY SAW / SENT
// definition grid, and a footer pairing "Compose another" with a "Back to
// Comms" link.
describe('ComposeWizard send report frame (DEC-238 amendment, findings wave 5)', () => {
  async function sendAndReachReport() {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: { sent: 1, failed: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello there' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByText('Attachments');
    fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));

    const sendButton = await screen.findByRole('button', { name: /^Send \d+ emails?$/ });
    fireEvent.click(sendButton);

    await screen.findByText('1 of 1 speakers were emailed');
  }

  it('renders the eyebrow + headline + All history row', async () => {
    await sendAndReachReport();

    expect(screen.getByText('Send complete')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 of 1 speakers were emailed' })).toBeInTheDocument();
    const historyLink = screen.getByRole('link', { name: /All history/ });
    // DEC-834 / DEC-837: basename-relative target (the router's basename is
    // already '/admin'), so it renders without the prefix here.
    expect(historyLink).toHaveAttribute('href', '/comms?tab=history');
  });

  it('renders the Template / Subject they saw / Sent definition grid', async () => {
    await sendAndReachReport();

    const grid = document.querySelector('.chq-comms-send-report-grid');
    expect(grid).not.toBeNull();
    expect(within(grid as HTMLElement).getByText('Template')).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText('No template')).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText('Subject they saw')).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText('Hello there')).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText('Sent')).toBeInTheDocument();
    // No from-address the client holds -- never invented/hard-coded.
    expect(within(grid as HTMLElement).getByText('Just now, by you')).toBeInTheDocument();
  });

  it('renders both footer controls: Compose another and Back to Comms', async () => {
    await sendAndReachReport();

    expect(screen.getByText(/All 1 are in History, each with the address it went to/)).toBeInTheDocument();
    const composeAnother = screen.getByRole('button', { name: 'Compose another' });
    expect(composeAnother).toHaveClass('chq-btn-secondary');
    const backToComms = screen.getByRole('link', { name: 'Back to Comms' });
    expect(backToComms).toHaveAttribute('href', '/comms');
    expect(backToComms).toHaveClass('chq-btn-primary');
  });

  it('Compose another resets the wizard back to step 1', async () => {
    await sendAndReachReport();

    fireEvent.click(screen.getByRole('button', { name: 'Compose another' }));

    expect(await screen.findByText('1. Pick submissions')).toBeInTheDocument();
  });
});

// w27-d: DEC-954 -- the no-slot caption reads `scheduled` (populated on
// every row) instead of the ICS-gated `ics` field, which only exists when
// the server actually ran the preflight for that particular preview call;
// a Send blocked banner disables Send instead of merely floating over it;
// and the banner names rows by ref/name, not raw ids.
describe('ComposeWizard ICS slot predicate and blocked-send (DEC-954)', () => {
  function recipient(contactId: string, submissionId: string, name: string, ref: string, scheduled: boolean) {
    return {
      contactId,
      submissionId,
      email: `${contactId}@example.com`,
      name,
      ref,
      scheduled,
      subject: 'You are in!',
      text: 'See you there',
    };
  }

  async function goToPreviewWith(items: ReturnType<typeof recipient>[], extra: Record<string, unknown> = {}) {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items },
      ...extra,
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByText('Attachments');
  }

  it('rows print "Scheduled" and the no-slot caption is absent when scheduled is true but ics was never sent', async () => {
    await goToPreviewWith([
      recipient('c1', 'sub-1', 'Priya Raman', 'DFC-014', true),
      recipient('c2', 'sub-2', 'Nadia Ferrone', 'DFC-041', true),
    ]);

    expect(document.querySelectorAll('.chq-comms-recipient-row .chq-flag')).toHaveLength(2);
    for (const flag of document.querySelectorAll('.chq-comms-recipient-row .chq-flag')) {
      expect(flag.textContent).toBe('Scheduled');
    }

    fireEvent.click(screen.getByLabelText('Attach calendar invite'));

    // Re-run of preview keeps every row scheduled -- no slotless caption.
    await waitFor(() => expect(screen.getAllByText('Scheduled').length).toBeGreaterThan(0));
    expect(screen.queryByText(/have no slot yet/)).not.toBeInTheDocument();
  });

  it('disables Send while a Send-blocked banner is showing, naming a talk ref rather than the raw id', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: (() => {
        let call = 0;
        return () => {
          call += 1;
          if (call === 1) return { items: [recipient('c1', 'sub-1', 'Priya Raman', 'DFC-014', false)] };
          return {
            status: 400,
            body: {
              error: {
                code: 'invalid',
                message: 'Some submissions are not scheduled',
                fields: { 'sub-1': 'not scheduled' },
              },
            },
          };
        };
      })(),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByText('Priya Raman');

    fireEvent.click(screen.getByLabelText('Attach calendar invite'));

    // Gate-8 P0: the refusal may announce at TWO alerts (top banner + the
    // at-control repeat on the template step) — assert on the banner.
    const banner = (await screen.findAllByRole('alert')).find((el) =>
      el.classList.contains('chq-error-banner'),
    )!;
    expect(banner.textContent).toContain('DFC-014 — Priya Raman');
    expect(banner.textContent).not.toContain('sub-1');

    // Ruling B1: Send itself now lives on step 4 -- the hard block disables
    // the preview step's own primary ("Next: send ›") instead, so a blocked
    // batch can't even reach the step-4 confirmation.
    const nextToSend = screen.getByRole('button', { name: 'Next: send ›' });
    expect(nextToSend).toBeDisabled();
  });
});

// w27-d: DEC-955 -- typing {feedback} into the body reveals an inline plan
// picker naming what {feedback} needs, right where the chip was inserted,
// so composeBody() carries includeFeedback+feedbackPlanId before the
// preview ever runs; with no plans configured the {feedback} chip itself is
// omitted from the chip row.
describe('ComposeWizard {feedback} companion plan picker (DEC-955)', () => {
  function plan(id: string, name: string, currentRound: number, rounds = 3) {
    return { id, eventId: EVENT_ID, name, openDate: null, closeDate: null, filters: null, anonymized: false, scale: { min: 1, max: 5 }, criteria: [], rounds, currentRound };
  }

  async function goToTemplateStep(extra: Record<string, unknown> = {}) {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      ...extra,
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));
    await screen.findByLabelText('Body');
  }

  it('reveals a plan picker naming "{feedback} needs a plan" once {feedback} is inserted, and posts includeFeedback+feedbackPlanId on preview', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan('plan-a', 'Track A Review', 2)]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));
    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });

    expect(screen.queryByText('{feedback} needs a plan')).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /Insert a field/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '{feedback}' }));

    const picker = await screen.findByLabelText('{feedback} needs a plan');
    expect(picker).toBeInTheDocument();

    fireEvent.change(picker, { target: { value: 'plan-a' } });

    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await waitFor(() => {
      const previewCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/preview'));
      expect(previewCalls.length).toBeGreaterThan(0);
      const lastBody = JSON.parse(String(previewCalls[previewCalls.length - 1]?.[1]?.body ?? '{}'));
      expect(lastBody.includeFeedback).toBe(true);
      expect(lastBody.feedbackPlanId).toBe('plan-a');
    });
  });

  it('omits the {feedback} token entirely when no evaluation plans exist', async () => {
    await goToTemplateStep({ [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([]) });

    fireEvent.click(screen.getByRole('button', { name: /Insert a field/ }));

    expect(screen.queryByRole('menuitem', { name: '{feedback}' })).not.toBeInTheDocument();
  });
});

// Step-1 seam line: the selection already survives filter changes (DEC-350)
// -- the selection bar (DEC-350 amendment, ruling A1) carries the same fact,
// but only renders once the selection is non-empty.
describe('ComposeWizard step-1 selection-survives-filters seam line', () => {
  it('renders the live selection count against the recipient cap, hidden while nothing is selected', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');

    expect(screen.queryByText(/Kept as you change filters/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select Talk number 1'));

    expect(screen.getByText(/Kept as you change filters · 1 is under the 100-recipient cap/)).toBeInTheDocument();
  });
});

// Ruling A18: the evaluation-plan select is "Include reviewer feedback"'s
// own parameter -- absent until the checkbox is checked, and indented
// under it with a caption naming what gets merged.
describe('ComposeWizard evaluation-plan select is a parameter of Include reviewer feedback (ruling A18)', () => {
  function plan(id: string, name: string, currentRound: number, rounds = 3) {
    return { id, eventId: EVENT_ID, name, openDate: null, closeDate: null, filters: null, anonymized: false, scale: { min: 1, max: 5 }, criteria: [], rounds, currentRound };
  }

  it('is absent until Include reviewer feedback is checked, then appears indented with its caption', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan('plan-a', 'Track A Review', 2)]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByText('Attachments');

    expect(screen.queryByLabelText('Evaluation plan')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Include reviewer feedback'));

    const select = await screen.findByLabelText('Evaluation plan');
    expect(select.closest('.chq-comms-panel-indent')).not.toBeNull();
    expect(screen.getByText('Only submitted, non-recused reviews are merged.')).toBeInTheDocument();
  });
});

// DEC-793 amendment (wave 28): the blocked banner offers a partial exit --
// "Send to the N who have a slot" actually shrinks the posted submissionIds
// (never a silent narrowing), each named blocked recipient gets its own
// "Place on the agenda" way out, and both banners carry the "cheap to fix"
// caption.
describe('ComposeWizard partial-send way out on the blocked banner (DEC-793 amendment)', () => {
  function recipient(contactId: string, submissionId: string, name: string, ref: string, scheduled: boolean) {
    return {
      contactId,
      submissionId,
      email: `${contactId}@example.com`,
      name,
      ref,
      scheduled,
      subject: 'You are in!',
      text: 'See you there',
    };
  }

  it('offers "Send to the 1 who have a slot", names each blocked recipient with an agenda link, and sends only the scheduled subset with a reduced-count report', async () => {
    const previewItems = [
      recipient('c1', 'sub-1', 'Priya Raman', 'DFC-014', false),
      recipient('c2', 'sub-2', 'Nadia Ferrone', 'DFC-041', false),
      recipient('c3', 'sub-3', 'Owen Clarke', 'DFC-052', true),
    ];

    let previewCall = 0;
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: () => {
        previewCall += 1;
        if (previewCall === 1) return { items: previewItems };
        return {
          status: 400,
          body: {
            error: {
              code: 'invalid',
              message: 'Some submissions are not scheduled',
              fields: { 'sub-1': 'not scheduled', 'sub-2': 'not scheduled' },
            },
          },
        };
      },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: { sent: 1, failed: [], items: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByLabelText('Select Talk number 2'));
    fireEvent.click(screen.getByLabelText('Select Talk number 3'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByText('Priya Raman');

    fireEvent.click(screen.getByLabelText('Attach calendar invite'));

    // Gate-8 P0: the refusal may announce at TWO alerts (top banner + the
    // at-control repeat on the template step) — assert on the banner.
    const banner = (await screen.findAllByRole('alert')).find((el) =>
      el.classList.contains('chq-error-banner'),
    )!;
    expect(banner.textContent).toContain('DFC-014 — Priya Raman');
    expect(banner.textContent).toContain('DFC-041 — Nadia Ferrone');

    // Way out: one agenda link per named blocked recipient.
    const agendaLinks = within(banner).getAllByRole('link', { name: /Place on the agenda/ });
    expect(agendaLinks).toHaveLength(2);
    for (const link of agendaLinks) {
      expect(link).toHaveAttribute('href', '/agenda');
    }

    // The last-cheap-to-fix caption.
    expect(within(banner).getByText('This is the last point at which it is cheap to fix.')).toBeInTheDocument();

    // Partial action names the scheduled subset (3 - 2 = 1).
    const partialButton = within(banner).getByRole('button', { name: 'Send to the 1 who have a slot' });
    fireEvent.click(partialButton);

    await waitFor(() => {
      const sendCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/send'));
      expect(sendCalls.length).toBe(1);
      const body = JSON.parse(String(sendCalls[0]?.[1]?.body ?? '{}'));
      expect(body.submissionIds).toEqual(['sub-3']);
    });

    // Step 4 report: reduced count in the headline, excluded recipients
    // named under their own heading -- never a silent shrink.
    expect(await screen.findByText('1 of 1 speakers were emailed — 2 excluded (not yet scheduled)')).toBeInTheDocument();
    expect(screen.getByText('Excluded (2 not yet scheduled):')).toBeInTheDocument();
    expect(screen.getByText('DFC-014 — Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('DFC-041 — Nadia Ferrone')).toBeInTheDocument();
  });
});

// w12-c's auto-apply is REMOVED (user ruling, gate-9): an eval turn-diet
// must never degrade the real product — silently pre-filling the composer
// made "Write from scratch" lie. Step 2 arrives BLANK (ruling A19's own
// default); Enter-advance keeps working; step 4's Send stays click-only.
describe('ComposeWizard turn diet (w12-c, DEC-967 amendment)', () => {
  it('arrives at step 2 with a BLANK composer, no auto-apply disclosure, and Next disabled', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-1', eventId: EVENT_ID, name: 'Acceptance', subject: 'You are in', bodyText: 'Congrats {speaker_name}' },
        { id: 'tpl-2', eventId: EVENT_ID, name: 'Waitlist', subject: 'Waitlisted', bodyText: 'Still waitlisted' },
      ]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    expect(subject).toHaveValue('');
    expect(screen.getByLabelText('Body')).toHaveValue('');
    expect(screen.queryByText(/Applied .* automatically/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: preview' })).toBeDisabled();
    // Picking a template is one explicit select — then Next enables.
    fireEvent.change(screen.getByLabelText(/^Template/), { target: { value: 'tpl-1' } });
    await waitFor(() => expect(subject).toHaveValue('You are in'));
    expect(screen.getByRole('button', { name: 'Next: preview' })).not.toBeDisabled();
  });

  it('leaves the composer blank with Next disabled when there are zero templates', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    expect(subject).toHaveValue('');
    expect(screen.getByLabelText('Body')).toHaveValue('');
    expect(screen.queryByText(/Applied .* automatically/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: preview' })).toBeDisabled();
  });

  it('Enter on step 2 (subject field) reaches the preview step', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-1', eventId: EVENT_ID, name: 'Acceptance', subject: 'You are in', bodyText: 'Congrats {speaker_name}' },
      ]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(screen.getByLabelText(/^Template/), { target: { value: 'tpl-1' } });
    await waitFor(() => expect(subject).toHaveValue('You are in'));

    fireEvent.keyDown(subject, { key: 'Enter' });

    expect(await screen.findByText('Attachments')).toBeInTheDocument();
  });

  it('Enter on step 4 does NOT send -- a deliberate send stays a deliberate click', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
        { id: 'tpl-1', eventId: EVENT_ID, name: 'Acceptance', subject: 'You are in', bodyText: 'Congrats {speaker_name}' },
      ]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: { sent: 0, failed: [] },
    });

    render(
      <MemoryRouter>
        <ComposeWizard eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));
    fireEvent.change(await screen.findByLabelText(/^Template/), { target: { value: 'tpl-1' } });
    await waitFor(() => expect(screen.getByLabelText('Subject')).toHaveValue('You are in'));
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    await screen.findByText('Attachments');
    fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));

    const sendButton = await screen.findByRole('button', { name: /^Send \d+ emails?$/ });
    fireEvent.keyDown(sendButton, { key: 'Enter' });

    const sendCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/compose/send'));
    expect(sendCalls.length).toBe(0);
  });
});
