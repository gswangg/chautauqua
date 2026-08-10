// Canonical id-list chunking for D1 bound-parameter limits (DEC-078).
// D1 rejects statements above ~100 bound parameters; queries typically bind
// eventId/status alongside the id list, so 90 leaves headroom. Every
// inArray(...) over an unbounded id list MUST iterate chunkIds batches.
export const ID_CHUNK_SIZE = 90;

export function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    out.push(ids.slice(i, i + ID_CHUNK_SIZE));
  }
  return out;
}
