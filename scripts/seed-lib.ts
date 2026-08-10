// Pure helpers for scripts/seed.ts, extracted for plain-vitest testing.
// Not part of the pure-core (src/{auth,domain,forms,mail,lib}) — this is
// seed tooling per DEC-001 — but kept dependency-free anyway so it's easy
// to unit test without touching the filesystem or a real D1 binding.

/** SQL-quote a value for a single-column-value literal in an INSERT statement. */
export function sqlQuote(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`cannot quote non-finite number: ${value}`);
    }
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  // String: escape single quotes by doubling, per SQL string-literal rules.
  return `'${value.replace(/'/g, "''")}'`;
}

/** Builds a single-row INSERT statement. Column order follows the row's own key order. */
export function insertStmt(table: string, row: Record<string, string | number | boolean | null | undefined>): string {
  const columns = Object.keys(row);
  if (columns.length === 0) {
    throw new Error(`insertStmt: empty row for table '${table}'`);
  }
  const values = columns.map((c) => sqlQuote(row[c]));
  // Double-quote column identifiers: SQLite reserves words like `order`
  // (participant.order) as keywords, and this keeps the generator safe for
  // any future column name too.
  const quotedColumns = columns.map((c) => `"${c}"`);
  return `INSERT INTO ${table} (${quotedColumns.join(", ")}) VALUES (${values.join(", ")});`;
}

/** Builds a DELETE-all statement for idempotent reseeding. */
export function deleteAllStmt(table: string): string {
  return `DELETE FROM ${table};`;
}

export const ADDITIONAL_SUBMISSION_STATUS_COUNTS: Readonly<Record<string, number>> = {
  pending: 15,
  accept_queue: 4,
  accepted: 5,
  decline_queue: 1,
  declined: 2,
};

/**
 * Deterministic status distribution for the N "additional" synthetic
 * submissions (beyond the 3 fixture ones, which are all 'pending'),
 * matching the swarm task's ~18 pending / 4 accept_queue / 5 accepted /
 * 1 decline_queue / 2 declined split across all 30 submissions.
 */
export function additionalSubmissionStatuses(count: number): string[] {
  const total = Object.values(ADDITIONAL_SUBMISSION_STATUS_COUNTS).reduce((a, b) => a + b, 0);
  if (count !== total) {
    throw new Error(`additionalSubmissionStatuses: expected count ${total}, got ${count}`);
  }
  const out: string[] = [];
  for (const [status, n] of Object.entries(ADDITIONAL_SUBMISSION_STATUS_COUNTS)) {
    for (let i = 0; i < n; i++) {
      out.push(status);
    }
  }
  return out;
}

/** Zero-padded deterministic id, e.g. seedId('submission', 4) === 'seed_submission_0004'. */
export function seedId(kind: string, n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`seedId: n must be a non-negative integer, got ${n}`);
  }
  return `seed_${kind}_${String(n).padStart(4, "0")}`;
}
