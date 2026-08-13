// DEC-350 layer-2 harness for the J5 compose recipient picker
// (app/src/pages/comms/ComposeWizard.tsx): the picker must be server-paged
// and searchable, exactly like the onboarding grid (DEC-340) and the
// submissions worklist (DEC-341) — no client-side filter/sort over a single
// fetched page, and selection must span pages.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// DEC-793: the body step's merge-field chip row inserts at the caret (not
// appended blindly), and the attachments panel is retitled to name only
// what it actually holds.
describe('ComposeWizard body merge-field chips (DEC-793)', () => {
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

  it('inserts a clicked merge-field chip at the textarea caret position', async () => {
    await goToTemplateStep();

    const body = screen.getByLabelText('Body') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: 'Hello , see you soon' } });
    body.setSelectionRange(6, 6);

    fireEvent.click(screen.getByRole('button', { name: '{speaker_name}' }));

    expect(body.value).toBe('Hello {speaker_name}, see you soon');
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

    const templateSelect = await screen.findByLabelText('Template');
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

    const templateSelect = await screen.findByLabelText('Template');
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
