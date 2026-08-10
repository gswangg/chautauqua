// DEC-058: pure size-check logic for scripts/bundle-check.ts, split out
// (mirrors scripts/perf-smoke-lib.ts) so it can be unit-tested without any
// node: imports or filesystem access.

export const BUDGET_BYTES = 300 * 1024;

export interface ChunkSize {
  name: string;
  gzipBytes: number;
}

/**
 * Pure check: given the gzip size of every chunk plus the names of the two
 * entry chunks, verify the entry JS + entry CSS combined gzip size is
 * within budget. Throws with a descriptive message on failure.
 */
export function checkEntryBudget(
  chunks: ChunkSize[],
  entryJsName: string,
  entryCssName: string,
  budgetBytes: number = BUDGET_BYTES,
): { entryJsBytes: number; entryCssBytes: number; totalBytes: number } {
  const entryJs = chunks.find((c) => c.name === entryJsName);
  const entryCss = chunks.find((c) => c.name === entryCssName);
  if (!entryJs) {
    throw new Error(`bundle-check: entry JS chunk "${entryJsName}" not found among chunks`);
  }
  if (!entryCss) {
    throw new Error(`bundle-check: entry CSS chunk "${entryCssName}" not found among chunks`);
  }
  const totalBytes = entryJs.gzipBytes + entryCss.gzipBytes;
  if (totalBytes > budgetBytes) {
    throw new Error(
      `bundle-check: entry bundle (${entryJs.name} + ${entryCss.name}) gzip size ` +
        `${totalBytes} bytes exceeds budget of ${budgetBytes} bytes ` +
        `(over by ${totalBytes - budgetBytes} bytes)`,
    );
  }
  return { entryJsBytes: entryJs.gzipBytes, entryCssBytes: entryCss.gzipBytes, totalBytes };
}

export function findUniqueMatch(files: string[], pattern: RegExp, label: string): string {
  const matches = files.filter((f) => pattern.test(f));
  if (matches.length === 0) {
    throw new Error(`bundle-check: no ${label} entry chunk found matching ${pattern}`);
  }
  if (matches.length > 1) {
    throw new Error(
      `bundle-check: expected exactly one ${label} entry chunk matching ${pattern}, found ${matches.length}: ${matches.join(', ')}`,
    );
  }
  const only = matches[0];
  if (only === undefined) {
    throw new Error(`bundle-check: unreachable — no ${label} match found`);
  }
  return only;
}

export function formatBytes(n: number): string {
  return `${(n / 1024).toFixed(2)} kB`;
}
