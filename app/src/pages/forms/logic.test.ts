import { describe, expect, it } from 'vitest';
import {
  defaultRuleValue,
  deserializeRule,
  EMPTY_RULE_STATE,
  guardEditableField,
  isLockedField,
  moveId,
  ruleReferenceCandidates,
  ruleValueControl,
  serializeRule,
} from './logic';
import type { FormField } from './types';

describe('serializeRule', () => {
  it('returns undefined when no field is selected (unconditional field)', () => {
    expect(serializeRule(EMPTY_RULE_STATE)).toBeUndefined();
    expect(serializeRule({ fieldId: '   ', op: 'eq', value: 'x' })).toBeUndefined();
  });

  it('serializes eq/ne as a trimmed single string', () => {
    expect(serializeRule({ fieldId: 'f1', op: 'eq', value: '  yes  ' })).toEqual({
      fieldId: 'f1',
      op: 'eq',
      value: 'yes',
    });
    expect(serializeRule({ fieldId: 'f1', op: 'ne', value: 'no' })).toEqual({
      fieldId: 'f1',
      op: 'ne',
      value: 'no',
    });
  });

  it('serializes in as a trimmed, non-empty string array', () => {
    expect(serializeRule({ fieldId: 'f1', op: 'in', value: 'a, b ,, c' })).toEqual({
      fieldId: 'f1',
      op: 'in',
      value: ['a', 'b', 'c'],
    });
  });

  it('round-trips through deserializeRule', () => {
    const rule = serializeRule({ fieldId: 'f1', op: 'in', value: 'a, b' });
    expect(deserializeRule(rule)).toEqual({ fieldId: 'f1', op: 'in', value: 'a, b' });

    const eqRule = serializeRule({ fieldId: 'f2', op: 'eq', value: 'x' });
    expect(deserializeRule(eqRule)).toEqual({ fieldId: 'f2', op: 'eq', value: 'x' });
  });

  it('deserializeRule maps a missing rule to the empty state', () => {
    expect(deserializeRule(undefined)).toEqual(EMPTY_RULE_STATE);
  });
});

describe('moveId (reorder list manipulation)', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('swaps with the previous entry when moving up', () => {
    expect(moveId(ids, 2, -1)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('swaps with the next entry when moving down', () => {
    expect(moveId(ids, 1, 1)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('is a no-op at the top boundary', () => {
    expect(moveId(ids, 0, -1)).toBe(ids);
  });

  it('is a no-op at the bottom boundary', () => {
    expect(moveId(ids, ids.length - 1, 1)).toBe(ids);
  });

  it('never mutates the input array', () => {
    const copy = ids.slice();
    moveId(ids, 1, -1);
    expect(ids).toEqual(copy);
  });
});

describe('locked-field guard', () => {
  const locked: FormField = {
    id: 'title',
    section: 'session',
    kind: 'text',
    label: 'Title',
    required: true,
    position: 0,
    locked: true,
  };
  const custom: FormField = { ...locked, id: 'f2', label: 'Custom', locked: false };

  it('isLockedField reflects the locked flag', () => {
    expect(isLockedField(locked)).toBe(true);
    expect(isLockedField(custom)).toBe(false);
  });

  it('guardEditableField throws for locked fields on edit and delete', () => {
    expect(() => guardEditableField(locked, 'edit')).toThrow(/cannot be edited/);
    expect(() => guardEditableField(locked, 'delete')).toThrow(/cannot be removed/);
  });

  it('guardEditableField does not throw for unlocked fields', () => {
    expect(() => guardEditableField(custom, 'edit')).not.toThrow();
    expect(() => guardEditableField(custom, 'delete')).not.toThrow();
  });
});

describe('ruleReferenceCandidates', () => {
  const fields: FormField[] = [
    { id: 'a', section: 'session', kind: 'text', label: 'A', required: true, position: 0, locked: true },
    { id: 'b', section: 'session', kind: 'dropdown', label: 'B', required: false, position: 1, locked: false, options: ['x', 'y'] },
    { id: 'c', section: 'session', kind: 'text', label: 'C', required: false, position: 2, locked: false },
  ];

  it('offers every existing field when creating a new one (appended at the end)', () => {
    expect(ruleReferenceCandidates(fields).map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('offers only earlier-positioned fields, excluding self, when editing', () => {
    expect(ruleReferenceCandidates(fields, fields[2]).map((f) => f.id)).toEqual(['a', 'b']);
    expect(ruleReferenceCandidates(fields, fields[0]).map((f) => f.id)).toEqual([]);
  });

  it('excludes file-kind fields (a file field cannot be a trigger)', () => {
    const withFile: FormField[] = [
      ...fields,
      { id: 'd', section: 'session', kind: 'file', label: 'Slides', required: false, position: 3, locked: false },
    ];
    expect(ruleReferenceCandidates(withFile).map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(
      ruleReferenceCandidates(withFile, { id: 'e', position: 4 }).map((f) => f.id),
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('ruleValueControl', () => {
  it('maps checkbox/number/dropdown triggers to their typed control', () => {
    expect(ruleValueControl({ kind: 'checkbox' })).toBe('boolean');
    expect(ruleValueControl({ kind: 'number' })).toBe('number');
    expect(ruleValueControl({ kind: 'dropdown' })).toBe('options');
  });

  it('falls back to text for text/long_text/file triggers and no trigger selected', () => {
    expect(ruleValueControl({ kind: 'text' })).toBe('text');
    expect(ruleValueControl({ kind: 'long_text' })).toBe('text');
    expect(ruleValueControl({ kind: 'file' })).toBe('text');
    expect(ruleValueControl(undefined)).toBe('text');
  });
});

describe('defaultRuleValue', () => {
  it('resets a boolean control to false', () => {
    expect(defaultRuleValue('boolean')).toBe('false');
  });

  it('resets number/options/text controls to the empty string', () => {
    expect(defaultRuleValue('number')).toBe('');
    expect(defaultRuleValue('options')).toBe('');
    expect(defaultRuleValue('text')).toBe('');
  });
});
