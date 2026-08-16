import { describe, expect, it } from 'vitest';
import {
  expandFullNameMapping,
  FULL_NAME_TARGET,
  importEmailProblem,
  mapImportRow,
  parseCsv,
  splitFullName,
  suggestMapping,
  toCsvVerbatim,
} from './csv';

// G13 (frame 08-contacts--15): the file-level import gate names the problem
// with an email cell per row — the three failure kinds the frame enumerates
// — validated by the ONE canonical rule (isValidEmail, src/domain/email.ts,
// DEC-454), never a second regex.
describe('importEmailProblem', () => {
  it('names a blank cell (frame kind 1: "Name and company present, email blank")', () => {
    expect(importEmailProblem('')).toBe('Email blank');
    expect(importEmailProblem('   ')).toBe('Email blank');
  });

  it('names a placeholder value (frame kind 2: Email reads "n/a")', () => {
    expect(importEmailProblem('n/a')).toBe('Email reads "n/a"');
    expect(importEmailProblem('N/A')).toBe('Email reads "N/A"');
    expect(importEmailProblem('none')).toBe('Email reads "none"');
  });

  it('names a missing @ (frame kind 3: Email missing an @ — "priya.example.com")', () => {
    expect(importEmailProblem('priya.example.com')).toBe('Email missing an @ — "priya.example.com"');
  });

  it('names an @-carrying value the canonical rule still refuses', () => {
    expect(importEmailProblem('priya@nodot')).toBe('Not a valid email address — "priya@nodot"');
    expect(importEmailProblem('a@b@c.com')).toBe('Not a valid email address — "a@b@c.com"');
  });

  it('returns null for an address isValidEmail accepts', () => {
    expect(importEmailProblem('priya@example.com')).toBeNull();
    expect(importEmailProblem('  Priya@Example.com ')).toBeNull();
  });
});

describe('parseCsv (re-exported from src/domain/csv.ts, DEC-011/DEC-179 wave-65 amendment)', () => {
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

  it('throws on an unterminated quoted field, naming the line (CsvParseError)', () => {
    expect(() => parseCsv('Name\n"unterminated')).toThrow(/Unterminated.*line 2/);
  });
});

describe('mapImportRow (re-exported from src/domain/contacts-parts/import.ts, DEC-478 wave-65 amendment)', () => {
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
  });

  it('throws for an unknown target field', () => {
    expect(() => mapImportRow({ 'First Name': 'bogus' }, header, ['Ada', 'Lovelace', 'a@b.com', 'x'])).toThrow(/unknown target field/);
  });

  it('maps phone and bio columns (DEC-290)', () => {
    const phoneBioHeader = ['Email', 'Phone', 'Bio'];
    const row = mapImportRow({ Email: 'email', Phone: 'phone', Bio: 'bio' }, phoneBioHeader, [
      'ada@example.com',
      '555-1234',
      'Computer scientist',
    ]);
    expect(row).toEqual({ email: 'ada@example.com', phone: '555-1234', bio: 'Computer scientist' });
  });

  it('rejects a custom.<key> target the same way the domain accepts it (regression: the deleted app copy used to reject this)', () => {
    const row = mapImportRow({ Email: 'email', Org: 'custom.department' }, ['Email', 'Org'], ['ada@example.com', 'Engineering']);
    expect(row).toEqual({ email: 'ada@example.com', customFields: { department: 'Engineering' } });
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

  it('previews exactly the rows it posts: expand -> mapImportRow matches expand -> toCsvVerbatim -> parseCsv -> mapImportRow', () => {
    const header = ['name', 'email'];
    const rows = [['Marcus Okafor', 'marcus@example.com']];
    const mapping = { name: FULL_NAME_TARGET, email: 'email' };

    const expanded = expandFullNameMapping(header, rows, mapping);
    const previewed = mapImportRow(expanded.mapping, expanded.header, expanded.rows[0]!);

    // The wizard's actual POST body: serialize the expanded rows verbatim,
    // then (on the server) re-parse and map -- must produce the identical
    // mapped row the preview already showed the organizer.
    const csvText = toCsvVerbatim([expanded.header, ...expanded.rows]);
    const reparsed = parseCsv(csvText);
    const posted = mapImportRow(expanded.mapping, reparsed[0]!, reparsed[1]!);

    expect(posted).toEqual(previewed);
  });
});

describe('toCsvVerbatim (DEC-179 amendment, wave 65: no formula-injection neutralization)', () => {
  it('serializes rows and quotes fields containing commas/quotes', () => {
    expect(toCsvVerbatim([['a', 'b'], ['Doe, Jane', 'Says "hi"']])).toBe('a,b\n"Doe, Jane","Says ""hi"""\n');
  });

  it('round-trips through parseCsv', () => {
    const rows = [
      ['name', 'email'],
      ['Priya Raman', 'priya@example.com'],
    ];
    expect(parseCsv(toCsvVerbatim(rows))).toEqual(rows);
  });

  it('leaves a leading =/+/-/@ cell untouched, byte-for-byte, across a re-parse round trip (the regression the toCsv/toCsvVerbatim naming split exists to prevent)', () => {
    const rows = [
      ['phone', 'title', 'formula'],
      ['+1 555 0100', '--Keynote--', '=SUM(A1:A2)'],
    ];
    const serialized = toCsvVerbatim(rows);
    expect(serialized).not.toContain("'+1 555 0100");
    expect(serialized).not.toContain("'--Keynote--");
    expect(serialized).not.toContain("'=SUM");
    expect(parseCsv(serialized)).toEqual(rows);
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

  it('maps an "org" header column to company (w40-h: was silently dropped)', () => {
    expect(suggestMapping(['Email', 'org'])).toEqual({
      Email: 'email',
      org: 'company',
    });
  });

  it('maps a combined "name" column to the fullName pseudo-target (fixture speakers.csv shape)', () => {
    expect(suggestMapping(['name', 'email', 'title', 'company', 'bio'])).toEqual({
      name: FULL_NAME_TARGET,
      email: 'email',
      title: 'title',
      company: 'company',
      bio: 'bio',
    });
  });
});
