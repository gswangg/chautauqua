// v12 mobile campaign w5 (DEC-621 wave-87 amendment): composeDraft.ts is
// the Comms phone landing draft card's sole producer/consumer contract --
// see the module's own doc comment.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearComposeDraft, readComposeDraft, writeComposeDraft, type ComposeDraft } from './composeDraft';

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

  it('returns null and evicts the key (does not throw) on a stored record that is not valid JSON -- DEC-621 wave-33', () => {
    const key = `chq.composeDraft.${EVENT_ID}`;
    window.localStorage.setItem(key, 'not json');
    expect(readComposeDraft(EVENT_ID)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('returns null and evicts the key on a stored record missing a required field -- DEC-621 wave-33', () => {
    const key = `chq.composeDraft.${EVENT_ID}`;
    window.localStorage.setItem(key, JSON.stringify({ subject: 'x', recipientCount: 1 }));
    expect(readComposeDraft(EVENT_ID)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('returns null and evicts the key on a stored record with a wrong-typed field -- DEC-621 wave-33', () => {
    const key = `chq.composeDraft.${EVENT_ID}`;
    window.localStorage.setItem(
      key,
      JSON.stringify({ templateName: null, subject: 'x', recipientCount: '23', updatedAt: 1 }),
    );
    expect(readComposeDraft(EVENT_ID)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('returns null and evicts the key on a negative or non-integer recipientCount -- DEC-621 wave-33', () => {
    const key = `chq.composeDraft.${EVENT_ID}`;
    window.localStorage.setItem(
      key,
      JSON.stringify({ templateName: null, subject: 'x', recipientCount: -1, updatedAt: 1 }),
    );
    expect(readComposeDraft(EVENT_ID)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('throws on an empty eventId -- a caller error, not a storage boundary case', () => {
    expect(() => readComposeDraft('')).toThrow();
  });
});

describe('writeComposeDraft', () => {
  it('overwrites a previously stored record for the same event', () => {
    writeComposeDraft(EVENT_ID, draft({ recipientCount: 5 }));
    writeComposeDraft(EVENT_ID, draft({ recipientCount: 9 }));
    expect(readComposeDraft(EVENT_ID)?.recipientCount).toBe(9);
  });

  it('still throws (fail loudly) on a caller-supplied malformed draft -- the shape stays loud', () => {
    expect(() =>
      writeComposeDraft(EVENT_ID, { recipientCount: -1 } as unknown as ComposeDraft),
    ).toThrow();
  });

  it('does not re-throw when localStorage.setItem fails, and leaves no key behind -- DEC-621 wave-33', () => {
    const key = `chq.composeDraft.${EVENT_ID}`;
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      expect(() => writeComposeDraft(EVENT_ID, draft())).not.toThrow();
    } finally {
      setItemSpy.mockRestore();
    }
    expect(window.localStorage.getItem(key)).toBeNull();
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
