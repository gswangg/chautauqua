// DEC-378: shared Escape-to-close hook, source pinned verbatim in the DEC
// so two lanes may create the identical file independently.
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEscapeKey } from './useEscapeKey';

function fireKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

describe('useEscapeKey (DEC-378)', () => {
  it('fires the callback on Escape while active', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    fireKey('Escape');

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    fireKey('Enter');
    fireKey('a');
    fireKey('Tab');

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('does not fire while inactive', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(false, onEscape));

    fireKey('Escape');

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('removes its listener on unmount', () => {
    const onEscape = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(true, onEscape));

    unmount();
    fireKey('Escape');

    expect(onEscape).not.toHaveBeenCalled();
  });
});
