// DEC-652 layer-2 harness: component-render smoke test for Overview §04's
// concrete "Place at 11:30" / "Move DFC-047 to 11:30" actions. Mounts the
// section directly against a payload fixture, mocks the slot PUT, and
// asserts the button fires the right endpoint, removes the row
// optimistically, and loudly refetches (never a silent local rollback) on
// failure.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AgendaWorkSection } from './AgendaWorkSection';
import { errorEnvelope, mockApi } from '../../test-utils/mockApi';
import type { OverviewPayload } from './types';

function basePayload(): OverviewPayload {
  return {
    deadlines: { formCloseDate: null, nextTaskDueDate: null, planCloseDate: null, planRound: null, eventStartDate: null },
    overdueTasks: { total: 0, rows: [] },
    triage: { total: 0, oldestSubmittedAt: null, rows: [] },
    contentApproval: { total: 0, reuploadedCount: 0, rows: [] },
    agendaWork: {
      unplacedTotal: 1,
      conflictTotal: 1,
      conflicts: [
        {
          day: '2027-03-11',
          startMin: 600,
          endMin: 660,
          roomName: 'Room 2A',
          kind: 'room_overlap',
          entries: [
            { submissionId: 'sub-a', ref: 'DFC-014', title: 'Taming 40-Minute CI', speakerName: 'Priya Raman' },
            { submissionId: 'sub-b', ref: 'DFC-047', title: 'Onboarding in 30 Minutes', speakerName: 'Ruth Adeyemi' },
          ],
          resolution: {
            submissionId: 'sub-b',
            ref: 'DFC-047',
            day: '2027-03-11',
            startMin: 690,
            roomId: 'room-2a',
            roomName: 'Room 2A',
            label: 'Move DFC-047 to 11:30',
          },
        },
      ],
      unplaced: [
        {
          submissionId: 'sub-c',
          ref: 'DFC-050',
          title: 'Docs That Answer Back',
          speakerName: 'Dana Whitmore',
          format: 'Talk (30 min)',
          durationMin: 30,
          suggestion: {
            day: '2027-03-11',
            startMin: 660,
            roomId: 'room-2b',
            roomName: 'Room 2B',
            label: 'Place at 11:00',
          },
        },
      ],
    },
    'triage-counts': { pending: 0, accept_queue: 0, decline_queue: 0 },
    review: { plans: 0, evaluationsSubmitted: 0, evaluationsExpected: 0 },
    speakers: { contactsOwing: 0, overdueAssignments: 0 },
    content: { awaitingApproval: 0 },
    agenda: { unplaced: 1, conflicts: 1 },
    comms: { sentLast7Days: 0, lastSentAt: null },
    publishedSessionCount: 0,
  };
}

