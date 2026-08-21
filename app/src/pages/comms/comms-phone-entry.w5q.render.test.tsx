// v12 mobile campaign w5-q (DEC-621 wave-109 amendment): the Tier 0 S2
// break in docs/probes/metafid-phoneA-2026-08-19.md -- "Comms
// Templates/History unreachable on phone without a localStorage draft;
// phoneEntered ignores ?tab=; landing has zero nav without a draft" -- had
// two independent causes, fixed together here:
//
//   (a) `phoneEntered` now initialises from a recognised `?tab=` (the same
//       `isTab` predicate DEC-710's own `tab` computation already uses),
//       so a deep link/bookmark/back-forward navigation lands directly on
//       that tab's body instead of the landing re-asserting itself.
//   (b) the landing itself now always exposes a control into all three
//       tabs, with or without a stored draft: the draft-card slot is
//       Compose's route either way (PhoneDraftCard.tsx, frame citation on
//       the assertion below), and the "Recent sends" head band carries
//       Templates and History (new geometry, not drawn by the frame --
//       see comms.css's own comment on `.chq-comms-phone-recent-head-
//       actions`).
//
// This file owns ONLY this new coverage -- Comms.phone.render.test.tsx
// (another lane) keeps the rest of the phone-landing suite.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { CommsPage } from '../Comms';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { EmailBatchRow } from './types';

const EVENT_ID = 'evt-comms-phone-entry';

function batchRow(overrides: Partial<EmailBatchRow> = {}): EmailBatchRow {
  return {
    batchKey: 'batch-1',
    subject: 'Your talk has been accepted to DevFlow Conf 2027',
    sentAt: 1700000000000,
    statusCounts: { sent: 21, skipped: 2 },
    templateId: null,
    ...overrides,
  };
}

function mockComms(batches: EmailBatchRow[] = []) {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope(batches),
  });
}

function setDraft() {
  window.localStorage.setItem(
    `chq.composeDraft.${EVENT_ID}`,
    JSON.stringify({
      templateName: 'Acceptance',
      subject: 'Your talk has been accepted',
      recipientCount: 23,
      updatedAt: 1700000000000,
    }),
  );
}

function landing(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.chq-comms-phone-landing');
  if (!el) throw new Error('.chq-comms-phone-landing not in the DOM');
  return el;
}

// w15-ti (DEC-919 wave-159) fallout fix: this whole file is about the
// landing's PHONE-only entry behaviour, so it needs isPhone true to see
// the landing at all now that Comms.tsx gates the block's MOUNT on
// isPhone (previously only the `-show` class was gated, so the block
// was in the DOM unconditionally and this file never needed to stub
// anything). Same FakeMediaQueryList pattern as
// PipelineBoard.render.test.tsx / Comms.frame-verdicts.render.test.tsx.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('CommsPage phone entry (DEC-621 wave-109 amendment, task w5-q): ?tab= reachability', () => {
  it('with ?tab= absent, lands on the landing (not a tab body) with no draft stored', async () => {
    mockComms();
    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Comms' });
    expect(landing()).toHaveClass('chq-comms-phone-landing-show');
    expect(document.querySelector('.chq-comms-main')).toHaveClass('chq-comms-main-landing');
  });

  it('with ?tab= absent, lands on the landing with a draft stored too (draft alone never skips it)', async () => {
    setDraft();
    mockComms();
    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Comms' });
    expect(landing()).toHaveClass('chq-comms-phone-landing-show');
  });

  it('?tab=compose skips the landing straight to the compose body, without a draft', async () => {
    mockComms();
    render(
      <MemoryRouter initialEntries={['/comms?tab=compose']}>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Comms' });
    expect(landing()).not.toHaveClass('chq-comms-phone-landing-show');
    expect(document.querySelector('.chq-comms-main')).not.toHaveClass('chq-comms-main-landing');
    const composeTab = screen.getByRole('tab', { name: 'Compose' });
    expect(composeTab).toHaveAttribute('aria-selected', 'true');
  });

  it('?tab=templates skips the landing straight to the templates body, without a draft', async () => {
    mockComms();
    render(
      <MemoryRouter initialEntries={['/comms?tab=templates']}>
        <CommsPage />
      </MemoryRouter>,
    );
    // w15-ti (DEC-919 wave-159) fallout: this file now runs under isPhone
    // true (see the beforeEach stub above), so the page-level tablist AND
    // its "Comms" h1 are replaced by Templates' own phone drill head
    // (Comms.tsx:323, w13-h precedent) -- there is no "Comms" heading to
    // wait for once isPhone is genuinely true and the tab is templates.
    const head = await screen.findByRole('heading', { name: 'Templates' });
    expect(head.closest('.chq-comms-templates-head')).not.toBeNull();
    expect(landing()).not.toHaveClass('chq-comms-phone-landing-show');
  });

  it('?tab=templates skips the landing with a draft stored too', async () => {
    setDraft();
    mockComms();
    render(
      <MemoryRouter initialEntries={['/comms?tab=templates']}>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Templates' });
    expect(landing()).not.toHaveClass('chq-comms-phone-landing-show');
  });

  it('?tab=history skips the landing straight to the history body, without a draft', async () => {
    mockComms();
    render(
      <MemoryRouter initialEntries={['/comms?tab=history']}>
        <CommsPage />
      </MemoryRouter>,
    );
    // w15-ti (DEC-919 wave-159) fallout: see the Templates case above --
    // History has the same phone drill head (Comms.tsx:323), so there is
    // no "Comms" heading here either.
    const head = await screen.findByRole('heading', { name: 'History' });
    expect(head.closest('.chq-comms-history-head')).not.toBeNull();
    expect(landing()).not.toHaveClass('chq-comms-phone-landing-show');
  });

  it('?tab=history skips the landing with a draft stored too', async () => {
    setDraft();
    mockComms();
    render(
      <MemoryRouter initialEntries={['/comms?tab=history']}>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'History' });
    expect(landing()).not.toHaveClass('chq-comms-phone-landing-show');
  });

  it('an unrecognised ?tab= still falls back to the landing, matching the desktop fallback-to-compose contract', async () => {
    mockComms();
    render(
      <MemoryRouter initialEntries={['/comms?tab=not-a-real-tab']}>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Comms' });
    expect(landing()).toHaveClass('chq-comms-phone-landing-show');
  });
});

