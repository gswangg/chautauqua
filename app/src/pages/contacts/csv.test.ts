import { describe, expect, it } from 'vitest';
import {
  expandFullNameMapping,
  FULL_NAME_TARGET,
  isEmptyMappedRow,
  mapImportRow,
  parseCsv,
  splitFullName,
  suggestMapping,
  toCsv,
} from './csv';

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

describe('splitFullName (P1 fix, w1-f: combined name column import)', () => {
  it('splits on the first space', () => {
    expect(splitFullName('Priya Raman')).toEqual({ firstName: 'Priya', lastName: 'Raman' });
  });

  it('keeps multi-word surnames together', () => {
    expect(splitFullName('Dana Kowalski Jr')).toEqual({ firstName: 'Dana', lastName: 'Kowalski Jr' });
  });

  it('handles a single-token name', () => {
    expect(splitFullName('Prince')).toEqual({ firstName: 'Prince', lastName: '' });
  });

  it('handles blank input', () => {
    expect(splitFullName('  ')).toEqual({ firstName: '', lastName: '' });
  });
});

describe('mapImportRow with FULL_NAME_TARGET', () => {
  it('splits a fullName-mapped column into firstName/lastName in the preview row', () => {
    const header = ['name', 'email'];
    const mapping = { name: FULL_NAME_TARGET, email: 'email' };
    const row = mapImportRow(mapping, header, ['Marcus Okafor', 'marcus@example.com']);
    expect(row).toEqual({ firstName: 'Marcus', lastName: 'Okafor', email: 'marcus@example.com' });
  });
});

describe('expandFullNameMapping (fixture speakers.csv shape: name,email,title,company,bio)', () => {
  it('rewrites a combined name column into two columns the server understands', () => {
    const header = ['name', 'email', 'company'];
    const rows = [
      ['Priya Raman', 'priya@example.com', 'Latticework Systems'],
      ['Marcus Okafor', 'marcus@example.com', 'Cloudreach Labs'],
    ];
    const mapping = { name: FULL_NAME_TARGET, email: 'email', company: 'company' };

    const expanded = expandFullNameMapping(header, rows, mapping);

    expect(expanded.mapping).toEqual({
      'name (first)': 'firstName',
      'name (last)': 'lastName',
      email: 'email',
      company: 'company',
    });
    expect(expanded.rows).toEqual([
      ['Priya', 'Raman', 'priya@example.com', 'Latticework Systems'],
      ['Marcus', 'Okafor', 'marcus@example.com', 'Cloudreach Labs'],
    ]);

    // Round-trips through mapImportRow using only STANDARD_IMPORT_FIELDS
    // targets (no throw, since 'fullName' never reaches the server).
    const mapped = mapImportRow(expanded.mapping, expanded.header, expanded.rows[0]!);
    expect(mapped).toEqual({ firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com', company: 'Latticework Systems' });
  });

  it('passes through unchanged when no column is mapped to fullName', () => {
    const header = ['firstName', 'lastName'];
    const rows = [['Ada', 'Lovelace']];
    const mapping = { firstName: 'firstName', lastName: 'lastName' };
    expect(expandFullNameMapping(header, rows, mapping)).toEqual({ header, rows, mapping });
  });
});

describe('toCsv', () => {
  it('serializes rows and quotes fields containing commas/quotes', () => {
    expect(toCsv([['a', 'b'], ['Doe, Jane', 'Says "hi"']])).toBe('a,b\n"Doe, Jane","Says ""hi"""\n');
  });

  it('round-trips through parseCsv', () => {
    const rows = [
      ['name', 'email'],
      ['Priya Raman', 'priya@example.com'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
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

  it('maps a combined "name" column to the fullName pseudo-target (fixture speakers.csv shape)', () => {
    expect(suggestMapping(['name', 'email', 'title', 'company', 'bio'])).toEqual({
      name: FULL_NAME_TARGET,
      email: 'email',
      title: 'title',
      company: 'company',
    });
  });
});
