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

// DEC-528: a multi-row INSERT binds one parameter per COLUMN per row, not one
// per row — ID_CHUNK_SIZE (sized for inArray's one-bind-per-id) is the wrong
// budget for `.values(rows)`. This helper derives columns-per-row from the
// rows themselves (never a hand-declared count, which drifts silently when a
// column is added) and slices so every emitted chunk stays under the D1
// bound-parameter ceiling.
export const MAX_D1_BOUND_PARAMS = 100;

export function chunkRowsForInsert<T extends Record<string, unknown>>(rows: T[]): T[][] {
  if (rows.length === 0) return [];
  const first = rows[0];
  if (!first) throw new Error("chunkRowsForInsert: unreachable — non-empty array with undefined first row");
  const columnsPerRow = Object.keys(first).length;
  for (const row of rows) {
    const keys = Object.keys(row).length;
    if (keys !== columnsPerRow) {
      throw new Error(
        `chunkRowsForInsert: ragged row batch — expected ${columnsPerRow} keys per row, got ${keys}`,
      );
    }
  }
  const rowsPerChunk = Math.max(1, Math.floor((MAX_D1_BOUND_PARAMS - 10) / columnsPerRow));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerChunk) {
    out.push(rows.slice(i, i + rowsPerChunk));
  }
  return out;
}
