import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('copyText', () => {
  it('resolves true when navigator.clipboard.writeText succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('resolves false and never throws when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyText('hello')).resolves.toBe(false);
  });

  it('resolves false and never throws when the Clipboard API is absent', async () => {
    vi.stubGlobal('navigator', {});

    await expect(copyText('hello')).resolves.toBe(false);
  });
});
