import { describe, expect, it } from 'vitest';
import { formatIcsChip } from './icsChip';

describe('formatIcsChip', () => {
  it('includes a locally-formatted start-end range and the room name', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: 'Main Hall',
      sequence: 0,
    });
    expect(chip).toContain('Main Hall');
    expect(chip).not.toContain('update #');
  });

  it('falls back to "room TBD" when no room is assigned', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: null,
      sequence: 0,
    });
    expect(chip).toContain('room TBD');
  });

  it('falls back to "room TBD" when room is an empty string', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: '   ',
      sequence: 0,
    });
    expect(chip).toContain('room TBD');
  });

  it('shows no update marker for the initial invite (sequence 0)', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: 'Main Hall',
      sequence: 0,
    });
    expect(chip).not.toMatch(/update #/);
  });

  it('shows "update #<sequence>" once the room lands and sequence bumps', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: 'Main Hall',
      sequence: 1,
    });
    expect(chip).toContain('update #1');
  });

  it('reflects higher sequence numbers for subsequent updates', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: 'Main Hall',
      sequence: 3,
    });
    expect(chip).toContain('update #3');
  });
});
