import { describe, expect, it } from 'vitest';
import { fromRows, toRows, travelValue, TRAVEL_KEY } from './customFields';

describe('toRows', () => {
  it('returns every non-travel entry in stable key order', () => {
    expect(toRows({ b: '2', a: '1', [TRAVEL_KEY]: 'Arrival May 11' })).toEqual([
      { key: 'b', value: '2' },
      { key: 'a', value: '1' },
    ]);
  });

  it('returns an empty array for an empty map', () => {
    expect(toRows({})).toEqual([]);
  });

  it('excludes the travel key entirely', () => {
    expect(toRows({ [TRAVEL_KEY]: 'x' })).toEqual([]);
  });
});

describe('travelValue', () => {
  it('reads the reserved travel key', () => {
    expect(travelValue({ [TRAVEL_KEY]: 'Arrival May 11' })).toBe('Arrival May 11');
  });

  it('defaults to empty string when absent', () => {
    expect(travelValue({})).toBe('');
  });
});

describe('fromRows', () => {
  it('trims keys', () => {
    const result = fromRows('', [{ key: '  dietary  ', value: 'Vegetarian' }]);
    expect(result).toEqual({ fields: { dietary: 'Vegetarian' } });
  });

  it('drops a row blank in both key and value', () => {
    const result = fromRows('', [{ key: '  ', value: '  ' }]);
    expect(result).toEqual({ fields: {} });
  });

  it('errors on a blank key with a non-blank value', () => {
    const result = fromRows('', [{ key: '  ', value: 'Vegetarian' }]);
    expect(result).toEqual({ error: expect.stringContaining('must also have a key') });
  });

  it('errors on duplicate trimmed keys, naming the key', () => {
    const result = fromRows('', [
      { key: 'dietary', value: 'Vegetarian' },
      { key: ' dietary ', value: 'Vegan' },
    ]);
    expect(result).toEqual({ error: expect.stringContaining('"dietary"') });
  });

  it('errors on a hand-typed travel_logistics key, pointing at the labeled field', () => {
    const result = fromRows('', [{ key: TRAVEL_KEY, value: 'Arrival May 11' }]);
    expect(result).toEqual({ error: expect.stringContaining('Travel & logistics') });
  });

  it('includes the travel key only when the travel text is non-blank', () => {
    expect(fromRows('', [])).toEqual({ fields: {} });
    expect(fromRows('   ', [])).toEqual({ fields: {} });
    expect(fromRows('Arrival May 11, aisle seat; dietary: Vegetarian', [])).toEqual({
      fields: { [TRAVEL_KEY]: 'Arrival May 11, aisle seat; dietary: Vegetarian' },
    });
  });

  it('accepts the SPK-15 rubric scenario as prose, not JSON', () => {
    const result = fromRows('Arrival May 11, aisle seat; dietary: Vegetarian', []);
    expect(result).toEqual({
      fields: { [TRAVEL_KEY]: 'Arrival May 11, aisle seat; dietary: Vegetarian' },
    });
  });

  it('round-trips through toRows(fromRows(x)) at a fixpoint', () => {
    const travel = 'Arrival May 11, aisle seat; dietary: Vegetarian';
    const rows = [
      { key: 'dietary', value: 'Vegetarian' },
      { key: 'seat', value: 'aisle' },
    ];
    const first = fromRows(travel, rows);
    expect('fields' in first).toBe(true);
    if (!('fields' in first)) throw new Error('expected fields');

    const rowsAgain = toRows(first.fields);
    const travelAgain = first.fields[TRAVEL_KEY] ?? '';
    const second = fromRows(travelAgain, rowsAgain);
    expect(second).toEqual(first);

    // fixpoint: applying toRows/fromRows again produces the same map
    expect('fields' in second && second.fields).toEqual(first.fields);
  });
});
