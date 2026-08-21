import { describe, expect, it } from 'vitest';
import { formatBytes } from './format';

describe('formatBytes', () => {
  it('formats sub-KB sizes in bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats KB sizes with the trailing .0 trimmed', () => {
    expect(formatBytes(2048)).toBe('2 KB');
  });

  it('formats MB sizes with the trailing .0 trimmed', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });
});
