// v12 mobile campaign w5 (DEC-621 wave-87 amendment): composeDraft.ts is
// the Comms phone landing draft card's sole producer/consumer contract --
// see the module's own doc comment.
import { afterEach, describe, expect, it } from 'vitest';
import { clearAllComposeDrafts, clearComposeDraft, readComposeDraft, writeComposeDraft, type ComposeDraft } from './composeDraft';

const EVENT_ID = 'evt-compose-draft';

afterEach(() => {
  window.localStorage.clear();
});

function draft(overrides: Partial<ComposeDraft> = {}): ComposeDraft {
  return {
    templateName: 'Acceptance',
    subject: 'Your talk has been accepted',
    recipientCount: 23,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

describe('readComposeDraft', () => {
  it('returns null when nothing is stored for this event', () => {
    expect(readComposeDraft(EVENT_ID)).toBeNull();
  });

  it('round-trips exactly what writeComposeDraft wrote', () => {
    writeComposeDraft(EVENT_ID, draft());
    expect(readComposeDraft(EVENT_ID)).toEqual(draft());
  });

  it('keys by event -- a draft for one event is invisible under another', () => {
    writeComposeDraft(EVENT_ID, draft());
    expect(readComposeDraft('some-other-event')).toBeNull();
  });

  it('supports a null templateName (a from-scratch draft with no template)', () => {
    writeComposeDraft(EVENT_ID, draft({ templateName: null }));
    expect(readComposeDraft(EVENT_ID)).toEqual(draft({ templateName: null }));
  });

  it('throws (fail loudly) on a stored record that is not valid JSON', () => {
    window.localStorage.setItem(`chq.composeDraft.${EVENT_ID}`, 'not json');
    expect(() => readComposeDraft(EVENT_ID)).toThrow();
  });

  it('throws (fail loudly) on a stored record missing a required field', () => {
    window.localStorage.setItem(
      `chq.composeDraft.${EVENT_ID}`,
      JSON.stringify({ subject: 'x', recipientCount: 1 }),
    );
    expect(() => readComposeDraft(EVENT_ID)).toThrow();
  });

  it('throws (fail loudly) on a stored record with a wrong-typed field', () => {
    window.localStorage.setItem(
      `chq.composeDraft.${EVENT_ID}`,
      JSON.stringify({ templateName: null, subject: 'x', recipientCount: '23', updatedAt: 1 }),
    );
    expect(() => readComposeDraft(EVENT_ID)).toThrow();
  });

  it('throws (fail loudly) on a negative or non-integer recipientCount', () => {
    window.localStorage.setItem(
      `chq.composeDraft.${EVENT_ID}`,
      JSON.stringify({ templateName: null, subject: 'x', recipientCount: -1, updatedAt: 1 }),
    );
    expect(() => readComposeDraft(EVENT_ID)).toThrow();
  });
});

describe('writeComposeDraft', () => {
  it('overwrites a previously stored record for the same event', () => {
    writeComposeDraft(EVENT_ID, draft({ recipientCount: 5 }));
    writeComposeDraft(EVENT_ID, draft({ recipientCount: 9 }));
    expect(readComposeDraft(EVENT_ID)?.recipientCount).toBe(9);
  });
});

describe('clearComposeDraft', () => {
  it('removes the stored record so readComposeDraft returns null again', () => {
    writeComposeDraft(EVENT_ID, draft());
    clearComposeDraft(EVENT_ID);
    expect(readComposeDraft(EVENT_ID)).toBeNull();
  });

  it('clearing one event never touches another event\'s draft', () => {
    writeComposeDraft(EVENT_ID, draft());
    writeComposeDraft('some-other-event', draft());
    clearComposeDraft(EVENT_ID);
    expect(readComposeDraft('some-other-event')).toEqual(draft());
  });

  it('is a no-op (never throws) when nothing is stored', () => {
    expect(() => clearComposeDraft(EVENT_ID)).not.toThrow();
  });
});

// DEC-621 (wave-25 amendment): storageKey carries no user/org scoping, so on
// a shared browser the next organizer's Comms 390 landing could render the
// previous organizer's draft. clearAllComposeDrafts() is the sign-out-time
// sweep that closes that leak.
describe('clearAllComposeDrafts', () => {
  it('removes exactly the chq.composeDraft.* keys and leaves an unrelated chq. key untouched', () => {
    writeComposeDraft(EVENT_ID, draft());
    writeComposeDraft('some-other-event', draft({ recipientCount: 7 }));
    window.localStorage.setItem('chq.somethingElse', 'unrelated-value');

    clearAllComposeDrafts();

    expect(readComposeDraft(EVENT_ID)).toBeNull();
    expect(readComposeDraft('some-other-event')).toBeNull();
    expect(window.localStorage.getItem('chq.somethingElse')).toBe('unrelated-value');
  });

  it('is a no-op on an empty store', () => {
    expect(window.localStorage.length).toBe(0);
    expect(() => clearAllComposeDrafts()).not.toThrow();
    expect(window.localStorage.length).toBe(0);
  });
});

// signOut() itself lives in ../../lib/api.ts, which this task does not own a
// test harness for: src/lib/api.test.ts (the existing api.ts test file)
// stubs `fetch` but never stubs `window.location`, so it doesn't already
// carry the harness this task's brief says is a precondition for adding a
// signOut test there. Per the brief, this is a source-level receipt instead
// of a new harness: signOut() (src/lib/api.ts) calls clearAllComposeDrafts()
// (this module) before window.location.assign(destination), so every sign-out
// sweeps every stored compose draft before the browser navigates away.
describe('signOut() wiring (source-level receipt, no window.location harness available to this task)', () => {
  it('api.ts calls clearAllComposeDrafts() before window.location.assign() inside signOut()', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const apiSource = fs.readFileSync(
      path.resolve(__dirname, '../../lib/api.ts'),
      'utf8',
    );
    const signOutBody = apiSource.slice(
      apiSource.indexOf('export async function signOut'),
      apiSource.indexOf('export async function apiPostBlob'),
    );
    expect(signOutBody).toContain('clearAllComposeDrafts()');
    expect(signOutBody.indexOf('clearAllComposeDrafts()')).toBeLessThan(
      signOutBody.indexOf('window.location.assign('),
    );
  });
});
