// Shared unique-constraint-violation detector (DEC-111, wave 61 amendment).
//
// The D1/better-sqlite3-style driver wraps the raw SQLite error as `cause`
// (e.g. drizzle's DrizzleQueryError) rather than surfacing its message
// directly on `err` -- check both, matching a raw throw or a wrapped one.
export function isUniqueViolation(err: unknown, fragment: string): boolean {
  for (const candidate of [err, err instanceof Error ? err.cause : undefined]) {
    if (candidate instanceof Error && /UNIQUE constraint failed/i.test(candidate.message) && candidate.message.includes(fragment)) {
      return true;
    }
  }
  return false;
}
