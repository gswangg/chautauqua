// DEC-678: one delayed-loading policy, app-wide. Nothing renders on the
// first frame; a `.chq-loading` block (or, via useDelayedFlag, whatever
// shell a caller wraps it in) appears only once the delay has elapsed.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DelayedLoading, useDelayedFlag } from './DelayedLoading';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DelayedLoading', () => {
  it('renders nothing on the first frame', () => {
    vi.useFakeTimers();
    render(<DelayedLoading label="Loading things…" />);
    expect(screen.queryByText('Loading things…')).not.toBeInTheDocument();
  });

  it('renders the .chq-loading block once the delay elapses', () => {
    vi.useFakeTimers();
    render(<DelayedLoading label="Loading things…" />);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    const el = screen.getByText('Loading things…');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('chq-loading');
  });

  it('defaults to the label "Loading…"', () => {
    vi.useFakeTimers();
    render(<DelayedLoading />);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});

describe('useDelayedFlag', () => {
  it('stays false until active has held for delayMs', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 250), {
      initialProps: { active: true },
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it('resets the timer when active flips false then true again', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 250), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ active: false });
    rerender({ active: true });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe(true);
  });
});
