import { describe, expect, it } from 'vitest';
import { fromRows, toRows, reservedValue, RESERVED_CUSTOM_FIELD_KEYS } from './customFields';

const { dietary: DIETARY_KEY, travel: TRAVEL_KEY, accessibility: ACCESSIBILITY_KEY } =
  RESERVED_CUSTOM_FIELD_KEYS;

const EMPTY_RESERVED = { dietary: '', travel: '', accessibility: '' };

describe('toRows', () => {
  it('returns every non-reserved entry in stable key order', () => {
    expect(
      toRows({ b: '2', a: '1', [TRAVEL_KEY]: 'Arrival May 11', [DIETARY_KEY]: 'Vegan', [ACCESSIBILITY_KEY]: 'Wheelchair' }),
    ).toEqual([
      { key: 'b', value: '2' },
      { key: 'a', value: '1' },
    ]);
  });

  it('returns an empty array for an empty map', () => {
    expect(toRows({})).toEqual([]);
  });

  it('excludes all three reserved keys entirely', () => {
    expect(toRows({ [TRAVEL_KEY]: 'x', [DIETARY_KEY]: 'y', [ACCESSIBILITY_KEY]: 'z' })).toEqual([]);
  });
});

describe('reservedValue', () => {
  it('reads each reserved key', () => {
    const fields = { [DIETARY_KEY]: 'Vegan', [TRAVEL_KEY]: 'Arrival May 11', [ACCESSIBILITY_KEY]: 'Wheelchair' };
    expect(reservedValue(fields, DIETARY_KEY)).toBe('Vegan');
    expect(reservedValue(fields, TRAVEL_KEY)).toBe('Arrival May 11');
    expect(reservedValue(fields, ACCESSIBILITY_KEY)).toBe('Wheelchair');
  });

  it('defaults to empty string when absent', () => {
    expect(reservedValue({}, TRAVEL_KEY)).toBe('');
  });
});

describe('fromRows', () => {
  it('trims keys', () => {
    const result = fromRows(EMPTY_RESERVED, [{ key: '  shirt  ', value: 'Large' }]);
    expect(result).toEqual({ fields: { shirt: 'Large' } });
  });

  it('drops a row blank in both key and value', () => {
    const result = fromRows(EMPTY_RESERVED, [{ key: '  ', value: '  ' }]);
    expect(result).toEqual({ fields: {} });
  });

  it('errors on a blank key with a non-blank value', () => {
    const result = fromRows(EMPTY_RESERVED, [{ key: '  ', value: 'Vegetarian' }]);
    expect(result).toEqual({ error: expect.stringContaining('must also have a key') });
  });

  it('errors on duplicate trimmed keys, naming the key', () => {
    const result = fromRows(EMPTY_RESERVED, [
      { key: 'shirt', value: 'M' },
      { key: ' shirt ', value: 'L' },
    ]);
    expect(result).toEqual({ error: expect.stringContaining('"shirt"') });
  });

  it('errors on a hand-typed reserved key, pointing at the matching labeled field', () => {
    expect(fromRows(EMPTY_RESERVED, [{ key: DIETARY_KEY, value: 'Vegan' }])).toEqual({
      error: expect.stringContaining('Dietary'),
    });
    expect(fromRows(EMPTY_RESERVED, [{ key: TRAVEL_KEY, value: 'Arrival May 11' }])).toEqual({
      error: expect.stringContaining('Travel'),
    });
    expect(fromRows(EMPTY_RESERVED, [{ key: ACCESSIBILITY_KEY, value: 'Wheelchair' }])).toEqual({
      error: expect.stringContaining('Accessibility'),
    });
  });

  it('includes each reserved key only when its text is non-blank', () => {
    expect(fromRows(EMPTY_RESERVED, [])).toEqual({ fields: {} });
    expect(fromRows({ dietary: '  ', travel: '  ', accessibility: '  ' }, [])).toEqual({ fields: {} });
    expect(
      fromRows({ dietary: 'Vegetarian', travel: 'Arrival May 11, aisle seat', accessibility: '' }, []),
    ).toEqual({
      fields: { [DIETARY_KEY]: 'Vegetarian', [TRAVEL_KEY]: 'Arrival May 11, aisle seat' },
    });
  });

  it('round-trips through toRows(fromRows(x)) at a fixpoint', () => {
    const reserved = { dietary: 'Vegetarian', travel: 'Arrival May 11, aisle seat', accessibility: 'Wheelchair access' };
    const rows = [
      { key: 'shirt', value: 'L' },
      { key: 'seat', value: 'aisle' },
    ];
    const first = fromRows(reserved, rows);
    expect('fields' in first).toBe(true);
    if (!('fields' in first)) throw new Error('expected fields');

    const rowsAgain = toRows(first.fields);
    const reservedAgain = {
      dietary: reservedValue(first.fields, DIETARY_KEY),
      travel: reservedValue(first.fields, TRAVEL_KEY),
      accessibility: reservedValue(first.fields, ACCESSIBILITY_KEY),
    };
    const second = fromRows(reservedAgain, rowsAgain);
    expect(second).toEqual(first);

    // fixpoint: applying toRows/fromRows again produces the same map
    expect('fields' in second && second.fields).toEqual(first.fields);
  });
});
