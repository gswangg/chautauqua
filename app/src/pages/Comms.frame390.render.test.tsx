// w30-e (DEC-976, DEC-385): COMMS 390 LANDING frame verdict. The sibling
// receipt file, Comms.frame-verdicts.render.test.tsx (w14-sa/w15-ti), pins
// the phone landing's structural composition (title, draft-card SLOT,
// "Recent sends" band) against the no-draft empty state. That file is owned
// by another lane and is never edited here (task file-ownership rule) --
// this file is a NARROWER, additive receipt for the ground that sibling
// deliberately leaves ungraded: the send-rhythm SUBTITLE's shape (:184),
// the no-sends branch (:352), the POPULATED "Draft in progress" card
// (:189-193, the sibling only exercises the empty-state branch), and the
// "Recent sends" row template's shape + DEC-751 four-row cap (:196-203).
// Modelled on the same harness shape Comms.frame-verdicts.render.test.tsx
// and Settings.frame-verdicts.render.test.tsx use: real route (MemoryRouter
// + CommsPage, DEC-710 ?tab=), never a sub-component mounted directly.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { CommsPage } from './Comms';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import { resetEventsCacheForTests, resetInitialStoredIdForTests } from '../lib/useCurrentEvent';
import { writeComposeDraft } from './comms/composeDraft';
import { DEC_976, DEC_385 } from '../../../src/decisions';

void DEC_976; // this file's whole job is a frame verdict (DEC-976)
void DEC_385; // fix rule scope: comms.css terminal block / Comms.tsx markup only (DEC-385 wave-30 amendment)

// w15-ti (DEC-919 wave-159) pattern, copied verbatim from the sibling file:
// jsdom implements no matchMedia at all, so seeing the phone landing MOUNT
// requires stubbing it the same way PipelineBoard.render.test.tsx does.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Comms.dc.html');

