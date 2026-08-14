// DEC-024 amendment (wave 14): a 401 from GET /api/v1/me is the same policy
// the Worker's /admin gate already enforces for an anonymous request --
// redirect to the login door rather than silently rendering an app frame
// with no signed-in user. Exercises useMe() via a minimal harness component
// (this codebase has no renderHook helper -- other lib tests here render a
// harness instead, see useMenu.test.tsx).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useMe } from './useMe';

function Harness() {
  const { me, loading } = useMe();
  if (loading) return <span>loading</span>;
  return <span>{me ? `signed in as ${me.email}` : 'no me'}</span>;
}

const originalLocation = window.location;

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// jsdom's window.location.assign is non-configurable on the Location
// instance, so vi.spyOn(window.location, 'assign') throws "Cannot redefine
// property". Replace the whole `window.location` object with a stub that
// carries a spy assign(), restored in afterEach above.
function stubLocationAssign(): ReturnType<typeof vi.fn> {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: assignSpy },
  });
  return assignSpy;
}

describe('useMe() 401 handling (DEC-024 amendment, wave 14)', () => {
  it('redirects to /login on a 401 from GET /api/v1/me, instead of silently rendering "no me"', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { code: 'unauthorized', message: 'not signed in' } }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const assignSpy = stubLocationAssign();

    render(<Harness />);

    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith('/login');
    });
    // setMe(null) still runs, so nothing renders in the frame between the
    // assign() call and the browser unloading for /login.
    expect(screen.getByText('no me')).toBeInTheDocument();
  });
});
