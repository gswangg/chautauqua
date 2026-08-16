import { afterEach, describe, expect, it } from 'vitest';
import { formatIcsChip } from './icsChip';

describe('formatIcsChip', () => {
  it('includes a locally-formatted start-end range and the room name', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: 'Main Hall',
      sequence: 0,
      timeZone: 'America/Los_Angeles',
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
      timeZone: 'America/Los_Angeles',
    });
    expect(chip).toContain('room TBD');
  });

  it('falls back to "room TBD" when room is an empty string', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: '   ',
      sequence: 0,
      timeZone: 'America/Los_Angeles',
    });
    expect(chip).toContain('room TBD');
  });

  it('shows no update marker for the initial invite (sequence 0)', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: 'Main Hall',
      sequence: 0,
      timeZone: 'America/Los_Angeles',
    });
    expect(chip).not.toMatch(/update #/);
  });

  it('shows "update #<sequence>" once the room lands and sequence bumps', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: 'Main Hall',
      sequence: 1,
      timeZone: 'America/Los_Angeles',
    });
    expect(chip).toContain('update #1');
  });

  it('reflects higher sequence numbers for subsequent updates', () => {
    const chip = formatIcsChip({
      startUtc: '2026-09-01T17:00:00.000Z',
      endUtc: '2026-09-01T18:00:00.000Z',
      room: 'Main Hall',
      sequence: 3,
      timeZone: 'America/Los_Angeles',
    });
    expect(chip).toContain('update #3');
  });

  // DEC-494 live repro: an organizer on EDT proofreading a notification for a
  // 09:00 Pacific session must see the event's own local time (with zone
  // abbreviation), never their own machine's ambient zone. Proven here by
  // asserting the SAME literal chip text under two distinct ambient
  // process.env.TZ values, neither of which is the event's zone.
  describe('is independent of the ambient machine timezone (DEC-494)', () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    const ics = {
      startUtc: '2027-05-12T16:00:00.000Z', // 09:00 America/Los_Angeles (PDT)
      endUtc: '2027-05-12T16:45:00.000Z',
      room: 'Main Stage',
      sequence: 0,
      timeZone: 'America/Los_Angeles',
    };

    it('renders the same chip text under America/New_York and Asia/Tokyo ambient zones', () => {
      process.env.TZ = 'America/New_York';
      const underEastern = formatIcsChip(ics);

      process.env.TZ = 'Asia/Tokyo';
      const underTokyo = formatIcsChip(ics);

      expect(underEastern).toBe(underTokyo);
      expect(underEastern).toContain('9:00');
      expect(underEastern).toMatch(/PDT/);
      expect(underEastern).not.toContain('12:00'); // the ambient-zone bug this closes
    });
  });
});
