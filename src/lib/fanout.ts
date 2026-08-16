// DEC-530 wave-70 amendment: the write side of a mail fan-out is a wave too.
// Five routes each ran `for (const item of items) { try { await
// mailer.send(...) } catch { failed.push(...) } }` — one recipient per round
// trip, sequentially. mapWithConcurrency replaces the sequencing (never the
// per-item try/catch, which stays exactly where each caller already has it)
// with a fixed-size worker pool so up to MAIL_FANOUT_CONCURRENCY sends are
// in flight at once.
//
// Pure core: no node:/cloudflare imports (DEC-002).
export const MAIL_FANOUT_CONCURRENCY = 6;

// mapWithConcurrency never rejects: every outcome — success or failure — is
// reported as a PromiseSettledResult so per-item failure handling stays
// entirely the caller's decision, exactly as it is today with a bare
// try/catch inside the loop body. Results are returned in INPUT order (index
// order), never completion order, so callers can zip them back against
// `items` without re-sorting.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  if (items.length === 0) return results;

  const effectiveLimit = Math.max(1, limit);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        const value = await fn(items[index] as T, index);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.min(effectiveLimit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
