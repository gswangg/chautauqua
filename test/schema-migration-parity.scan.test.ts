// DEC-556 amendment (wave 55): wave 54's P0 was `task_event_id_title_idx` --
// declared in src/db/schema/tasks.ts AND in migrations/0032_task_title_
// unique.sql, yet it existed in no deployed database (the migration's
// forbidden CREATE TEMP TABLE never applied -- see test/migration-
// dialect.scan.test.ts). That test now covers "the migration cannot run".
// This one covers the adjacent drifts the dialect scan can't see: an index
// declared in src/db/schema/** with no migration behind it at all, a
// migration index whose column order differs from the schema's declared
// order, and an .onConflictDoNothing/.onConflictDoUpdate target tuple with
// no unique index backing it anywhere.
//
// Three legs, all text/AST-light scans in the house style (readdir over the
// real trees, never a hand-listed manifest -- see test/serial-write-
// scan.test.ts's header for why a hand-listed manifest desyncs):
//
//   1. Enumerate every `index("name")`/`uniqueIndex("name")` declaration
//      under src/db/schema/**, with its table, its ORDERED column list (db
//      column names, resolved through that table's own column map -- a
//      `t.propName` reference is meaningless without it), and uniqueness.
//      Declarations split across lines (name on one line, `.on(...)` args
//      on following lines -- see src/db/schema/crm.ts:92-94) are handled:
//      the regex below matches across `\n` by default (character classes
//      like `[^)]` and `\s` include newlines).
//   2. Enumerate every `CREATE [UNIQUE] INDEX` under migrations/**, with
//      its name, table and ordered column list.
//   3. Two-directional parity on (name, table, ordered columns,
//      uniqueness): a schema declaration with no migration fails; a
//      migration index the schema doesn't declare fails as loudly; a name
//      present on both sides with different columns/order/uniqueness fails
//      naming both sites.
//   4. Third leg: every `.onConflictDoNothing({ target: ... })` /
//      `.onConflictDoUpdate({ target: ... })` call site under
//      src/server/repo/** (enumerated, never hand-listed) must have its
//      target tuple backed by a uniqueIndex in the schema AND a CREATE
//      UNIQUE INDEX in migrations -- UNLESS the target is exactly the
//      table's own primary key column (e.g. schema.contact.id, or
//      schema.rateLimit.key which is PRIMARY KEY via `.primaryKey()`
//      inline rather than the shared `id()` helper), which needs no index.
//
// The exemption ledger (EXEMPTIONS below) starts EMPTY, same contract as
// migration-dialect.scan.test.ts's: a stale entry (naming a drift the scan
// no longer finds) fails just as loudly as an unlisted one, so a lane that
// fixes a drift must delete its ledger line, not leave it to rot.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SCHEMA_DIR = join(ROOT, "src", "db", "schema");
const MIGRATIONS_DIR = join(ROOT, "migrations");
const REPO_DIRS = ["src/server/repo"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

interface SchemaIndexEntry {
  name: string;
  table: string;
  columns: string[]; // ordered db column names
  unique: boolean;
  file: string; // repo-relative
}

interface TableInfo {
  columns: Map<string, string>; // JS prop name -> db column name
  primaryKeyDbCols: string[]; // ordered db column names making up the PK
}

// ---------------------------------------------------------------------------
// Leg 1: schema/**
// ---------------------------------------------------------------------------

/** Locates the full text of every `sqliteTable(...)` call in `src` via
 * paren-balancing from each `sqliteTable(` occurrence (mirrors serial-
 * write-scan's brace-balancing approach for for/while blocks). */
function findSqliteTableCalls(src: string): { start: number; end: number; body: string }[] {
  const out: { start: number; end: number; body: string }[] = [];
  const re = /\bsqliteTable\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const parenStart = re.lastIndex - 1;
    let depth = 1;
    let i = parenStart + 1;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    out.push({ start: m.index, end: i, body: src.slice(parenStart + 1, i - 1) });
  }
  return out;
}

