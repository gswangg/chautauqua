// DEC-111 amendment (wave 54): migrations/0032_task_title_unique.sql opened
// with `CREATE TEMP TABLE _task_dedupe_keeper AS ...`. node:sqlite and
// better-sqlite3 (the engines test/task-title-unique.test.ts and every other
// migration-replaying test in this repo run against) accept temp objects
// without complaint -- so a fully green migration test suite was NOT
// evidence the migration could apply on the real target, Cloudflare D1.
// D1's SQL authorizer rejects CREATE TEMP TABLE/VIEW/TRIGGER, ATTACH
// DATABASE, PRAGMA statements, and explicit transaction control
// (BEGIN/COMMIT/ROLLBACK/SAVEPOINT -- D1 wraps each migration file in its
// own transaction already) with SQLITE_AUTH. That gap hid a migration that
// silently never applied -- and therefore never recorded itself in
// d1_migrations, and never created task_event_id_title_idx -- for six
// waves, 500ing every accept-a-submission call once a same-titled task
// already existed. This test enumerates every migrations/*.sql file (via
// readdir, never a hand-listed manifest — a hand-listed manifest desyncs
// the moment a new migration file is added) and fails loudly on any of the
// above D1-forbidden constructs. The exemption ledger below starts EMPTY:
// no migration should ever need one of these constructs, so a new failure
// here means the new migration needs to be rewritten, not exempted.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

// D1-forbidden constructs. Each regex is matched case-insensitively against
// the full file text (comments are not stripped: a construct commented out
// is not actually run, but nothing in this repo's migrations relies on that
// distinction, and a false positive here just means writing the comment
// differently — far cheaper than a false negative shipping another 500).
const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: "CREATE TEMP/TEMPORARY TABLE", pattern: /CREATE\s+TEMP(?:ORARY)?\s+TABLE/i },
  { name: "CREATE TEMP/TEMPORARY VIEW", pattern: /CREATE\s+TEMP(?:ORARY)?\s+VIEW/i },
  { name: "CREATE TEMP/TEMPORARY TRIGGER", pattern: /CREATE\s+TEMP(?:ORARY)?\s+TRIGGER/i },
  { name: "ATTACH DATABASE", pattern: /\bATTACH\s+(?:DATABASE\s+)?/i },
  { name: "PRAGMA", pattern: /\bPRAGMA\s+/i },
  { name: "BEGIN (transaction control)", pattern: /\bBEGIN\s+(?:DEFERRED\s+|IMMEDIATE\s+|EXCLUSIVE\s+)?TRANSACTION\b|^\s*BEGIN\s*;/im },
  { name: "COMMIT (transaction control)", pattern: /\bCOMMIT\s*(?:TRANSACTION)?\s*;/i },
  { name: "ROLLBACK (transaction control)", pattern: /\bROLLBACK\s*(?:TRANSACTION)?\s*;/i },
  { name: "SAVEPOINT (transaction control)", pattern: /\bSAVEPOINT\s+/i },
];

// Exemption ledger: `{ file: [construct names allowed for that file] }`.
// Starts EMPTY -- see header. Do not add an entry without also recording,
// right here, why D1 will actually accept the construct for that file.
const EXEMPTIONS: Record<string, string[]> = {};

// Strips `-- ...` line comments before scanning, so a migration's own prose
// (e.g. explaining, in a header, why a past version of the file used a
// forbidden construct and no longer does) can't produce a false positive.
// SQL string literals containing `--` are not a concern in this repo's
// migrations (no migration embeds `--` inside a quoted string), so a naive
// line-based strip is sufficient here.
function stripLineComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

describe("migrations/*.sql dialect scan (D1-forbidden constructs, DEC-111 amendment wave 54)", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  it("found at least one migration file to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} contains no D1-forbidden constructs`, () => {
      const sql = stripLineComments(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      const exempt = new Set(EXEMPTIONS[file] ?? []);
      const violations = FORBIDDEN.filter((f) => !exempt.has(f.name) && f.pattern.test(sql)).map((f) => f.name);
      expect(violations, `${file} uses D1-forbidden construct(s): ${violations.join(", ")}`).toEqual([]);
    });
  }
});
