// Pure helpers for scripts/walkthrough.ts, extracted for plain-vitest
// testing (dependency-free, no node:child_process/filesystem access — same
// pattern as scripts/perf-smoke-lib.ts / scripts/bundle-check-lib.ts).
// DEC-062.

/**
 * Fixed sequential order of the DEC-060 walkthrough modules. producer must
 * run first (it seeds the event other personas depend on), then review,
 * speaker, public, data, scale — in that order. The orchestrator
 * (DEC-062) is the sole place this order is defined; module files must not
 * reorder themselves. "scale" (DEC-089) runs last: it exercises >100-id
 * volume paths (bulk accept, chunking, purge refresh) against the same
 * seeded event the earlier areas already populated.
 */
export const WALKTHROUGH_AREAS = ["producer", "review", "speaker", "public", "data", "scale"] as const;

export type WalkthroughArea = (typeof WALKTHROUGH_AREAS)[number];

/** scripts/walkthrough/<area>.ts, relative to the repo root. */
export function modulePath(area: WalkthroughArea): string {
  return `scripts/walkthrough/${area}.ts`;
}

/**
 * Build the argv for `npx tsx scripts/walkthrough/<area>.ts --url <url>`,
 * as an array suitable for node:child_process spawn (no shell quoting
 * concerns).
 */
export function buildSpawnArgs(area: WalkthroughArea, url: string): string[] {
  return ["tsx", modulePath(area), "--url", url];
}

/** Parse `--url <value>` out of argv (process.argv.slice(2)); falls back
 * to defaultUrl if absent. Throws if `--url` is given with no value. */
export function parseUrlArg(argv: readonly string[], defaultUrl: string): string {
  const idx = argv.indexOf("--url");
  if (idx === -1) return defaultUrl;
  const value = argv[idx + 1];
  if (value === undefined) {
    throw new Error("walkthrough: --url flag given with no value");
  }
  return value;
}

export function formatAreaPass(area: WalkthroughArea): string {
  return `PASS ${area}`;
}

export function formatFailureMessage(area: WalkthroughArea): string {
  return `WALKTHROUGH FAILED at ${area}`;
}

export function formatMissingModulesMessage(missing: readonly string[]): string {
  return `walkthrough: missing module file(s): ${missing.join(", ")}`;
}
