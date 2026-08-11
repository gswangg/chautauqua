// DEC-267: every *_id column must be the FIRST column of some index, so
// FK-shaped lookups (organizer-scoped joins, cascades, etc.) never fall back
// to a full table scan. This test is self-enforcing: it introspects every
// exported sqliteTable via getTableConfig and fails loudly, naming every
// offending table.column, unless the gap is explicitly documented below.
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "../src/db/schema";

// Deliberate exceptions: key is 'table.column', value is the reason no
// index covers that column as its first column. Empty by design -- if you
// add an entry here, you are asserting a real, considered exception, not
// papering over a gap.
const EXCEPTIONS: Record<string, string> = {};

describe("schema FK indexes (DEC-267)", () => {
  const offenders: string[] = [];

  for (const exportName of Object.keys(schema)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (schema as Record<string, any>)[exportName];
    if (!table || typeof table !== "object") continue;

    let config: ReturnType<typeof getTableConfig>;
    try {
      config = getTableConfig(table);
    } catch {
      continue; // not a sqliteTable export
    }

    const tableName = config.name;
    const firstIndexedColumnNames = new Set<string>();
    for (const idx of config.indexes) {
      const firstCol = idx.config.columns[0];
      // composite/expression index entries expose a `.name` when they are
      // plain columns; skip anything else defensively.
      if (firstCol && typeof firstCol === "object" && "name" in firstCol) {
        firstIndexedColumnNames.add((firstCol as { name: string }).name);
      }
    }

    const compositePkNames = new Set(
      config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)),
    );
    for (const col of config.columns) {
      if (!col.name.endsWith("_id")) continue;
      if (col.primary) continue; // single-column primary key
      if (compositePkNames.has(col.name)) continue; // composite primary key
      if (firstIndexedColumnNames.has(col.name)) continue;

      const key = `${tableName}.${col.name}`;
      if (key in EXCEPTIONS) continue;
      offenders.push(key);
    }
  }

  it("has an index (first column) covering every non-PK *_id column", () => {
    expect(
      offenders,
      `The following table.column pairs have a '_id' column that is not the ` +
        `first column of any index (add index() to src/db/schema.ts and a ` +
        `migration, or add a documented EXCEPTIONS entry): ${offenders.sort().join(", ")}`,
    ).toEqual([]);
  });
});