describe('CommsPage phone landing: always exposes a route into all three tabs (task w5-q)', () => {
  it('with no draft stored, the draft-card slot carries an equivalent "Compose" entry (same card geometry, no fabricated draft copy)', async () => {
    mockComms();
    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Comms' });

    // docs/design/Chautauqua Comms.dc.html:188 `border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; padding:15px; display:flex; flex-direction:column; gap:9px` -- the draft-card slot's geometry, kept for the empty-state (no-draft) card too.
    const card = within(landing()).getByRole('button', { name: 'Compose' }).closest('.chq-comms-phone-draft-card');
    expect(card).not.toBeNull();
    // The label is taken verbatim from the tab strip's own vocabulary --
    // never the frame's draft-exists copy ("Read the draft"), which would
    // misdescribe a slot with no draft behind it.
    expect(within(landing()).queryByText('Read the draft')).toBeNull();

    fireEvent.click(within(landing()).getByRole('button', { name: 'Compose' }));
    const composeTab = await screen.findByRole('tab', { name: 'Compose' });
    expect(composeTab).toHaveAttribute('aria-selected', 'true');
    expect(landing()).not.toHaveClass('chq-comms-phone-landing-show');
  });

  it('with a draft stored, the draft-card slot keeps the frame\'s "Read the draft" route into Compose', async () => {
    setDraft();
    mockComms();
    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Comms' });

    fireEvent.click(within(landing()).getByRole('button', { name: 'Read the draft' }));
    const composeTab = await screen.findByRole('tab', { name: 'Compose' });
    expect(composeTab).toHaveAttribute('aria-selected', 'true');
  });

  it('the "Recent sends" head band carries Templates and History routes, labelled from the tab strip\'s own vocabulary', async () => {
    mockComms([batchRow()]);
    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Comms' });

    const head = landing().querySelector('.chq-comms-phone-recent-head');
    expect(head).not.toBeNull();
    const templatesLink = within(head as HTMLElement).getByRole('button', { name: 'Templates' });
    const historyLink = within(head as HTMLElement).getByRole('button', { name: 'History' });

    fireEvent.click(historyLink);
    // w15-ti (DEC-919 wave-159) fallout: see the ?tab=history case above --
    // History's own phone drill head replaces the tablist, so there is no
    // role="tab" to query here once isPhone is genuinely true.
    const historyHead = await screen.findByRole('heading', { name: 'History' });
    expect(historyHead.closest('.chq-comms-history-head')).not.toBeNull();
    expect(landing()).not.toHaveClass('chq-comms-phone-landing-show');

    // Re-mount fresh for the Templates route so each assertion starts from
    // the landing rather than chaining off the History navigation above.
    cleanup();
    mockComms([batchRow()]);
    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Comms' });
    const head2 = landing().querySelector('.chq-comms-phone-recent-head') as HTMLElement;
    fireEvent.click(within(head2).getByRole('button', { name: 'Templates' }));
    // w15-ti (DEC-919 wave-159) fallout: same drill-head substitution as
    // the History branch above.
    const templatesHead = await screen.findByRole('heading', { name: 'Templates' });
    expect(templatesHead.closest('.chq-comms-templates-head')).not.toBeNull();
    expect(templatesLink).toBeDefined();
  });
});
