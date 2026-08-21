// DEC-154 (wave 158 amendment): signOut() must navigate to the URL the
// server's /logout redirect named (carrying ?signed-out=1), not a
// hardcoded /login path -- otherwise loginStatusLine's confirmation line
// (DESIGN-RULINGS.md item 24) never renders. Mirrors
// api.unauthorized.render.test.ts's location-stubbing idiom; .render.test.tsx
// name pins this to jsdom via vitest.config.ts's blanket glob without
// needing to edit either config.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalLocation = window.location;

function stubLocationAssign(): ReturnType<typeof vi.fn> {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: assignSpy },
  });
  return assignSpy;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('signOut() navigates to the server-named redirect target (DEC-154, wave 158)', () => {
  it('navigates to res.url when it carries signed-out=1', async () => {
    // jsdom's Response doesn't honor a `url` constructor option, so stub it
    // directly via defineProperty rather than passing it to `new Response`.
    const res = new Response(null, { status: 200 });
    Object.defineProperty(res, 'url', { value: 'http://localhost/login?signed-out=1' });
    vi.stubGlobal('fetch', vi.fn(async () => res));

    const assignSpy = stubLocationAssign();
    const { signOut } = await import('./api');

    await signOut();

    expect(assignSpy).toHaveBeenCalledTimes(1);
    const call = assignSpy.mock.calls[0];
    if (!call) throw new Error('expected assign to have been called');
    const destination = call[0] as string;
    expect(destination).toContain('signed-out=1');
    expect(destination).toBe('http://localhost/login?signed-out=1');
  });

  it('falls back to the literal /login?signed-out=1 when res.url is empty', async () => {
    const res = new Response(null, { status: 200 });
    Object.defineProperty(res, 'url', { value: '' });
    vi.stubGlobal('fetch', vi.fn(async () => res));

    const assignSpy = stubLocationAssign();
    const { signOut } = await import('./api');

    await signOut();

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('/login?signed-out=1');
  });

  it('falls back to the literal when res.url does not carry the query', async () => {
    const res = new Response(null, { status: 200 });
    Object.defineProperty(res, 'url', { value: 'http://localhost/login' });
    vi.stubGlobal('fetch', vi.fn(async () => res));

    const assignSpy = stubLocationAssign();
    const { signOut } = await import('./api');

    await signOut();

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('/login?signed-out=1');
  });

  it('still throws on a non-ok response and never navigates', async () => {
    const res = new Response(null, { status: 500 });
    vi.stubGlobal('fetch', vi.fn(async () => res));

    const assignSpy = stubLocationAssign();
    const { signOut } = await import('./api');

    await expect(signOut()).rejects.toThrow('Sign-out failed: /logout responded 500');
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
