import { describe, expect, it } from 'vitest';
import { emailLocalPart, identityLabel, initialsForm } from './identity';

describe('initialsForm', () => {
  it('formats a two-part name as "GIVEN S."', () => {
    expect(initialsForm('Jordan Alvarez')).toBe('JORDAN A.');
  });

  it('uses the first part as the given name and the last part\'s initial for more than two parts', () => {
    expect(initialsForm('Mary Jane Watson')).toBe('MARY W.');
  });

  it('uppercases a single-word name as-is, with no period', () => {
    expect(initialsForm('Madonna')).toBe('MADONNA');
  });
});

describe('emailLocalPart', () => {
  it('uppercases everything before the @', () => {
    expect(emailLocalPart('organizer@example.com')).toBe('ORGANIZER');
  });
});

describe('identityLabel', () => {
  it('prefers the initials form of a non-empty name', () => {
    expect(identityLabel('Jordan Alvarez', 'organizer@example.com')).toBe('JORDAN A.');
  });

  it('falls back to the email local-part for a null name', () => {
    expect(identityLabel(null, 'organizer@example.com')).toBe('ORGANIZER');
  });

  it('falls back to the email local-part for an undefined name', () => {
    expect(identityLabel(undefined, 'organizer@example.com')).toBe('ORGANIZER');
  });

  it('falls back to the email local-part for a whitespace-only name', () => {
    expect(identityLabel('   ', 'organizer@example.com')).toBe('ORGANIZER');
  });

  it('never returns a bare email or the literal "undefined"', () => {
    const label = identityLabel(undefined, 'organizer@example.com');
    expect(label).not.toBe('organizer@example.com');
    expect(label.toLowerCase()).not.toContain('undefined');
  });
});
