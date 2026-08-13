import { describe, expect, it } from 'vitest';
import { formatSubmissionScheduleLine } from './schedule';

describe('formatSubmissionScheduleLine', () => {
  it('formats day, clock times, and a named room', () => {
    const line = formatSubmissionScheduleLine({
      day: '2026-05-12',
      startMin: 600,
      endMin: 630,
      roomName: 'Room 2A',
    });
    expect(line).toBe('Tue 12 May · 10:00–10:30 · Room 2A');
  });

  it('falls back to "To be announced" for a null room, never a dash', () => {
    const line = formatSubmissionScheduleLine({
      day: '2026-05-12',
      startMin: 540,
      endMin: 570,
      roomName: null,
    });
    expect(line).toBe('Tue 12 May · 09:00–09:30 · To be announced');
    expect(line).not.toContain('—');
  });

  it('pads single-digit hours and minutes', () => {
    const line = formatSubmissionScheduleLine({
      day: '2026-01-01',
      startMin: 5,
      endMin: 65,
      roomName: 'Hall B',
    });
    expect(line).toBe('Thu 1 Jan · 00:05–01:05 · Hall B');
  });
});
