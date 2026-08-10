import { describe, expect, it } from 'vitest';
import { formatBytes } from './format';

describe('formatBytes', () => {
  it('formats sub-KB sizes in bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats KB sizes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats MB sizes', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
