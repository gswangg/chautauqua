// DEC-263 (task w4-d, closing the OPEN item from task-w3-a's closeout):
// migrations/meta/ only has drizzle-kit snapshots for 0000-0004 because
// 0005-0014 were hand-authored and renumbered (DEC-164). That means
// `drizzle-kit generate` diffs schema.ts against the stale 0004 snapshot and
// emits spurious migrations re-creating tables/columns that already exist.
// `npm run db:generate` is deleted; this test is the real guard that a
// fresh clone's `npm run db:migrate` (which reads the migrations/ directory
// directly, unaffected by snapshot staleness) produces the schema every
// exported table in src/db/schema.ts expects.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "../src/db/schema";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

// Strips a leading/trailing identifier quote character (` " or ') if present.
function unquote(raw: string): string {
  const s = raw.trim();
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === "`" || first === '"' || first === "'") && first === last) {
      return s.slice(1, -1);
    }
  }
  return s;
}

// Parses every migrations/*.sql file into a table -> Set<column> map of
// columns known to be created by some migration, via CREATE TABLE (including
// IF NOT EXISTS, multi-line bodies) and ALTER TABLE ... ADD [COLUMN] ...
function parseMigrations(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const addColumn = (table: string, column: string) => {
    if (!result.has(table)) result.set(table, new Set());
    result.get(table)!.add(column);
  };

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files.length, "expected at least one migration file").toBeGreaterThan(0);

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

    // CREATE TABLE [IF NOT EXISTS] <name> ( ...body... ) — body may span
    // multiple lines and contain nested parens (e.g. column defaults), so
    // match up to the first `);` that closes the outermost paren group by
    // balancing depth rather than a naive non-greedy regex.
    const createRe = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([`"'\w]+)\s*\(/gi;
    let m: RegExpExecArray | null;
    while ((m = createRe.exec(sql)) !== null) {
      const tableName = unquote(m[1]!);
      // Find the matching close paren by depth-balancing from m.index.
      let depth = 0;
      let start = -1;
      for (let i = m.index; i < sql.length; i++) {
        const ch = sql[i];
        if (ch === "(") {
          if (depth === 0) start = i + 1;
          depth++;
        } else if (ch === ")") {
          depth--;
          if (depth === 0) {
            const body = sql.slice(start, i);
            // Column lines: leading quoted/bare identifier followed by a type.
            // Skip constraint-only lines (PRIMARY KEY(...), FOREIGN KEY, etc.)
            // by requiring the first token to be a quoted identifier, or a
            // bare identifier not equal to a known constraint keyword.
            const constraintKeywords = new Set(["PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "CONSTRAINT"]);
            for (const rawLine of body.split(",")) {
              const line = rawLine.trim();
              if (!line) continue;
              const colMatch = line.match(/^([`"'][^`"']+[`"']|\w+)\s+\S/);
              if (!colMatch) continue;
              const first = colMatch[1]!;
              const bareUpper = unquote(first).toUpperCase();
              const isQuoted = first[0] === "`" || first[0] === '"' || first[0] === "'";
              if (!isQuoted && constraintKeywords.has(bareUpper)) continue;
              addColumn(tableName, unquote(first));
            }
            break;
          }
        }
      }
    }

    // ALTER TABLE <t> ADD [COLUMN] <c> ...
    const alterRe = /ALTER TABLE\s+([`"'\w]+)\s+ADD\s+(?:COLUMN\s+)?([`"'\w]+)/gi;
    while ((m = alterRe.exec(sql)) !== null) {
      addColumn(unquote(m[1]!), unquote(m[2]!));
    }
  }

  return result;
}

describe("migration parity", () => {
  it("every exported table.column in src/db/schema.ts is created by some migration", () => {
    const fromMigrations = parseMigrations();
    const missing: string[] = [];

    for (const exportName of Object.keys(schema)) {
      const candidate = (schema as Record<string, unknown>)[exportName];
      // Only drizzle sqlite table objects have a getTableConfig-compatible shape.
      let config: ReturnType<typeof getTableConfig>;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config = getTableConfig(candidate as any);
      } catch {
        continue;
      }
      if (!config || !config.name || !Array.isArray(config.columns)) continue;

      const tableName = config.name;
      const known = fromMigrations.get(tableName);
      if (!known) {
        missing.push(`${tableName} (entire table missing from migrations/)`);
        continue;
      }
      for (const col of config.columns) {
        if (!known.has(col.name)) {
          missing.push(`${tableName}.${col.name}`);
        }
      }
    }

    expect(missing, `columns/tables in schema.ts with no creating migration:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every index declared in src/db/schema.ts is created by some migration (DEC-337)", () => {
    // Collect declared index names via getTableConfig(table).indexes; each
    // entry exposes its configured name at .config.name under drizzle-orm
    // 0.45.x.
    const declared: string[] = [];
    for (const exportName of Object.keys(schema)) {
      const candidate = (schema as Record<string, unknown>)[exportName];
      let config: ReturnType<typeof getTableConfig>;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config = getTableConfig(candidate as any);
      } catch {
        continue;
      }
      if (!config || !config.name || !Array.isArray(config.indexes)) continue;
      for (const idx of config.indexes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = (idx as any).config?.name ?? (idx as any).name;
        if (name) declared.push(name);
      }
    }
    expect(declared.length, "expected at least one declared index in schema.ts").toBeGreaterThan(0);

    // Collect every index name created by CREATE INDEX / CREATE UNIQUE INDEX
    // across migrations/*.sql, tolerant of backticks/quotes and IF NOT EXISTS.
    const created = new Set<string>();
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    const indexRe = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?([`"'\w]+)/gi;
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      let m: RegExpExecArray | null;
      while ((m = indexRe.exec(sql)) !== null) {
        created.add(unquote(m[1]!));
      }
    }

    const missing = declared.filter((name) => !created.has(name));
    expect(missing, `indexes in schema.ts with no creating migration:\n${missing.join("\n")}`).toEqual([]);
  });
});
