// DEC-350 layer-2 harness for the J5 compose recipient picker
// (app/src/pages/comms/ComposeWizard.tsx): the picker must be server-paged
// and searchable, exactly like the onboarding grid (DEC-340) and the
// submissions worklist (DEC-341) — no client-side filter/sort over a single
// fetched page, and selection must span pages.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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

    render(<ComposeWizard eventId={EVENT_ID} />);

    expect(await screen.findByText('Talk number 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 1-50 of 340')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('requests page=2 when Next is clicked', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: () => listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

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

    render(<ComposeWizard eventId={EVENT_ID} />);

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

    render(<ComposeWizard eventId={EVENT_ID} />);

    await screen.findByText('Talk number 1');
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'testing' } });

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(urls.some((u) => u.includes('/submissions') && u.includes('q=testing'))).toBe(true);
      const last = urls.filter((u) => u.includes('/submissions')).pop()!;
      expect(/[?&]page=1\b/.test(last) || !/[?&]page=/.test(last)).toBe(true);
    });
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

    render(<ComposeWizard eventId={EVENT_ID} />);

    await screen.findByText('Talk number 1');

    const table = document.querySelector('table');
    expect(table).not.toBeNull();
    expect(table).toHaveClass('chq-table');
    expect(table).toHaveClass('chq-comms-compose-table');

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toMatch(/chq-/);
    }
  });

  // DEC-677: the compose send step renders the server's SendResult through
  // describeSendResult (one reporter), not a hand-built "Sent N" sentence,
  // and lists the failed addresses the server already reports.
  it('renders one sentence naming sent and failed counts, and lists the failed address', async () => {
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

    render(<ComposeWizard eventId={EVENT_ID} />);

    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    const sendButton = await screen.findByRole('button', { name: /Send \d+ emails?/ });
    fireEvent.click(sendButton);
    const confirmDialog = await screen.findByRole('dialog', { name: 'Send this email?' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /Send \d+ emails?/ }));

    expect(await screen.findByText('Sent to 2 emails. 1 failure.')).toBeInTheDocument();
    expect(screen.getByText('bad@example.com')).toBeInTheDocument();
  });

  it('carries chq-input/chq-textarea on step 2 subject/body and shell classes on its buttons', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(<ComposeWizard eventId={EVENT_ID} />);

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

    render(<ComposeWizard eventId={EVENT_ID} />);

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

    render(<ComposeWizard eventId={EVENT_ID} />);

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

    render(<ComposeWizard eventId={EVENT_ID} />);

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
    expect(screen.getByRole('alert')).toBeInTheDocument();
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

    render(<ComposeWizard eventId={EVENT_ID} />);

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
    render(<ComposeWizard eventId={EVENT_ID} />);
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
    render(<ComposeWizard eventId={EVENT_ID} />);
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

    render(<ComposeWizard eventId={EVENT_ID} />);

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

    render(<ComposeWizard eventId={EVENT_ID} />);
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

    render(<ComposeWizard eventId={EVENT_ID} />);
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

// DEC-967: an email batch asks once before it leaves -- the preview step's
// Send button opens the shared ConfirmDialog instead of posting directly.
describe('ComposeWizard confirms before sending (DEC-967)', () => {
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
    render(<ComposeWizard eventId={EVENT_ID} />);
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

  it('issues no POST to compose/send until the confirm dialog is confirmed, and names the recipient count', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [recipient('c1', 'sub-1', 'Priya Raman', 'DFC-014', true)] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: { sent: 1, failed: [] },
    });

    await goToPreviewWith(fetchMock);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Send \d+ emails?/ }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('1 recipient');
    expect(sendCallCount(fetchMock)).toBe(0);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Send 1 email' }));

    await waitFor(() => expect(sendCallCount(fetchMock)).toBe(1));
  });

  it('Cancel leaves the wizard on the preview step with zero requests to compose/send', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: [recipient('c1', 'sub-1', 'Priya Raman', 'DFC-014', true)] },
      [`POST /api/v1/events/${EVENT_ID}/compose/send`]: { sent: 1, failed: [] },
    });

    await goToPreviewWith(fetchMock);
    fireEvent.click(screen.getByRole('button', { name: /Send \d+ emails?/ }));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    expect(sendCallCount(fetchMock)).toBe(0);
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

    render(<ComposeWizard eventId={EVENT_ID} />);
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

    render(<ComposeWizard eventId={EVENT_ID} />);
    await screen.findByText('Talk number 1');
    fireEvent.click(screen.getByLabelText('Select Talk number 1'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByText('Priya Raman');

    fireEvent.click(screen.getByLabelText('Attach calendar invite'));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('DFC-014 — Priya Raman');
    expect(banner.textContent).not.toContain('sub-1');

    const sendButton = screen.getByRole('button', { name: /Send \d+ emails?/ });
    expect(sendButton).toBeDisabled();
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

    render(<ComposeWizard eventId={EVENT_ID} />);
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

    render(<ComposeWizard eventId={EVENT_ID} />);
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
