import { describe, expect, it } from 'vitest';
import { splitSpeakerName } from './NewSubmissionModal';

describe('splitSpeakerName (DEC-749)', () => {
  it('splits everything before the final whitespace run as firstName, the last token as lastName', () => {
    expect(splitSpeakerName('Jordan Alvarez')).toEqual({ firstName: 'Jordan', lastName: 'Alvarez' });
  });

  it('keeps a multi-word given name together, splitting only on the final run', () => {
    expect(splitSpeakerName('Mary Jane Watson')).toEqual({ firstName: 'Mary Jane', lastName: 'Watson' });
  });

  it('collapses an internal run of multiple spaces', () => {
    expect(splitSpeakerName('Jordan   Alvarez')).toEqual({ firstName: 'Jordan', lastName: 'Alvarez' });
  });

  it('gives firstName only (empty lastName) for a single token', () => {
    expect(splitSpeakerName('Cher')).toEqual({ firstName: 'Cher', lastName: '' });
  });

  it('trims leading/trailing whitespace', () => {
    expect(splitSpeakerName('  Jordan Alvarez  ')).toEqual({ firstName: 'Jordan', lastName: 'Alvarez' });
  });

  it('returns empty strings for an empty/whitespace-only value', () => {
    expect(splitSpeakerName('')).toEqual({ firstName: '', lastName: '' });
    expect(splitSpeakerName('   ')).toEqual({ firstName: '', lastName: '' });
  });
});