/** DEC-967 shape, copied from the sibling file's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-comms-frame390';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
  resetEventsCacheForTests();
  resetInitialStoredIdForTests();
});

// mockApi keys strip the query string before matching (app/src/test-utils/
// mockApi.ts), so Comms.tsx's three distinct `.../email-log` requests
// (groupBy=batch; since=&status=sent; since=&status=failed) all resolve
// through this ONE registered route -- exactly the sibling receipt file's
// own `mockCommsEndpoints` shape. `total` (default `batches.length`) is
// therefore both the batch-list length AND every rhythm total.
function mockCommsEndpoints(batches: Array<Record<string, unknown>>) {
  mockApi({
    'GET /api/v1/events': listEnvelope([
      { id: EVENT_ID, slug: 'devflow-2027', name: 'DevFlow Conf 2027' },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope(batches),
    [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
      { id: 'tmpl-accept', eventId: EVENT_ID, name: 'Acceptance', subject: 'Your talk has been accepted to {event_name}', bodyText: 'Hi {speaker_name}.', lastUsedAt: null },
    ]),
  });
}

function renderLanding(batches: Array<Record<string, unknown>>) {
  mockCommsEndpoints(batches);
  stubPhoneMatchMedia();
  return render(
    <MemoryRouter initialEntries={['/comms']}>
      <CommsPage />
    </MemoryRouter>,
  );
}

const FIVE_BATCHES: Array<{ batchKey: string; subject: string; sentAt: number; statusCounts: { sent: number }; templateId: string | null }> = [
  { batchKey: 'b5', subject: 'Reminder: submit your slides', sentAt: Date.parse('2026-08-18T16:12:00Z'), statusCounts: { sent: 12 }, templateId: null },
  { batchKey: 'b4', subject: 'Schedule change notice', sentAt: Date.parse('2026-08-17T10:00:00Z'), statusCounts: { sent: 8 }, templateId: 'tmpl-accept' },
  { batchKey: 'b3', subject: 'Welcome pack', sentAt: Date.parse('2026-08-16T09:00:00Z'), statusCounts: { sent: 4 }, templateId: null },
  { batchKey: 'b2', subject: 'Travel details', sentAt: Date.parse('2026-08-15T09:00:00Z'), statusCounts: { sent: 3 }, templateId: null },
  { batchKey: 'b1', subject: 'Your talk has been accepted to DevFlow Conf 2027', sentAt: Date.parse('2026-08-11T16:12:00Z'), statusCounts: { sent: 23 }, templateId: 'tmpl-accept' },
];
const [FIRST_BATCH] = FIVE_BATCHES;
if (FIRST_BATCH === undefined) throw new Error('FIVE_BATCHES must be non-empty');
const FIRST_BATCH_SUBJECT = FIRST_BATCH.subject;

describe('COMMS 390 landing frame verdict (w30-e, DEC-976, DEC-621)', () => {
  // Frame :180/:184 -- wordmark + event-name row and the phone
  // send-rhythm subtitle share the head band. The wordmark/event-name
  // row is shell chrome (App.tsx's <header>, .chq-wordmark), never
  // duplicated by the page itself -- CommsPage mounted alone renders no
  // "chautauqua" wordmark text.
  it('frame :180 wordmark/event-name row is shell chrome, not re-rendered by CommsPage', async () => {
    verbatimLine(
      180,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.03em; line-height:1; position:relative; top:-2.5px">chautauqua</span>',
    );
    renderLanding(FIVE_BATCHES);
    await waitFor(() => expect(screen.getAllByText(FIRST_BATCH_SUBJECT).length).toBeGreaterThan(0));
    expect(screen.queryByText('chautauqua')).not.toBeInTheDocument();
  });

  // Frame :184 `4 sent in 7 days · last Tue 4:12pm`. Comms.tsx:433 renders
  // `formatPhoneSendRhythm(rhythm)` into a `<p>` (never a second `<h1>` --
  // pinned by tagName below, matching the file's own :421 doc comment) as
  // `.chq-comms-phone-landing-subtitle`. Graded by SHAPE (seeded numbers
  // and dates are sample data, DEC-967).
  it('frame :184 phone send-rhythm subtitle -- shape "N sent in 7 days · last <when>", a <p> not a second <h1>', async () => {
    verbatimLine(184, '        <span style="font-size:13px; color:#565A4B">4 sent in 7 days · last Tue 4:12pm</span>');
    renderLanding(FIVE_BATCHES);
    let subtitle: Element | null = null;
    await waitFor(() => {
      subtitle = document.querySelector('.chq-comms-phone-landing-subtitle');
      expect(subtitle).not.toBeNull();
    });
    expect((subtitle as unknown as HTMLElement).tagName).toBe('P');
    expect((subtitle as unknown as HTMLElement).textContent).toMatch(/^\d+ sent in 7 days · last .+$/);
  });

  // Frame :184's no-sends complement: Comms.tsx:352 (DEC-380 wave-140) is
  // the head's OWN branch, shared regardless of phone/desktop -- with
  // recentBatches empty AND both seven-day totals zero, the head's
  // `.chq-comms-head-subtitle` reads "No sends on this event" verbatim
  // instead of the rhythm sentence.
  it('frame :184 no-sends branch -- .chq-comms-head-subtitle reads "No sends on this event"', async () => {
    mockCommsEndpoints([]);
    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
      </MemoryRouter>,
    );
    const subtitle = await screen.findByText('No sends on this event');
    expect(subtitle).toHaveClass('chq-comms-head-subtitle');
  });

  // Frame :189-193 "Draft in progress" card, POPULATED branch -- the
  // sibling receipt file only exercises the no-draft empty-state branch
  // (a "Compose" entry control, DEC-621 wave-109 amendment). Here a real
  // composeDraft.ts record is seeded (DEC-621 wave-87 amendment) so the
  // frame's actual drawn card renders: eyebrow, subject, recipients line,
  // the honesty note, and the "Read the draft" control.
  it('frame :189-193 Draft in progress card (populated) -- eyebrow, subject, recipients line, honesty note, Read the draft control', async () => {
    verbatimLine(
      189,
      '          <span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Draft in progress</span>',
    );
    verbatimLine(
      192,
      '          <span style="font-size:13px; line-height:1.55; color:#3F4237">Better on a laptop</span>',
    );
    writeComposeDraft(EVENT_ID, {
      templateName: 'Acceptance',
      subject: 'Your talk has been accepted to DevFlow Conf 2027',
      recipientCount: 23,
      updatedAt: Date.now(),
    });
    renderLanding(FIVE_BATCHES);
    await waitFor(() => {
      expect(document.querySelector('.chq-comms-phone-draft-card')).not.toBeNull();
    });
    const card = document.querySelector('.chq-comms-phone-draft-card') as HTMLElement;
    expect(within(card).getByText('Draft in progress')).toBeInTheDocument();
    expect(within(card).getByText('Your talk has been accepted to DevFlow Conf 2027')).toBeInTheDocument();
    // Frame :191 draws "23 recipients · reviewer feedback merged"; the app
    // renders the recipient count alone (no provenance signal exists to
    // honestly derive the "reviewer feedback merged" clause from -- see
    // PhoneDraftCard.tsx's own doc comment and docs/design/audit/
    // comms-v12.md finding 1). Graded here as a DIVERGES row, not asserted
    // as a match.
    expect(within(card).getByText('23 recipients')).toBeInTheDocument();
    expect(within(card).queryByText(/reviewer feedback merged/)).not.toBeInTheDocument();
    expect(within(card).getByText('Better on a laptop')).toBeInTheDocument();
    const readButton = within(card).getByRole('button', { name: 'Read the draft' });
    expect(readButton).toBeInTheDocument();
    // Onward route: pressing it lands on the compose tab (choosePhoneTab),
    // never a dead end (DEC-621 wave-109 amendment).
    readButton.click();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Compose' })).toHaveAttribute('aria-selected', 'true'));
  });

  // Frame :196-205 "Recent sends" -- DEC-751 caps the row list to four
  // (the same COMPOSE_RECENT_SENDS_LIMIT the Compose-tab RecentSends mount
  // uses), and each row's shape is `{{ h.when }} · {{ h.short }}` /
  // subject / template (:201-203), graded here structurally since the
  // literal placeholders are opaque mock data.
  it('frame :196-203 Recent sends band -- capped to 4 rows, each row\'s when/short · subject · template shape', async () => {
    verbatimLine(
      201,
      '            <span style="font-size:12px; color:#565A4B">{{ h.when }} · {{ h.short }}</span>',
    );
    renderLanding(FIVE_BATCHES);
    let rows: HTMLElement[] = [];
    await waitFor(() => {
      rows = Array.from(document.querySelectorAll('.chq-comms-phone-recent-row'));
      expect(rows.length).toBeGreaterThan(0);
    });
    expect(rows).toHaveLength(4);
    // Newest-first: FIVE_BATCHES[4] (the oldest, "Your talk has been
    // accepted...") is the one row DROPPED by the cap.
    const subjects = rows.map((row) => row.querySelector('.chq-comms-phone-recent-subject')?.textContent);
    expect(subjects).toEqual(FIVE_BATCHES.slice(0, 4).map((b) => b.subject));
    const first = rows[0] as HTMLElement;
    const when = first.querySelector('.chq-comms-phone-recent-when')?.textContent ?? '';
    expect(when).toMatch(/^.+ · \d+ sent$/);
    const template = first.querySelector('.chq-comms-phone-recent-template')?.textContent ?? '';
    // b5's templateId is null -- an em dash, never a blank cell (RecentSends'
    // own em-dash convention, reused here rather than re-derived).
    expect(template).toBe('—');
  });

  // Frame :210 bottom tab strip (`list="{{ tabs }}"`) -- per
  // docs/design/audit/phone-dock-membership-v12.md's discriminator, a band
  // whose body contains `list="{{ tabs }}"` is the SHELL tab bar
  // (App.tsx's `<PhoneTabBar />`), not page-local geometry. CommsPage
  // mounted standalone (no <App>) renders no such band -- confirming
  // Comms.tsx does not duplicate shell chrome, the same shape the :180
  // wordmark/event-name case above confirms.
  it('frame :210 bottom tab strip is shell chrome (PhoneTabBar), not duplicated by CommsPage', async () => {
    verbatimLine(
      210,
      '          <div style="flex:1; min-height:44px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px">',
    );
    renderLanding(FIVE_BATCHES);
    await waitFor(() => expect(screen.getAllByText(FIRST_BATCH_SUBJECT).length).toBeGreaterThan(0));
    // The page's own tab strip (Compose/Templates/History, role="tab") is
    // a DIFFERENT band from the shell's 5-item PhoneTabBar -- scoped to
    // the desktop head's tablist, distinct from any dot+label 390 dock.
    const pageTabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(pageTabs).toEqual(['Compose', 'Templates', 'History']);
  });
});
