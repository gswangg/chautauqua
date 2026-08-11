// Chunking helper for bulk submission status updates (DEC-193).
// Pure, dependency-free: the admin submissions table may select more ids
// than a single POST should carry, so bulk updates are split into
// fixed-size sequential batches. Committed batches must not be rolled back
// on a later batch's failure — see SubmissionsTable.tsx applyBulkStatus.

export const BULK_STATUS_CHUNK_SIZE = 500;

export function chunkSelection(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += BULK_STATUS_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + BULK_STATUS_CHUNK_SIZE));
  }
  return chunks;
}
