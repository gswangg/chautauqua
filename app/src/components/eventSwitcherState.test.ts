import { describe, expect, it } from 'vitest';
import {
  buildNewEventPayload,
  defaultTimezone,
  isValidSlugLocal,
  isValidTimezoneLocal,
  mergeFieldErrors,
  reconcileStoredEventId,
  resolveCurrentEvent,
  validateNewEventForm,
  type NewEventForm,
} from './eventSwitcherState';

const baseForm: NewEventForm = {
  name: 'DevCon',
  slug: 'devcon',
  startDate: '2026-06-01',
  endDate: '2026-06-03',
  timezone: 'America/Chicago',
  location: 'Austin, TX',
};

describe('isValidSlugLocal', () => {
  it('accepts lowercase letters, digits, hyphens', () => {
    expect(isValidSlugLocal('devcon-2026')).toBe(true);
  });

  it('rejects uppercase, spaces, and empty', () => {
    expect(isValidSlugLocal('DevCon')).toBe(false);
    expect(isValidSlugLocal('dev con')).toBe(false);
    expect(isValidSlugLocal('')).toBe(false);
  });
});

describe('isValidTimezoneLocal', () => {
  it('accepts a valid IANA timezone', () => {
    expect(isValidTimezoneLocal('America/Chicago')).toBe(true);
  });

  it('rejects garbage and empty', () => {
    expect(isValidTimezoneLocal('Not/A/Zone')).toBe(false);
    expect(isValidTimezoneLocal('')).toBe(false);
    expect(isValidTimezoneLocal('   ')).toBe(false);
  });
});

describe('validateNewEventForm', () => {
  it('has no errors for a valid form', () => {
    expect(validateNewEventForm(baseForm)).toEqual({});
  });

  it('requires name, slug, dates, timezone', () => {
    expect(
      validateNewEventForm({ name: '', slug: '', startDate: '', endDate: '', timezone: '', location: '' }),
    ).toEqual({
      name: 'Required',
      slug: 'Required',
      startDate: 'Required',
      endDate: 'Required',
      timezone: 'Required',
    });
  });

  it('flags a malformed slug', () => {
    expect(validateNewEventForm({ ...baseForm, slug: 'Dev Con!' })).toEqual({
      slug: 'Must match [a-z0-9-]+',
    });
  });

  it('flags an invalid timezone', () => {
    expect(validateNewEventForm({ ...baseForm, timezone: 'Nowhere' })).toEqual({
      timezone: 'Must be a valid IANA timezone',
    });
  });

  it('flags endDate before startDate', () => {
    expect(validateNewEventForm({ ...baseForm, startDate: '2026-06-05', endDate: '2026-06-01' })).toEqual({
      endDate: 'Must be on or after startDate',
    });
  });
});

describe('buildNewEventPayload', () => {
  it('trims fields and omits blank location', () => {
    expect(buildNewEventPayload({ ...baseForm, location: '  ' })).toEqual({
      name: 'DevCon',
      slug: 'devcon',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      timezone: 'America/Chicago',
      location: undefined,
    });
  });

  it('includes a trimmed location when present', () => {
    expect(buildNewEventPayload(baseForm)).toEqual({
      name: 'DevCon',
      slug: 'devcon',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      timezone: 'America/Chicago',
      location: 'Austin, TX',
    });
  });
});

describe('resolveCurrentEvent', () => {
  const items = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
  ];

  it('picks the stored id when it matches an item', () => {
    expect(resolveCurrentEvent(items, 'b')).toEqual({ id: 'b', name: 'Beta' });
  });

  it('falls back to items[0] when stored id has no match', () => {
    expect(resolveCurrentEvent(items, 'missing')).toEqual({ id: 'a', name: 'Alpha' });
  });

  it('falls back to items[0] when nothing stored', () => {
    expect(resolveCurrentEvent(items, null)).toEqual({ id: 'a', name: 'Alpha' });
  });

  it('returns null for an empty list', () => {
    expect(resolveCurrentEvent([], null)).toBeNull();
  });
});

describe('reconcileStoredEventId (DEC-024 amendment, wave 51)', () => {
  const items = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
  ];

  it('a stored id that matches an item survives unchanged', () => {
    expect(reconcileStoredEventId(items, 'b')).toEqual({ eventId: 'b', changed: false });
  });

  it('a stored id absent from the list is replaced by items[0], changed', () => {
    expect(reconcileStoredEventId(items, 'missing')).toEqual({ eventId: 'a', changed: true });
  });

  it('an empty list resolves to null; changed reflects whether a non-null id was thrown away', () => {
    expect(reconcileStoredEventId([], 'a')).toEqual({ eventId: null, changed: true });
    expect(reconcileStoredEventId([], null)).toEqual({ eventId: null, changed: false });
  });

  it('a null stored id falls back to items[0], changed', () => {
    expect(reconcileStoredEventId(items, null)).toEqual({ eventId: 'a', changed: true });
  });
});

describe('mergeFieldErrors', () => {
  it('returns local errors unchanged when there are no server fields', () => {
    expect(mergeFieldErrors({ name: 'Required' }, undefined)).toEqual({ name: 'Required' });
  });

  it('overlays server field errors onto local ones', () => {
    expect(mergeFieldErrors({ name: 'Required' }, { slug: 'Already in use' })).toEqual({
      name: 'Required',
      slug: 'Already in use',
    });
  });

  it('lets server errors override local ones for the same field', () => {
    expect(mergeFieldErrors({ slug: 'Must match [a-z0-9-]+' }, { slug: 'Already in use' })).toEqual({
      slug: 'Already in use',
    });
  });
});

// Post-eval polish: Time zone is a `required` field, so it must not open
// empty behind a placeholder that reads as a default -- that is what raised
// the native "Please fill out this field" bubble on an apparently-answered
// field.
describe('defaultTimezone', () => {
  it('returns a value the form\'s own validator accepts', () => {
    const tz = defaultTimezone();
    expect(tz).not.toBe('');
    expect(isValidTimezoneLocal(tz)).toBe(true);
  });

  it('a form carrying it passes validation with no timezone error', () => {
    const errors = validateNewEventForm({ ...baseForm, timezone: defaultTimezone() });
    expect(errors.timezone).toBeUndefined();
  });
});
