import { describe, expect, it } from 'vitest';
import { duplicatePairReason } from './duplicatePairReason';

describe('duplicatePairReason', () => {
  it('names an exact email match, with no company clause when both sides have a company', () => {
    expect(
      duplicatePairReason('email', [{ company: 'Acme' }, { company: 'Acme Corp' }]),
    ).toBe('Same email domain');
  });

  it('appends the company clause when exactly one side has no company (the frame\'s own words, DC.html:159)', () => {
    expect(duplicatePairReason('email', [{ company: 'Acme' }, { company: null }])).toBe(
      'Same email domain, one has no company',
    );
  });

  it('names a name+company match, with no company clause when both sides share a company', () => {
    expect(
      duplicatePairReason('name_and_company', [{ company: 'Acme' }, { company: 'Acme' }]),
    ).toBe('Same name and company');
  });

  it('appends the company clause for a name+company match when one side has no company', () => {
    expect(
      duplicatePairReason('name_and_company', [{ company: undefined }, { company: 'Acme' }]),
    ).toBe('Same name and company, one has no company');
  });

  it('names a last-name-only match, with no company clause when neither side has a company', () => {
    expect(duplicatePairReason('name', [{ company: null }, { company: '' }])).toBe('Same last name');
  });

  it('appends the company clause for a last-name-only match when one side has no company', () => {
    expect(
      duplicatePairReason('name', [{ company: 'Old Co' }, { company: '' }]),
    ).toBe('Same last name, one has no company');
  });

  it('never appends the company clause when both sides are missing company (equal, not "one")', () => {
    expect(duplicatePairReason('email', [{ company: null }, { company: undefined }])).toBe(
      'Same email domain',
    );
  });

  it('falls back to the base rule only for any group that is not exactly a pair (3+ contact email-bucket group)', () => {
    expect(
      duplicatePairReason('email', [{ company: null }, { company: 'Acme' }, { company: null }]),
    ).toBe('Same email domain');
    expect(duplicatePairReason('name', [{ company: 'Acme' }])).toBe('Same last name');
  });
});
