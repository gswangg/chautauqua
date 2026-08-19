// v12 mobile campaign w5 (DEC-621 wave-87 amendment): composeDraft.ts is
// the Comms phone landing draft card's sole producer/consumer contract --
// see the module's own doc comment.
import { afterEach, describe, expect, it } from 'vitest';
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
