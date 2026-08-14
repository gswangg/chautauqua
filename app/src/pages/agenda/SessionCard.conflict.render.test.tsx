// SBEK-RUN-3 (P1 Conflict engine gaps, AIA): a speaker_overlap between two
// sessions in DIFFERENT rooms (so DayGrid's same-room clash-cluster merge
// path — DEC-742 — never engages) must still render BOTH cards with
// data-conflict="true" and the " (conflict)" accessible-name suffix from
// SessionCard.tsx. Fixture/harness copied from Agenda.render.test.tsx's
// agendaPayload()/mockApi() idiom, with a second room column added so the
// two clashing cards land in different room columns instead of merging.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AgendaPage } from '../Agenda';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-agenda-copresenter-render';

function agendaPayload() {
  return {
    days: ['2026-06-01'],
    rooms: [
      { id: 'room-1', name: 'Main Hall' },
      { id: 'room-2', name: 'Side Room' },
    ],
    tracks: [],
    placed: [
      {
        submissionId: 'sub-1',
        ref: 'S-001',
        title: 'Talk With Primary One',
        trackIds: [],
        speakers: [
          { contactId: 'primary-1', name: 'Primo Presenter' },
          { contactId: 'shared-copresenter', name: 'Casey CoPresenter' },
        ],
        roomId: 'room-1',
        day: '2026-06-01',
        startMin: 600,
        endMin: 660,
      },
      {
        submissionId: 'sub-2',
        ref: 'S-002',
        title: 'Talk With Primary Two',
        trackIds: [],
        speakers: [
          { contactId: 'primary-2', name: 'Secondo Presenter' },
          { contactId: 'shared-copresenter', name: 'Casey CoPresenter' },
        ],
        roomId: 'room-2',
        day: '2026-06-01',
        startMin: 630,
        endMin: 690,
      },
    ],
    unscheduled: [],
    conflicts: [
      {
        kind: 'speaker_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        detail: 'Casey CoPresenter double-booked on 2026-06-01 between "Talk With Primary One" and "Talk With Primary Two"',
      },
    ],
    unplacedReasons: [],
    summary: { unplaced: 0, conflicts: 1 },
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  consoleErrorSpy?.mockRestore();
});

describe('SessionCard cross-room speaker_overlap render (SBEK-RUN-3 P1)', () => {
  it('renders both cards, in different room columns, as data-conflict="true" with the " (conflict)" accessible-name suffix', async () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/agenda`]: agendaPayload(),
    });

    render(<AgendaPage />);

    await waitFor(() => {
      expect(screen.getByText('Talk With Primary One')).toBeInTheDocument();
      expect(screen.getByText('Talk With Primary Two')).toBeInTheDocument();
    });

    const cardA = document.querySelector('[data-submission-id="sub-1"]');
    const cardB = document.querySelector('[data-submission-id="sub-2"]');
    expect(cardA).not.toBeNull();
    expect(cardB).not.toBeNull();

    // Neither card is part of a merged clash cluster — that path is
    // room_overlap-only (DEC-742/557) and these two are in different rooms.
    expect(cardA?.closest('.chq-day-grid-clash-card')).toBeNull();
    expect(cardB?.closest('.chq-day-grid-clash-card')).toBeNull();

    expect(cardA).toHaveAttribute('data-conflict', 'true');
    expect(cardB).toHaveAttribute('data-conflict', 'true');

    expect(cardA).toHaveAttribute('aria-label', expect.stringContaining(' (conflict)'));
    expect(cardB).toHaveAttribute('aria-label', expect.stringContaining(' (conflict)'));
    expect(screen.getByRole('button', { name: /S-001: Talk With Primary One \(conflict\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /S-002: Talk With Primary Two \(conflict\)/ })).toBeInTheDocument();
  });
});
