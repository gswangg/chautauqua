// DEC-154 (wave 14 amendment): sign-out must not navigate to /login unless
// the /logout response is ok -- the chq_session cookie is still live on a
// non-ok response, so an unconditional navigate would assert a sign-out
// that did not happen. Covers both the success path (assign called) and
// the failure path (assign NOT called, rejection surfaces instead of being
// rendered as a visible chq-error alert rather than a rejection into the
// void -- see v12m-w14-c's handleSignOutClick in App.tsx).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
import { resetEventsCacheForTests } from './lib/useCurrentEvent';

beforeEach(() => {
  window.history.pushState({}, '', '/admin');
});

const originalLocation = window.location;

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  window.history.pushState({}, '', '/admin');
  window.localStorage.clear();
  resetEventsCacheForTests();
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

function stubFetch(logoutResponse: { ok: boolean; status: number }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' ? input : input.toString();
    const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
    const method = (init?.method ?? 'GET').toUpperCase();

    if (path === '/logout' && method === 'POST') {
      return {
        ok: logoutResponse.ok,
        status: logoutResponse.status,
      } as Response;
    }
    if (path?.endsWith('/api/v1/me')) {
      return new Response(
        JSON.stringify({ userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (path?.endsWith('/api/v1/events')) {
      return new Response(JSON.stringify({ items: [], total: 0, page: 1, perPage: 50 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch to "${path}"`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('signOut() (DEC-154 wave 14 amendment)', () => {
  it('does NOT navigate to /login when the /logout response is not ok, and surfaces the failure as a visible alert', async () => {
    stubFetch({ ok: false, status: 400 });
    const assignSpy = stubLocationAssign();

    render(<App />);

    const signOutButton = await screen.findByRole('button', { name: 'Sign out' });
    signOutButton.click();

    // v12m-w14-c: a failed sign-out no longer rejects into the void -- the
    // click handler catches it into the Header's signOutError state, which
    // renders as a chq-error alert the operator can actually see. Matched by
    // text, not by role: the mounted /admin route carries its own alerts.
    expect(await screen.findByText('Sign-out failed: /logout responded 400')).toHaveClass(
      'chq-error',
    );
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('navigates to /login when the /logout response is ok', async () => {
    stubFetch({ ok: true, status: 200 });
    const assignSpy = stubLocationAssign();

    render(<App />);

    const signOutButton = await screen.findByRole('button', { name: 'Sign out' });
    signOutButton.click();

    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith('/login');
    });
  });
});
