import { describe, expect, it } from 'vitest';
import { isEmptyMappedRow, mapImportRow, parseCsv, suggestMapping } from './csv';

describe('parseCsv', () => {
  it('parses a simple header + rows', () => {
    const rows = parseCsv('First,Last,Email\nAda,Lovelace,ada@example.com\n');
    expect(rows).toEqual([
      ['First', 'Last', 'Email'],
      ['Ada', 'Lovelace', 'ada@example.com'],
    ]);
  });

  it('handles quoted fields with embedded commas and doubled quotes', () => {
    const rows = parseCsv('Name,Bio\n"Doe, Jane","Says ""hi"""\n');
    expect(rows).toEqual([
      ['Name', 'Bio'],
      ['Doe, Jane', 'Says "hi"'],
    ]);
  });

  it('throws on an unterminated quoted field', () => {
    expect(() => parseCsv('Name\n"unterminated')).toThrow(/Unterminated/);
  });
});

describe('mapImportRow', () => {
  const header = ['First Name', 'Last Name', 'Email Address', 'Org'];
  const mapping = { 'First Name': 'firstName', 'Last Name': 'lastName', 'Email Address': 'email', Org: 'custom.department' };

  it('maps columns to standard + custom fields', () => {
    const row = mapImportRow(mapping, header, ['Ada', 'Lovelace', 'ada@example.com', 'Engineering']);
    expect(row).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      customFields: { department: 'Engineering' },
    });
  });

  it('ignores unmapped columns', () => {
    const row = mapImportRow({ 'Email Address': 'email' }, header, ['Ada', 'Lovelace', 'ada@example.com', 'Engineering']);
    expect(row).toEqual({ email: 'ada@example.com' });
  });

  it('returns {} when the mapped email is missing or blank', () => {
    const row = mapImportRow(mapping, header, ['Ada', 'Lovelace', '', 'Engineering']);
    expect(row).toEqual({});
    expect(isEmptyMappedRow(row)).toBe(true);
  });

  it('throws for an unknown target field', () => {
    expect(() => mapImportRow({ 'First Name': 'bogus' }, header, ['Ada', 'Lovelace', 'a@b.com', 'x'])).toThrow(/unknown target field/);
  });
});

describe('suggestMapping (P1 fix, w1-f: auto-map obvious CSV headers)', () => {
  it('maps exact standard-field-named columns without user interaction', () => {
    expect(suggestMapping(['Email', 'First Name', 'Last Name'])).toEqual({
      Email: 'email',
      'First Name': 'firstName',
      'Last Name': 'lastName',
    });
  });

  it('matches aliases case- and punctuation-insensitively', () => {
    expect(suggestMapping(['E-Mail', 'first_name', 'Surname', 'Organization'])).toEqual({
      'E-Mail': 'email',
      first_name: 'firstName',
      Surname: 'lastName',
      Organization: 'company',
    });
  });

  it('leaves unrecognized columns unmapped', () => {
    expect(suggestMapping(['Shirt Size', 'Notes'])).toEqual({});
  });
});
