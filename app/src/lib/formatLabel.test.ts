import { describe, expect, it } from 'vitest';
import { formatFormatLabel } from './formatLabel';

describe('formatFormatLabel', () => {
  it('turns "Talk (30 min)" into "Talk, 30 min"', () => {
    expect(formatFormatLabel('Talk (30 min)')).toBe('Talk, 30 min');
  });

  it('abbreviates to "Talk, 30m" when abbreviate is true', () => {
    expect(formatFormatLabel('Talk (30 min)', { abbreviate: true })).toBe('Talk, 30m');
  });

  it('passes a label with no parenthetical through unchanged', () => {
    expect(formatFormatLabel('Talk')).toBe('Talk');
    expect(formatFormatLabel('Talk', { abbreviate: true })).toBe('Talk');
  });

  it('passes an unrelated parenthetical through unchanged', () => {
    expect(formatFormatLabel('Panel (invite only)')).toBe('Panel (invite only)');
  });

  it('handles multi-word names', () => {
    expect(formatFormatLabel('Lightning Talk (10 min)', { abbreviate: true })).toBe('Lightning Talk, 10m');
  });
});