const COLUMN_ID_HELPER = /(\w+):\s*id\(\)/g;
const COLUMN_CREATED_AT_HELPER = /(\w+):\s*createdAt\(\)/g;
const COLUMN_UPDATED_AT_HELPER = /(\w+):\s*updatedAt\(\)/g;
// `propName: text("db_name"...)` / `integer("db_name"...)` -- captures the
// rest of that column's declaration up to the next top-level column (next
// line starting with an identifier + colon at the same indent) is overkill;
// we only need the db name and whether `.primaryKey()` appears before the
// next column starts, so we scan line-by-line instead (see below).
const COLUMN_TEXT_OR_INT = /(\w+):\s*(?:text|integer)\(\s*"([^"]+)"/;

// `.on(...)` may be separated from the `uniqueIndex("name")` call by a line
// break (drizzle's builder chain is routinely wrapped when a trailing
// `.where(sql`...`)` partial-index predicate follows, as on
// file_previous_file_id_unique). Without the `\s*` the declaration is
// invisible to this scan, which silently degrades into a false PASS on the
// schema->migration leg and a false FAIL ("no schema file declares it") on
// the migration->schema leg. Anything chained after `.on(...)` (e.g.
// `.where(...)`) is deliberately not parsed here: SQLite partial-index
// predicates are compared by neither leg.
const INDEX_DECL = /(\w+):\s*(uniqueIndex|index)\(\s*"([^"]+)"\s*,?\s*\)\s*\.on\(([^)]*)\)/g;

/** Builds { JS prop name -> db column name } and the table's primary-key db
 * column list, from a sqliteTable(...) call body's column-definition object
 * (the first `{...}` argument). Column defs in this codebase are always
 * single-line, so a per-line scan is sufficient (a multi-line column def
 * would silently produce no primaryKeyDbCols entry for that column and no
 * columns-map entry, surfacing as an "unresolved t.prop" failure below
 * rather than a false pass). */
function parseColumns(body: string): TableInfo {
  const columns = new Map<string, string>();
  const primaryKeyDbCols: string[] = [];

  for (const m of body.matchAll(COLUMN_ID_HELPER)) {
    columns.set(m[1]!, "id");
    primaryKeyDbCols.push("id");
  }
  for (const m of body.matchAll(COLUMN_CREATED_AT_HELPER)) columns.set(m[1]!, "created_at");
  for (const m of body.matchAll(COLUMN_UPDATED_AT_HELPER)) columns.set(m[1]!, "updated_at");

  for (const line of body.split("\n")) {
    const m = COLUMN_TEXT_OR_INT.exec(line);
    if (!m) continue;
    const [, prop, dbName] = m;
    columns.set(prop!, dbName!);
    if (/\.primaryKey\(\)/.test(line)) primaryKeyDbCols.push(dbName!);
  }

  // Composite primary key: `primaryKey({ columns: [t.a, t.b] })`.
  const compositePk = /primaryKey\(\s*\{\s*columns:\s*\[([^\]]*)\]/.exec(body);
  if (compositePk) {
    for (const propMatch of compositePk[1]!.matchAll(/t\.(\w+)/g)) {
      const dbName = columns.get(propMatch[1]!);
      if (dbName) primaryKeyDbCols.push(dbName);
    }
  }

  return { columns, primaryKeyDbCols };
}

function scanSchemaIndexes(): { indexes: SchemaIndexEntry[]; tables: Map<string, TableInfo> } {
  const indexes: SchemaIndexEntry[] = [];
  const tables = new Map<string, TableInfo>();

  const files = readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "common.ts")
    .sort();

  for (const file of files) {
    const abs = join(SCHEMA_DIR, file);
    const src = readFileSync(abs, "utf8");
    const relFile = relative(ROOT, abs).split("\\").join("/");

    for (const call of findSqliteTableCalls(src)) {
      const tableNameMatch = /"([^"]+)"/.exec(call.body);
      if (!tableNameMatch) continue; // not a sqliteTable("name", ...) call (shouldn't happen)
      const table = tableNameMatch[1]!;
      const info = parseColumns(call.body);
      tables.set(table, info);

      INDEX_DECL.lastIndex = 0;
      let idxMatch: RegExpExecArray | null;
      while ((idxMatch = INDEX_DECL.exec(call.body))) {
        const [, , kind, name, onArgs] = idxMatch;
        const columnsOrdered: string[] = [];
        for (const propMatch of onArgs!.matchAll(/t\.(\w+)/g)) {
          const prop = propMatch[1]!;
          const dbName = info.columns.get(prop);
          if (!dbName) {
            throw new Error(
              `schema-migration-parity scan: ${relFile} index "${name}" on table "${table}" references ` +
                `t.${prop}, which parseColumns() could not resolve to a db column name. Either the scan's ` +
                `column-def regex needs to widen, or this is a real typo in the schema.`,
            );
          }
          columnsOrdered.push(dbName);
        }
        indexes.push({ name: name!, table, columns: columnsOrdered, unique: kind === "uniqueIndex", file: relFile });
      }
    }
  }

  return { indexes, tables };
}

