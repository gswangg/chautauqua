import { describe, expect, it } from 'vitest';
import { formatAnswerValue } from './answerText';

describe('formatAnswerValue', () => {
  it('passes strings through unchanged', () => {
    expect(formatAnswerValue('hello world')).toBe('hello world');
  });

  it('stringifies numbers', () => {
    expect(formatAnswerValue(42)).toBe('42');
    expect(formatAnswerValue(0)).toBe('0');
  });

  it('renders booleans as Yes/No', () => {
    expect(formatAnswerValue(true)).toBe('Yes');
    expect(formatAnswerValue(false)).toBe('No');
  });

  it('joins arrays with ", ", recursing on each element', () => {
    expect(formatAnswerValue(['python', 'rust', 'go'])).toBe('python, rust, go');
    expect(formatAnswerValue([true, false, 3])).toBe('Yes, No, 3');
  });

  it('renders null, undefined, and empty string as an em dash', () => {
    expect(formatAnswerValue(null)).toBe('—');
    expect(formatAnswerValue(undefined)).toBe('—');
    expect(formatAnswerValue('')).toBe('—');
  });

  it('JSON.stringifies anything else', () => {
    expect(formatAnswerValue({ a: 1 })).toBe(JSON.stringify({ a: 1 }));
  });
});
