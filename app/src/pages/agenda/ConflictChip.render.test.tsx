import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ConflictChip, clusterConflictCaption } from './ConflictChip';
import type { AgendaConflict } from './types';

afterEach(() => cleanup());

// DEC-557: caption must be derived from `kind` -- the old unconditional
// "Two sessions in one room" caption must never render for a speaker_overlap.
describe('ConflictChip', () => {
  it('renders the room caption for a room_overlap', () => {
    const conflicts: AgendaConflict[] = [
      {
        kind: 'room_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        day: '2026-09-01',
        roomId: 'room-1',
        speakerContactIds: [],
        detail: 'Room "Ballroom" double-booked on 2026-09-01 between "Talk One" and "Talk Two"',
      },
    ];
    render(<ConflictChip conflicts={conflicts} submissionId="sub-1" />);
    expect(screen.getByText('Two sessions in one room')).toBeInTheDocument();
  });

  it('never renders the room caption for a speaker_overlap', () => {
    const conflicts: AgendaConflict[] = [
      {
        kind: 'speaker_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        day: '2026-09-01',
        roomId: null,
        speakerContactIds: ['ct-1'],
        detail: 'Speaker(s) Ada Lovelace double-booked on 2026-09-01 between "Talk One" and "Talk Two"',
      },
    ];
    render(<ConflictChip conflicts={conflicts} submissionId="sub-1" />);
    expect(screen.queryByText('Two sessions in one room')).not.toBeInTheDocument();
    expect(screen.getByText('Speaker double-booked')).toBeInTheDocument();
  });

  it('returns null when the submission has no conflicts', () => {
    const { container } = render(<ConflictChip conflicts={[]} submissionId="sub-1" />);
    expect(container.firstChild).toBeNull();
  });
});

// DEC-557 amendment (wave 48): clusterConflictCaption is the ONE
// implementation ConflictChip and DayGrid's merged clash card both call —
// pinning it directly guards against the two ever disagreeing again.
describe('clusterConflictCaption', () => {
  it('returns null for an empty intersection (no conflict touches this cluster at all)', () => {
    expect(clusterConflictCaption([], ['sub-1', 'sub-2'])).toBeNull();

    // A conflict entirely disjoint from the cluster's ids doesn't count --
    // e.g. two room-less sessions overlapping in time have no recorded
    // room_overlap (schedule.ts never emits one for a null roomId), and
    // some unrelated pair elsewhere on the day must not leak in.
    const disjoint: AgendaConflict[] = [
      {
        kind: 'speaker_overlap',
        submissionIds: ['sub-9', 'sub-10'],
        day: '2026-09-01',
        roomId: null,
        speakerContactIds: ['ct-1'],
        detail: 'irrelevant',
      },
    ];
    expect(clusterConflictCaption(disjoint, ['sub-1', 'sub-2'])).toBeNull();
  });

  it('still announces a speaker_overlap reaching outside the cluster (e.g. same speaker double-booked into a different room)', () => {
    const conflicts: AgendaConflict[] = [
      {
        kind: 'speaker_overlap',
        submissionIds: ['sub-1', 'sub-9'],
        day: '2026-09-01',
        roomId: null,
        speakerContactIds: ['ct-1'],
        detail: 'speaker clash across rooms',
      },
    ];
    expect(clusterConflictCaption(conflicts, ['sub-1', 'sub-2'])).toBe('Speaker double-booked');
  });

  it('returns the combined caption when the cluster has both a room and a speaker conflict', () => {
    const conflicts: AgendaConflict[] = [
      {
        kind: 'room_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        day: '2026-09-01',
        roomId: 'room-1',
        speakerContactIds: [],
        detail: 'room clash',
      },
      {
        kind: 'speaker_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        day: '2026-09-01',
        roomId: null,
        speakerContactIds: ['ct-1'],
        detail: 'speaker clash',
      },
    ];
    expect(clusterConflictCaption(conflicts, ['sub-1', 'sub-2'])).toBe('Room & speaker conflict');
  });

  it('returns "Speaker double-booked" when the cluster only has a speaker conflict', () => {
    const conflicts: AgendaConflict[] = [
      {
        kind: 'speaker_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        day: '2026-09-01',
        roomId: null,
        speakerContactIds: ['ct-1'],
        detail: 'speaker clash',
      },
    ];
    expect(clusterConflictCaption(conflicts, ['sub-1', 'sub-2'])).toBe('Speaker double-booked');
  });
});
