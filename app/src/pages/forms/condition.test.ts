import { describe, expect, it } from 'vitest';
import { describeCondition, fieldsByIdMap } from './condition';
import type { FormFieldRule } from './types';

const FIELDS = fieldsByIdMap([
  { id: 'f-format', label: 'Format' },
  { id: 'f-level', label: 'Level' },
]);

describe('describeCondition', () => {
  it('describes an eq rule as "is"', () => {
    const rule: FormFieldRule = { fieldId: 'f-format', op: 'eq', value: 'Workshop' };
    expect(describeCondition(rule, FIELDS)).toBe('Shown when Format is "Workshop"');
  });

  it('describes an ne rule as "is not"', () => {
    const rule: FormFieldRule = { fieldId: 'f-format', op: 'ne', value: 'Talk' };
    expect(describeCondition(rule, FIELDS)).toBe('Shown when Format is not "Talk"');
  });

  it('describes an in rule as "is one of"', () => {
    const rule: FormFieldRule = { fieldId: 'f-level', op: 'in', value: ['Beginner', 'Intermediate'] };
    expect(describeCondition(rule, FIELDS)).toBe('Shown when Level is one of "Beginner", "Intermediate"');
  });

  it('renders a deleted field reference without leaking the raw id', () => {
    const rule: FormFieldRule = { fieldId: 'f-missing', op: 'eq', value: 'x' };
    expect(describeCondition(rule, FIELDS)).toBe('Shown when a deleted field matches');
    expect(describeCondition(rule, FIELDS)).not.toContain('f-missing');
  });
});