// ---------------------------------------------------------------------------
// Leg 2: migrations/**
// ---------------------------------------------------------------------------

interface MigrationIndexEntry {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  file: string;
}

// A single alternation so CREATEs and DROPs are seen in true source order:
// the migration corpus is a script, not a bag of CREATEs, and an index that a
// later migration drops must NOT be required to have a schema declaration
// (0043 drops file_previous_file_id_idx, created back in 0000, and replaces it
// with the partial-unique file_previous_file_id_unique). Comparing the
// cumulative *effect* of migrations against the schema is the only model that
// stays correct once any index is ever dropped or recreated.
const CREATE_OR_DROP_INDEX =
  /CREATE\s+(UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+`([^`]+)`\s+ON\s+`([^`]+)`\s*\(([^)]*)\)|DROP\s+INDEX(?:\s+IF\s+EXISTS)?\s+`([^`]+)`/gi;

/** The set of indexes LIVE after the whole migration corpus has been applied,
 * in filename order (drizzle's numeric prefixes are the apply order). */
function scanMigrationIndexes(): MigrationIndexEntry[] {
  const live = new Map<string, MigrationIndexEntry>();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    CREATE_OR_DROP_INDEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CREATE_OR_DROP_INDEX.exec(sql))) {
      const [, unique, name, table, colsRaw, droppedName] = m;
      if (droppedName) {
        if (!live.has(droppedName)) {
          throw new Error(
            `schema-migration-parity scan: ${file} drops index "${droppedName}", which no earlier ` +
              `migration creates -- the drop is dead (or misspelled), and applying this corpus from ` +
              `scratch would fail on it.`,
          );
        }
        live.delete(droppedName);
        continue;
      }
      const columns = [...colsRaw!.matchAll(/`([^`]+)`/g)].map((c) => c[1]!);
      live.set(name!, { name: name!, table: table!, columns, unique: Boolean(unique), file });
    }
  }
  return [...live.values()];
}

// ---------------------------------------------------------------------------
// Leg 3: onConflictDoNothing/onConflictDoUpdate target tuples
// ---------------------------------------------------------------------------

interface ConflictTargetHit {
  file: string;
  line: number;
  method: "onConflictDoNothing" | "onConflictDoUpdate";
  targetProps: string[]; // e.g. ["pipelineEntry.orgId", "pipelineEntry.contactId"]
}

function walkFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkFiles(full, out);
    else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) out.push(full);
  }
}

// Matches `target: schema.foo.bar` (single) or `target: [schema.foo.bar, schema.foo.baz, ...]` (array).
const CONFLICT_TARGET = /\.(onConflictDoNothing|onConflictDoUpdate)\(\s*\{\s*target:\s*(\[[^\]]*\]|schema\.\w+\.\w+)/g;

function scanConflictTargets(): ConflictTargetHit[] {
  const files: string[] = [];
  for (const dir of REPO_DIRS) walkFiles(join(ROOT, dir), files);

  const hits: ConflictTargetHit[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    CONFLICT_TARGET.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CONFLICT_TARGET.exec(src))) {
      const method = m[1] as "onConflictDoNothing" | "onConflictDoUpdate";
      const targetProps = [...m[2]!.matchAll(/schema\.(\w+)\.(\w+)/g)].map((p) => `${p[1]}.${p[2]}`);
      const line = src.slice(0, m.index).split("\n").length;
      hits.push({ file: relative(ROOT, file).split("\\").join("/"), line, method, targetProps });
    }
  }
  return hits;
}

