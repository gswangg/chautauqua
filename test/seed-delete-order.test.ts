// DEC-578 tripwire (task w1-j): scripts/seed.ts's TABLES_IN_DELETE_ORDER is a
// hand-curated FK-safe DELETE order (real knowledge the schema doesn't
// encode) — but its *set* of tables must always equal every sqliteTable
// src/db/schema.ts exports. A table added later without a matching delete
// entry survives every idempotent reseed and can collide on a UNIQUE index
// against the previous run's row (pipeline_entry once did exactly this).
//
// Follows the DEC-518 source-scanning idiom already used elsewhere (see
// test/chunk-sweep-misc.test.ts) combined with the CONTACT_FK_TABLES
// programmatic-list idiom (src/server/repo/contacts/query.ts): rather than
// hand-typing a second list of table names into this test, the schema's
// table set is enumerated programmatically via drizzle-orm's isTable/
// getTableName over every export of src/db/schema.ts.

import { getTableName, isTable } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as schema from "../src/db/schema";
import { assertDeleteOrderCoversSchema, TABLES_IN_DELETE_ORDER } from "../scripts/seed-lib";

function schemaTableNames(): string[] {
  return Object.values(schema)
    .filter(isTable)
    .map((t) => getTableName(t));
}

describe("seed delete order vs. src/db/schema.ts (DEC-578)", () => {
  it("enumerates at least one real table from the schema (sanity check the scan itself works)", () => {
    const names = schemaTableNames();
    expect(names.length).toBeGreaterThan(20);
    expect(names).toContain("submission");
    expect(names).toContain("pipeline_entry");
  });

  it("TABLES_IN_DELETE_ORDER's table set matches src/db/schema.ts's exported tables exactly", () => {
    expect(() => assertDeleteOrderCoversSchema(TABLES_IN_DELETE_ORDER, schemaTableNames())).not.toThrow();
  });

  it("covers every current schema table (pipeline_entry specifically, per the bug this closes)", () => {
    const deleteSet = new Set(TABLES_IN_DELETE_ORDER);
    for (const name of schemaTableNames()) {
      expect(deleteSet.has(name), `TABLES_IN_DELETE_ORDER is missing schema table '${name}'`).toBe(true);
    }
    expect(deleteSet.has("pipeline_entry")).toBe(true);
    expect(deleteSet.has("pipeline_activity")).toBe(true);
    expect(deleteSet.has("review_recusal")).toBe(true);
    expect(deleteSet.has("submission_revision")).toBe(true);
  });

  it("fails loudly BY NAME when the delete order omits a schema table", () => {
    const withoutPipelineEntry = TABLES_IN_DELETE_ORDER.filter((t) => t !== "pipeline_entry");
    expect(() => assertDeleteOrderCoversSchema(withoutPipelineEntry, schemaTableNames())).toThrow(
      /missing from TABLES_IN_DELETE_ORDER: pipeline_entry/,
    );
  });

  it("fails loudly BY NAME when the delete order names a table the schema does not have", () => {
    const withGhostTable = [...TABLES_IN_DELETE_ORDER, "ghost_table"];
    expect(() => assertDeleteOrderCoversSchema(withGhostTable, schemaTableNames())).toThrow(
      /not in src\/db\/schema\.ts: ghost_table/,
    );
  });

  it("fails loudly on a duplicate entry rather than silently masking a missing one", () => {
    const withDupe = [...TABLES_IN_DELETE_ORDER, TABLES_IN_DELETE_ORDER[0]!];
    expect(() => assertDeleteOrderCoversSchema(withDupe, schemaTableNames())).toThrow(/duplicate table/);
  });

  it("places every FK-child table before its known parent(s) — regression guard on the curated order itself", () => {
    const indexOf = (name: string) => TABLES_IN_DELETE_ORDER.indexOf(name);
    // review_recusal (plan_id, submission_id, user_id) before its parents.
    expect(indexOf("review_recusal")).toBeLessThan(indexOf("evaluation_plan"));
    expect(indexOf("review_recusal")).toBeLessThan(indexOf("submission"));
    expect(indexOf("review_recusal")).toBeLessThan(indexOf("user"));
    // submission_revision (submission_id, editor_user_id) before its parents.
    expect(indexOf("submission_revision")).toBeLessThan(indexOf("submission"));
    expect(indexOf("submission_revision")).toBeLessThan(indexOf("user"));
    // pipeline_activity (entry_id, author_user_id) before its parents.
    expect(indexOf("pipeline_activity")).toBeLessThan(indexOf("pipeline_entry"));
    expect(indexOf("pipeline_activity")).toBeLessThan(indexOf("user"));
    // pipeline_entry (org_id, contact_id) before its parents.
    expect(indexOf("pipeline_entry")).toBeLessThan(indexOf("contact"));
    expect(indexOf("pipeline_entry")).toBeLessThan(indexOf("org"));
  });
});
