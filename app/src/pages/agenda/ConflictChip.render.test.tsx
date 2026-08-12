import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ConflictChip } from './ConflictChip';
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