// Maps a schema export symbol (e.g. "pipelineEntry") to its db table name +
// TableInfo. Re-derived from the same scanSchemaIndexes() call's tables map,
// keyed by matching `export const <symbol> = sqliteTable("table_name"`
// across the schema files (a second lightweight scan, since scanSchemaIndexes
// keys `tables` by db table name, not JS export symbol).
function scanExportSymbolToTable(): Map<string, string> {
  const out = new Map<string, string>();
  const files = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "common.ts");
  const re = /export\s+const\s+(\w+)\s*=\s*sqliteTable\(\s*"([^"]+)"/g;
  for (const file of files) {
    const src = readFileSync(join(SCHEMA_DIR, file), "utf8");
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) out.set(m[1]!, m[2]!);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exemption ledger -- starts EMPTY (see header).
// ---------------------------------------------------------------------------

const EXEMPTIONS: string[] = [];

// ---------------------------------------------------------------------------

describe("schema <-> migration <-> onConflict-target unique-index parity (DEC-556 amendment, wave 55)", () => {
  const { indexes: schemaIndexes, tables } = scanSchemaIndexes();
  const migrationIndexes = scanMigrationIndexes();

  it("the scan is not vacuous (found > 15 schema indexes and > 15 migration indexes)", () => {
    expect(schemaIndexes.length).toBeGreaterThan(15);
    expect(migrationIndexes.length).toBeGreaterThan(15);
  });

  it("found the known multi-line declaration (crm.ts contact_duplicate_dismissal composite unique index)", () => {
    const hit = schemaIndexes.find((i) => i.name === "contact_duplicate_dismissal_org_id_contact_id_a_contact_id_b_idx");
    expect(hit, "scan missed the multi-line-declared index -- it is vacuous").toBeDefined();
    expect(hit?.columns).toEqual(["org_id", "contact_id_a", "contact_id_b"]);
    expect(hit?.unique).toBe(true);
  });

  it("every schema index declaration has a matching migration CREATE INDEX (same table, ordered columns, uniqueness)", () => {
    const offenders: string[] = [];
    for (const s of schemaIndexes) {
      const m = migrationIndexes.find((mi) => mi.name === s.name);
      if (EXEMPTIONS.includes(s.name)) continue;
      if (!m) {
        offenders.push(
          `${s.file}: index "${s.name}" on table "${s.table}" is declared in the drizzle schema but no ` +
            `migrations/*.sql file creates it -- add migrations/0034_*.sql (0033 is reserved this wave), or ` +
            `this table/index was never actually migrated.`,
        );
        continue;
      }
      if (m.table !== s.table) {
        offenders.push(
          `${s.file}: index "${s.name}" is declared on table "${s.table}" but ${m.file} creates it on table ` +
            `"${m.table}" -- fix whichever side is wrong.`,
        );
      }
      if (m.unique !== s.unique) {
        offenders.push(
          `${s.file}: index "${s.name}" is ${s.unique ? "unique" : "non-unique"} in the schema but ${m.file} ` +
            `creates it as ${m.unique ? "unique" : "non-unique"} -- fix whichever side is wrong.`,
        );
      }
      if (JSON.stringify(m.columns) !== JSON.stringify(s.columns)) {
        offenders.push(
          `${s.file}: index "${s.name}" columns [${s.columns.join(", ")}] (schema order) do not match ` +
            `${m.file}'s [${m.columns.join(", ")}] (migration order) -- column order matters for a composite ` +
            `index's usefulness; fix whichever side is wrong.`,
        );
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("every migration CREATE INDEX has a matching schema index declaration (same table, ordered columns, uniqueness)", () => {
    const offenders: string[] = [];
    for (const m of migrationIndexes) {
      if (EXEMPTIONS.includes(m.name)) continue;
      const s = schemaIndexes.find((si) => si.name === m.name);
      if (!s) {
        offenders.push(
          `${m.file}: index "${m.name}" is created for table "${m.table}" but no src/db/schema/**.ts file ` +
            `declares it -- add the uniqueIndex()/index() declaration to the schema, or this migration is dead.`,
        );
      }
      // table/uniqueness/column mismatches are already asserted symmetrically above.
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the exemption ledger has no stale entries (every listed name is still a real drift)", () => {
    const stale = EXEMPTIONS.filter((name) => {
      const s = schemaIndexes.find((si) => si.name === name);
      const m = migrationIndexes.find((mi) => mi.name === name);
      if (!s || !m) return false; // genuinely a one-sided drift -- not stale
      return s.table === m.table && s.unique === m.unique && JSON.stringify(s.columns) === JSON.stringify(m.columns);
    });
    expect(
      stale,
      stale.map((name) => `"${name}": stale ledger entry -- delete this line, the scan finds no drift for it anymore.`).join("\n"),
    ).toEqual([]);
  });

  it("every onConflictDoNothing/onConflictDoUpdate target tuple is backed by a unique index in both the schema and migrations, or is the table's own primary key", () => {
    const symbolToTable = scanExportSymbolToTable();
    const hits = scanConflictTargets();
    expect(hits.length, "scan found zero onConflict target call sites -- vacuous, widen CONFLICT_TARGET").toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const hit of hits) {
      if (hit.targetProps.length === 0) {
        offenders.push(
          `${hit.file}:${hit.line} (${hit.method}) -- target could not be parsed into schema.<table>.<col> ` +
            `references; widen CONFLICT_TARGET or inspect this call site by hand.`,
        );
        continue;
      }
      const tableSymbols = new Set(hit.targetProps.map((p) => p.split(".")[0]!));
      if (tableSymbols.size !== 1) {
        offenders.push(`${hit.file}:${hit.line} (${hit.method}) -- target tuple spans multiple tables: ${hit.targetProps.join(", ")}`);
        continue;
      }
      const symbol = [...tableSymbols][0]!;
      const table = symbolToTable.get(symbol);
      if (!table) {
        offenders.push(`${hit.file}:${hit.line} (${hit.method}) -- unresolved schema export "${symbol}" (not found in src/db/schema/**)`);
        continue;
      }
      const info = tables.get(table);
      if (!info) {
        offenders.push(`${hit.file}:${hit.line} (${hit.method}) -- table "${table}" has no parsed TableInfo (scan bug)`);
        continue;
      }
      const targetDbCols = hit.targetProps.map((p) => info.columns.get(p.split(".")[1]!)).filter((c): c is string => Boolean(c));
      if (targetDbCols.length !== hit.targetProps.length) {
        offenders.push(
          `${hit.file}:${hit.line} (${hit.method}) -- target references a column not found on table "${table}": ${hit.targetProps.join(", ")}`,
        );
        continue;
      }

      const isPrimaryKey = JSON.stringify(info.primaryKeyDbCols) === JSON.stringify(targetDbCols);
      if (isPrimaryKey) continue; // legal without an index

      const backedInSchema = schemaIndexes.some((s) => s.table === table && s.unique && JSON.stringify(s.columns) === JSON.stringify(targetDbCols));
      const backedInMigrations = migrationIndexes.some((m) => m.table === table && m.unique && JSON.stringify(m.columns) === JSON.stringify(targetDbCols));

      if (!backedInSchema || !backedInMigrations) {
        offenders.push(
          `${hit.file}:${hit.line} (${hit.method}) -- target [${targetDbCols.join(", ")}] on table "${table}" is not ` +
            `backed by a uniqueIndex ${!backedInSchema ? "(missing in src/db/schema/**)" : ""}${
              !backedInSchema && !backedInMigrations ? " AND " : ""
            }${!backedInMigrations ? "(missing in migrations/**)" : ""} -- an onConflict target with no unique ` +
            `constraint behind it silently upserts nothing (D1 raises no error but also enforces no uniqueness).`,
        );
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
