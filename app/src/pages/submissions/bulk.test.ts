import { describe, expect, it } from 'vitest';
import { BULK_STATUS_CHUNK_SIZE, chunkSelection } from './bulk';

describe('chunkSelection', () => {
  it('returns an empty array for empty input', () => {
    expect(chunkSelection([])).toEqual([]);
  });

  it('splits an exact multiple of the chunk size into equal chunks', () => {
    const ids = Array.from({ length: BULK_STATUS_CHUNK_SIZE * 2 }, (_, i) => `id-${i}`);
    const chunks = chunkSelection(ids);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(BULK_STATUS_CHUNK_SIZE);
    expect(chunks[1]).toHaveLength(BULK_STATUS_CHUNK_SIZE);
  });

  it('puts the remainder in a final smaller chunk', () => {
    const ids = Array.from({ length: BULK_STATUS_CHUNK_SIZE + 3 }, (_, i) => `id-${i}`);
    const chunks = chunkSelection(ids);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(BULK_STATUS_CHUNK_SIZE);
    expect(chunks[1]).toHaveLength(3);
  });

  it('preserves order of ids across chunks', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const chunks = chunkSelection(ids);
    expect(chunks.flat()).toEqual(ids);
  });

  it('keeps a single chunk when below the limit', () => {
    const ids = ['a', 'b', 'c'];
    expect(chunkSelection(ids)).toEqual([['a', 'b', 'c']]);
  });
});
