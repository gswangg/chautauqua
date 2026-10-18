import { describe, expect, it } from 'vitest';
import {
  buildEventPatch,
  buildPortalSettingsPayload,
  isValidHexColorOrEmpty,
  validateResourceForm,
  validateRoomForm,
  validateTrackForm,
  type EventSettingsForm,
} from './formState';

const baseEventForm: EventSettingsForm = {
  name: 'DevCon',
  slug: 'devcon',
  startDate: '2026-06-01',
  endDate: '2026-06-03',
  location: 'Austin, TX',
  timezone: 'America/Chicago',
  recordPrefix: 'DC',
  logoUrl: '',
  accentColor: '',
};

describe('buildEventPatch', () => {
  it('returns an empty object when nothing changed', () => {
    expect(buildEventPatch(baseEventForm, { ...baseEventForm })).toEqual({});
  });

  it('includes only the fields that changed', () => {
    const current = { ...baseEventForm, name: 'DevCon 2026' };
    expect(buildEventPatch(baseEventForm, current)).toEqual({ name: 'DevCon 2026' });
  });

  it('sends location as null when cleared, not an empty string', () => {
    const current = { ...baseEventForm, location: '' };
    const initial = { ...baseEventForm, location: 'Austin, TX' };
    expect(buildEventPatch(initial, current)).toEqual({ location: null });
  });

  it('bundles logoUrl+accentColor together under branding when either changes', () => {
    const current = { ...baseEventForm, accentColor: '#336699' };
    expect(buildEventPatch(baseEventForm, current)).toEqual({
      branding: { logoUrl: null, accentColor: '#336699' },
    });
  });

  it('never includes recordPrefix — the events PATCH contract has no such field', () => {
    const current = { ...baseEventForm, recordPrefix: 'ZZ' };
    expect(buildEventPatch(baseEventForm, current)).toEqual({});
  });
});

describe('isValidHexColorOrEmpty', () => {
  it('accepts empty (clears the field)', () => {
    expect(isValidHexColorOrEmpty('')).toBe(true);
    expect(isValidHexColorOrEmpty('   ')).toBe(true);
  });

  it('accepts a well-formed hex color', () => {
    expect(isValidHexColorOrEmpty('#336699')).toBe(true);
    expect(isValidHexColorOrEmpty('#FFF')).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isValidHexColorOrEmpty('#zzzzzz')).toBe(false);
    expect(isValidHexColorOrEmpty('#12345')).toBe(false);
  });

  it('accepts a bare hex color without a leading # (DEC-371 amendment, wave 43: unified grammar tolerates it)', () => {
    expect(isValidHexColorOrEmpty('336699')).toBe(true);
  });
});

describe('buildPortalSettingsPayload', () => {
  // multi-portal decision 72: the form no longer carries the portal's logo
  // or accent, so the PUT never sends them and the server keeps what is
  // stored
  it('trims a blank welcome note to null (full-replace upsert semantics)', () => {
    expect(buildPortalSettingsPayload({ welcomeMessage: '  ', showResources: true })).toEqual({
      welcomeMessage: null,
      showResources: true,
    });
  });

  it('passes non-blank values through unchanged, and never sends a logo or accent', () => {
    const payload = buildPortalSettingsPayload({ welcomeMessage: 'Hi!', showResources: false });
    expect(payload).toEqual({ welcomeMessage: 'Hi!', showResources: false });
    expect(payload).not.toHaveProperty('logoUrl');
    expect(payload).not.toHaveProperty('accentColor');
  });
});

describe('validateResourceForm', () => {
  it('requires both title and content', () => {
    expect(validateResourceForm({ title: '', content: '' })).toEqual({ title: 'Required', content: 'Required' });
  });

  it('trims whitespace-only values as missing', () => {
    expect(validateResourceForm({ title: '   ', content: 'ok' })).toEqual({ title: 'Required' });
  });

  it('has no errors for a valid form', () => {
    expect(validateResourceForm({ title: 'Code of Conduct', content: 'Be excellent to each other.' })).toEqual({});
  });
});

describe('validateTrackForm', () => {
  it('requires a name and validates the color when present', () => {
    expect(validateTrackForm({ name: '', color: 'nope' })).toEqual({
      name: 'Required',
      color: 'Must be a hex color like #336699',
    });
  });

  it('allows an empty color (no swatch)', () => {
    expect(validateTrackForm({ name: 'AI', color: '' })).toEqual({});
  });
});

describe('validateRoomForm', () => {
  it('requires a name; capacity is optional', () => {
    expect(validateRoomForm({ name: '', capacity: '' })).toEqual({ name: 'Required' });
  });

  it('rejects a negative or non-integer capacity', () => {
    expect(validateRoomForm({ name: 'Hall A', capacity: '-3' })).toEqual({
      capacity: 'Must be a non-negative integer',
    });
    expect(validateRoomForm({ name: 'Hall A', capacity: '3.5' })).toEqual({
      capacity: 'Must be a non-negative integer',
    });
  });

  it('accepts a non-negative integer capacity', () => {
    expect(validateRoomForm({ name: 'Hall A', capacity: '200' })).toEqual({});
  });
});