function Harness({ payload, refetch }: { payload: OverviewPayload; refetch: () => Promise<void> }) {
  const [state, setState] = useState(payload);
  const [error, setError] = useState<string | null>(null);
  return (
    <MemoryRouter>
      {error && <div role="alert">{error}</div>}
      <AgendaWorkSection payload={state} setPayload={setState} setError={setError} refetch={refetch} />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AgendaWorkSection (DEC-652)', () => {
  it('renders the mock rows: conflict pair, resolution button+caption, unplaced suggestion button', () => {
    mockApi({});
    render(<Harness payload={basePayload()} refetch={vi.fn()} />);

    expect(screen.getByText('Taming 40-Minute CI')).toBeInTheDocument();
    expect(screen.getByText('Onboarding in 30 Minutes')).toBeInTheDocument();
    // DEC-877: the conflict's left column names weekday + day-of-month, the
    // start time, then the room — never the raw ISO day string with no
    // time. conflict.day is '2027-03-11' (a Thursday), startMin 600 = 10:00.
    expect(screen.getByText('Thu 11 Mar, 10:00')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/2027-03-11/);
    expect(screen.getByRole('button', { name: 'Move DFC-047 to 11:30' })).toBeInTheDocument();
    expect(screen.getByText('Next free slot in Room 2A')).toBeInTheDocument();
    // DEC-652 amendment (wave 2): the suggestion label is the server's own
    // "Place at HH:MM" text verbatim -- no client-appended room suffix.
    expect(screen.getByRole('button', { name: 'Place at 11:00' })).toBeInTheDocument();
    // The old generic link is gone when a concrete suggestion exists.
    expect(screen.queryByRole('link', { name: 'Place it' })).not.toBeInTheDocument();
    // DEC-652 amendment (wave 2)/DEC-908 (wave-9 amendment): format renders
    // once, through the session-vocabulary display grammar ('Talk (30 min)'
    // -> 'Talk, 30 min') -- no separate "30 min" segment restating it.
    expect(screen.getByText(/Talk, 30 min/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/·\s*min\s*·/);
    expect(document.body.textContent).not.toMatch(/null min/);
    expect(document.body.textContent).not.toMatch(/30 min\).*30 min/);
  });

  // DEC-895: a row's meta line drops both the format and duration segments
  // cleanly when either is absent — never a dangling "· min ·" fragment,
  // and the row keeps the plain "Place it" link rather than proposing an
  // unsized slot.
  it('drops the format/duration clause and keeps the plain Place it link when the row has no derivable duration', () => {
    mockApi({});
    const payload = basePayload();
    payload.agendaWork.unplaced[0]! = {
      submissionId: 'sub-e',
      ref: 'DFC-052',
      title: 'A Talk With No Format Answer',
      speakerName: 'Nia Okafor',
      format: null,
      durationMin: null,
      suggestion: null,
    };
    render(<Harness payload={payload} refetch={vi.fn()} />);

    expect(screen.getByText('A Talk With No Format Answer')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/·\s*min\s*·/);
    expect(document.body.textContent).not.toMatch(/null min/);
    expect(screen.getByRole('link', { name: 'Place it' })).toHaveAttribute('href', '/agenda');
  });

  // DEC-895: the PUT body's endMin is derived from the ROW's own duration
  // (a 120-minute workshop), never a hardcoded 30-minute default.
  it('PUTs an endMin sized by the row\'s own (non-default) duration', async () => {
    const fetchMock = mockApi({
      'PUT /api/v1/submissions/sub-c/slot': { ok: true },
    });
    const payload = basePayload();
    payload.agendaWork.unplaced[0]! = {
      submissionId: 'sub-c',
      ref: 'DFC-050',
      title: 'Docs That Answer Back',
      speakerName: 'Dana Whitmore',
      format: 'Workshop (120 min)',
      durationMin: 120,
      suggestion: { day: '2027-03-11', startMin: 660, roomId: 'room-2b', roomName: 'Room 2B', label: 'Place at 11:00' },
    };
    render(<Harness payload={payload} refetch={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Place at 11:00' }));

    await waitFor(() => {
      expect(screen.queryByText('Docs That Answer Back')).not.toBeInTheDocument();
    });

    const call = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).toString();
      return url.includes('/submissions/sub-c/slot');
    });
    expect(call).toBeTruthy();
    const init = call![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      day: '2027-03-11',
      startMin: 660,
      endMin: 780, // 660 + 120 (the row's own duration, not a 30min default)
      roomId: 'room-2b',
    });
  });

  // DEC-735: §02's row-actions container is an inline row, §04's conflict
  // resolution container is a column — the two must never share a layout
  // class again (that's the bug the split fixes).
  it('gives the conflict resolution its own layout class, distinct from an inline action row', () => {
    mockApi({});
    render(<Harness payload={basePayload()} refetch={vi.fn()} />);

    const resolutionButton = screen.getByRole('button', { name: 'Move DFC-047 to 11:30' });
    const resolutionContainer = resolutionButton.parentElement!;
    expect(resolutionContainer).toHaveClass('chq-overview-row-actions-column');
    expect(resolutionContainer).not.toHaveClass('chq-overview-row-actions-inline');
  });

  // DEC-652 amendment (wave 2): the suggestion button carries the server's
  // "Place at HH:MM" label verbatim, no client-appended room suffix -- two
  // same-time suggestions on different rows are still two distinct buttons
  // (each scoped to its own row's title/format/ref), not disambiguated by
  // the button's own accessible name.
  it('renders one same-time suggestion button per row, each scoped to its own row', () => {
    mockApi({});
    const payload = basePayload();
    payload.agendaWork.unplaced = [
      {
        submissionId: 'sub-c',
        ref: 'DFC-050',
        title: 'Docs That Answer Back',
        speakerName: 'Dana Whitmore',
        format: 'Talk (30 min)',
        durationMin: 30,
        suggestion: { day: '2027-03-11', startMin: 660, roomId: 'room-2b', roomName: 'Room 2B', label: 'Place at 11:00' },
      },
      {
        submissionId: 'sub-d',
        ref: 'DFC-051',
        title: 'Zero-Downtime Schema Migrations',
        speakerName: 'Ezra Lindqvist',
        format: 'Talk (30 min)',
        durationMin: 30,
        suggestion: { day: '2027-03-11', startMin: 660, roomId: 'room-3c', roomName: 'Room 3C', label: 'Place at 11:00' },
      },
    ];
    render(<Harness payload={payload} refetch={vi.fn()} />);

    const buttons = screen.getAllByRole('button', { name: 'Place at 11:00' });
    expect(buttons).toHaveLength(2);
    const firstRow = screen.getByText('Docs That Answer Back').closest('.chq-overview-row-agenda')!;
    const secondRow = screen.getByText('Zero-Downtime Schema Migrations').closest('.chq-overview-row-agenda')!;
    expect(firstRow.contains(buttons[0]!)).toBe(true);
    expect(secondRow.contains(buttons[1]!)).toBe(true);
  });

  it('falls back to the "Place it" link when a row has no suggestion (never invents a time)', () => {
    mockApi({});
    const payload = basePayload();
    payload.agendaWork.unplaced[0]!.suggestion = null;
    payload.agendaWork.conflicts[0]!.resolution = null;
    render(<Harness payload={payload} refetch={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Place it' })).toHaveAttribute('href', '/agenda');
    expect(screen.queryByRole('button', { name: /Move DFC-047/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Next free slot in Room 2A')).not.toBeInTheDocument();
  });

  it('PUTs the slot endpoint and removes the unplaced row optimistically', async () => {
    const fetchMock = mockApi({
      'PUT /api/v1/submissions/sub-c/slot': { ok: true },
    });
    render(<Harness payload={basePayload()} refetch={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Place at 11:00' }));

    await waitFor(() => {
      expect(screen.queryByText('Docs That Answer Back')).not.toBeInTheDocument();
    });

    const call = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).toString();
      return url.includes('/submissions/sub-c/slot');
    });
    expect(call).toBeTruthy();
    const init = call![1] as RequestInit;
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      day: '2027-03-11',
      startMin: 660,
      endMin: 690,
      roomId: 'room-2b',
    });
  });

  it('PUTs the resolution endpoint and removes the conflict row optimistically', async () => {
    const fetchMock = mockApi({
      'PUT /api/v1/submissions/sub-b/slot': { ok: true },
    });
    render(<Harness payload={basePayload()} refetch={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move DFC-047 to 11:30' }));

    await waitFor(() => {
      expect(screen.queryByText('Onboarding in 30 Minutes')).not.toBeInTheDocument();
    });

    const call = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).toString();
      return url.includes('/submissions/sub-b/slot');
    });
    expect(call).toBeTruthy();
    const init = call![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      day: '2027-03-11',
      startMin: 690,
      endMin: 750, // conflict duration (660-600=60) carried onto the moved slot
      roomId: 'room-2a',
    });
  });

  // DEC-877: §04's overflow is a summary line BELOW the list, joined
  // through the page's one joinSegments — never inventing a duration clause
  // the payload doesn't carry.
  it('renders a below-the-list overflow summary when the server total exceeds the rendered rows', () => {
    mockApi({});
    const payload = basePayload();
    payload.agendaWork.unplacedTotal = 4;
    payload.agendaWork.conflictTotal = 3;
    render(<Harness payload={payload} refetch={vi.fn()} />);

    const overflow = screen.getByText('3 more unplaced · 2 more conflicts');
    expect(overflow).toHaveClass('chq-overview-overflow');
    const unplacedRow = screen.getByText('Docs That Answer Back').closest('.chq-overview-row-agenda')!;
    expect(unplacedRow.compareDocumentPosition(overflow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders no overflow line when the rendered rows already cover the totals', () => {
    mockApi({});
    render(<Harness payload={basePayload()} refetch={vi.fn()} />);
    expect(document.querySelector('.chq-overview-overflow')).not.toBeInTheDocument();
  });

  // DEC-370: agendaWork.conflicts[].roomName is nullable on the wire (the
  // conflicting assignment may carry no roomId). The absent case renders
  // through the shared room-absence vocabulary (ROOM_TBA_LABEL), never a
  // raw null/empty node.
  it('renders the shared "To be announced" room label when a conflict row has a null roomName', () => {
    mockApi({});
    const payload = basePayload();
    payload.agendaWork.conflicts[0]!.roomName = null;
    render(<Harness payload={payload} refetch={vi.fn()} />);

    expect(screen.getByText('To be announced')).toBeInTheDocument();
  });

  // DEC-615 (wave 71 amendment): conflictKindLabel is the ONE renderer for
  // all three ConflictKind members -- a break_overlap row (exactly one
  // entry, per Conflict.submissionIds' documented shape) must read
  // "Scheduled over a break", never "undefined" or the room caption.
  it('renders the break caption for a break_overlap conflict row', () => {
    mockApi({});
    const payload = basePayload();
    payload.agendaWork.conflicts[0]!.kind = 'break_overlap';
    payload.agendaWork.conflicts[0]!.entries = [
      { submissionId: 'sub-a', ref: 'DFC-014', title: 'Taming 40-Minute CI', speakerName: 'Priya Raman' },
    ];
    render(<Harness payload={payload} refetch={vi.fn()} />);

    expect(screen.getByText('Scheduled over a break')).toBeInTheDocument();
  });

  // DEC-615 (wave 71 amendment): speaker_overlap is the third member --
  // pinned here alongside break_overlap so all three ConflictKind values
  // have a real render assertion on this surface, not just room_overlap.
  it('renders the speaker caption for a speaker_overlap conflict row', () => {
    mockApi({});
    const payload = basePayload();
    payload.agendaWork.conflicts[0]!.kind = 'speaker_overlap';
    render(<Harness payload={payload} refetch={vi.fn()} />);

    expect(screen.getByText('Speaker double-booked')).toBeInTheDocument();
  });

  it('loudly refetches (never a silent rollback) when the placement PUT fails', async () => {
    mockApi({
      'PUT /api/v1/submissions/sub-c/slot': {
        status: 409,
        body: errorEnvelope('conflict', 'Slot already taken'),
      },
    });
    const refetch = vi.fn().mockResolvedValue(undefined);
    render(<Harness payload={basePayload()} refetch={refetch} />);

    fireEvent.click(screen.getByRole('button', { name: 'Place at 11:00' }));

    await waitFor(() => {
      expect(screen.getByText(/Slot already taken/)).toBeInTheDocument();
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
