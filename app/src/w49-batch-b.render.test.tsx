// w49-g: discharges the two batch-B UI remainder items that turned out NOT
// to already have a positive, exercised check in-tree (the other two --
// Submissions->Comms `?ids=` handoff and Comms History pager -- were
// already covered by BulkActionBar.render.test.tsx +
// ComposeWizard.idsParam.render.test.tsx, and HistoryTab.render.test.tsx's
// "paginates:" test, respectively; see docs/mandates/w41-falsifiability-batch-b.md).
//
// 1. ReviewerQueue's plan-scoped subtitle (round name + closes-in-N-days
//    window), app/src/pages/review/ReviewerQueue.tsx:~510-516 -- every
//    existing ReviewerQueue.render.test.tsx fixture passes `rounds: 1` (or
//    omits it, tripping the interface default), so the `rounds > 1` branch
//    that composes the round name into the subtitle was never actually
//    rendered by any existing test.
// 2. ComposeWizard's attachIcs footer note naming the exact unscheduled
//    rows (app/src/pages/comms/ComposeWizard.tsx:~1226-1230) -- the only
//    existing coverage (ComposeWizard.render.test.tsx:1289) is a NEGATIVE
//    assertion (`queryByText(/have no slot yet/)).not.toBeInTheDocument()`)
//    for the all-scheduled case; nothing asserts the footer's actual text
//    when a row genuinely lacks a slot.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewerQueue } from './pages/review/ReviewerQueue';
import { ComposeWizard } from './pages/comms/ComposeWizard';
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
});

describe('ReviewerQueue plan-scoped subtitle: round name + window (DEC-147/DEC-522)', () => {
  const PLAN_ID = 'plan-round-2';

  function queueItem(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      submissionId: 'sub-1',
      ref: 'S-001',
      title: 'A Talk',
      ratingsCount: 0,
      alreadyRatedByMe: false,
      myScore: null,
      ...overrides,
    };
  }

  it('a multi-round plan (rounds > 1) shows the round\'s own resolved name AND the closes-in-N-days window, joined with the track scope', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope([queueItem()]),
        total: 1,
        unscoredTotal: 1,
        open: true,
        recused: [],
        planName: 'Frame Plan',
        scopeTrackName: 'Keynotes',
        closeDate: Date.now() + 19 * 24 * 60 * 60 * 1000,
        rounds: 2,
        currentRound: 1,
        roundMeta: { name: 'Preliminary Round', opensAt: null, closesAt: null },
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<ReviewerQueue />} />
        </Routes>
      </MemoryRouter>,
    );

    const subtitle = await screen.findByText(/Keynotes/);
    expect(subtitle).toHaveTextContent('Keynotes');
    expect(subtitle).toHaveTextContent('Preliminary Round');
    expect(subtitle.textContent).toMatch(/closes in \d+ days?/);
    // The three segments are joined in scope -> round -> window order.
    const scopeIdx = subtitle.textContent!.indexOf('Keynotes');
    const roundIdx = subtitle.textContent!.indexOf('Preliminary Round');
    const windowIdx = subtitle.textContent!.indexOf('closes in');
    expect(scopeIdx).toBeLessThan(roundIdx);
    expect(roundIdx).toBeLessThan(windowIdx);
  });

  it('a single-round plan (rounds === 1) never composes a round name into the subtitle, even with the same roundMeta present', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope([queueItem()]),
        total: 1,
        unscoredTotal: 1,
        open: true,
        recused: [],
        planName: 'Frame Plan',
        scopeTrackName: 'Keynotes',
        closeDate: null,
        rounds: 1,
        currentRound: 1,
        roundMeta: { name: 'Preliminary Round', opensAt: null, closesAt: null },
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<ReviewerQueue />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Keynotes');
    expect(screen.queryByText(/Preliminary Round/)).not.toBeInTheDocument();
  });
});

describe('ComposeWizard attachIcs footer: names the exact unscheduled rows (DEC-954)', () => {
  const EVENT_ID = 'evt-w49-batch-b';

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

  it('the footer names the count and, for each unscheduled row, its ref and name', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(page1(), { total: 340, page: 1, perPage: 50 }),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: {
        items: [
          recipient('c1', 'sub-1', 'Priya Raman', 'DFC-014', false),
          recipient('c2', 'sub-2', 'Nadia Ferrone', 'DFC-041', true),
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
    fireEvent.click(screen.getByRole('button', { name: /Next: choose a template/ }));

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
    await screen.findByText('Attachments');

    fireEvent.click(screen.getByLabelText('Attach calendar invite'));
    await screen.findByText(/1 of 2 have no slot yet — those get no invite/);
    fireEvent.click(screen.getByRole('button', { name: /Next: send/ }));

    // Exactly one of the two rows lacks a slot -- the send-step footer
    // must name that one row (ref DFC-014 / name Priya Raman), never the
    // scheduled one (DFC-041 / Nadia Ferrone).
    const heading = await screen.findByText(/1 of 2 have no slot yet — excluded from the calendar invite/);
    const note = heading.closest('.chq-comms-panel-note');
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain('DFC-014');
    expect(note!.textContent).toContain('Priya Raman');
    expect(note!.textContent).not.toContain('DFC-041');
    expect(note!.textContent).not.toContain('Nadia Ferrone');
  });
});
