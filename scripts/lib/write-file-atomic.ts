// Atomic publish for generated repo-root artifacts (DEC-739 wave-46).
//
// scripts/seed.ts and scripts/perf-seed.ts write .seed.sql / .perf-seed.sql
// / .seed-assets/* straight onto fixed repo-root paths that SIXTEEN test
// files spawn `npx tsx scripts/seed.ts` and then readFileSync back, under
// vitest.fast.config.ts's uncapped `pool: "threads"`. A plain writeFileSync
// is not atomic: a concurrent reader can observe a partially-written file
// (truncated, or mid-write) while the seed process is still flushing bytes.
//
// The fix is the standard POSIX atomic-publish idiom: write to a sibling
// temp file IN THE SAME DIRECTORY (never os.tmpdir() -- renameSync is only
// atomic within one filesystem, and a temp dir on a different mount would
// silently degrade to a copy) named uniquely per invoking process
// (`${target}.tmp-${pid}`, so two concurrent writers of the SAME target
// never collide), then renameSync it onto the final path. A rename is a
// single filesystem-level directory-entry swap: a reader either sees the
// old complete file or the new complete file, never a partial one.
//
// ONE owner (DEC-613): every generated repo-root artifact write in this
// repo routes through this single helper. Do not inline a second copy.
import { renameSync, unlinkSync, writeFileSync } from "node:fs";

export function writeFileAtomic(target: string, data: string | Uint8Array): void {
  const tmpPath = `${target}.tmp-${process.pid}`;
  let wrote = false;
  try {
    writeFileSync(tmpPath, data);
    wrote = true;
    renameSync(tmpPath, target);
  } catch (err) {
    if (wrote) {
      unlinkSync(tmpPath);
    }
    throw err;
  }
}
