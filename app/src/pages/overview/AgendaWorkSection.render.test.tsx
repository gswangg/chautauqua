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
    deadlines: { formCloseDate: null, nextTaskDueDate: null, planCloseDate: null, eventStartDate: null },
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
    expect(screen.getByRole('button', { name: 'Move DFC-047 to 11:30' })).toBeInTheDocument();
    expect(screen.getByText('Next free slot in Room 2A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place at 11:00' })).toBeInTheDocument();
    // The old generic link is gone when a concrete suggestion exists.
    expect(screen.queryByRole('link', { name: 'Place it' })).not.toBeInTheDocument();
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
