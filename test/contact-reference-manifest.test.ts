// DEC-770 amendment (wave 48): contact_duplicate_dismissal
// (src/db/schema/crm.ts) was a LATER TABLE that slipped past both the merge
// repoint (CONTACT_FK_TABLES, src/server/repo/contacts/query.ts) and the
// delete cascade (deleteContact, src/server/repo/contacts/crud.ts) --
// neither hand-listed manifest was extended when the table was added
// (migration 0022). This test enumerates every contact-referencing column
// directly off the schema module (never a hand list, never
// CONTACT_FK_TABLES) and asserts each one is accounted for by at least one
// of two named, explicit sets: MERGE_REPOINTED (the columns repointed onto
// the keeper contact by mergeOnePair's generic FK-repoint step, (f)) or
// DELETE_HANDLED (the columns deleteContact's route/repo layer either
// refuses on, or cascade-deletes). A column present in neither set fails
// loudly, naming both the table and the column, so the next
// contact-referencing table cannot silently slip past both paths again.

import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "../src/db/schema";

// Matches contact_id, contact_id_a, contact_id_b, *_by_contact_id, and any
// other *_contact_id column -- the exact family DEC-770's amendment names.
const CONTACT_COLUMN_PATTERN = /^contact_id(_[ab])?$|_by_contact_id$|_contact_id$/;

interface ContactColumn {
  table: string;
  column: string;
}

/** Walks every sqliteTable export of the schema barrel and returns every
 * column whose SQL name matches CONTACT_COLUMN_PATTERN -- an enumeration
 * over the schema module itself, never a hand-maintained list. */
function enumerateContactColumns(): ContactColumn[] {
  const found: ContactColumn[] = [];
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

    for (const col of config.columns) {
      if (CONTACT_COLUMN_PATTERN.test(col.name)) {
        found.push({ table: config.name, column: col.name });
      }
    }
  }
  return found;
}

// mergeOnePair's (f) generic FK-repoint step (src/server/repo/contacts/
// merge.ts, driven by CONTACT_FK_TABLES) repoints exactly these columns from
// the merged contact onto the kept contact before the merged row is
// deleted -- a dismissal is deliberately EXCLUDED (DEC-770 amendment: a
// dismissal judges a pair, not a contact, so it is deleted, never
// repointed).
const MERGE_REPOINTED = new Set<string>([
  "participant.contact_id",
  "task_assignment.contact_id",
  "email_log.contact_id",
  "user.contact_id",
  "file.uploaded_by_contact_id",
  "file_comment.author_contact_id",
  "pipeline_entry.contact_id",
]);

// deleteContact's route (src/routes/api/contacts/crud.ts DELETE /:id) and
// repo (src/server/repo/contacts/crud.ts deleteContact) layer handling for
// each contact-referencing column that would otherwise dangle once the
// contact row is gone:
//   - "refuses": the route 409s naming the row, contact is never deleted.
//   - "cascades": deleteContact deletes the referencing rows itself, before
//     the contact row delete.
const DELETE_HANDLED: Record<string, "refuses" | "cascades"> = {
  "participant.contact_id": "refuses",
  "user.contact_id": "refuses",
  "task_assignment.contact_id": "cascades",
  "pipeline_entry.contact_id": "cascades",
  // DEC-770 amendment (wave 48): the fix this file locks in.
  "contact_duplicate_dismissal.contact_id_a": "cascades",
  "contact_duplicate_dismissal.contact_id_b": "cascades",
};

describe("contact-referencing column manifest (DEC-770 amendment, wave 48)", () => {
  it("enumerates every *contact_id column directly off the schema module (not a hand list)", () => {
    const columns = enumerateContactColumns();
    // Sanity: the enumeration itself must actually find columns, or this
    // test would vacuously pass forever.
    expect(columns.length).toBeGreaterThan(0);
    const keys = new Set(columns.map((c) => `${c.table}.${c.column}`));
    expect(keys.has("contact_duplicate_dismissal.contact_id_a")).toBe(true);
    expect(keys.has("contact_duplicate_dismissal.contact_id_b")).toBe(true);
    expect(keys.has("pipeline_entry.contact_id")).toBe(true);
  });

  it("every enumerated column is accounted for by MERGE_REPOINTED or DELETE_HANDLED", () => {
    const columns = enumerateContactColumns();
    const offenders: string[] = [];

    for (const { table, column } of columns) {
      const key = `${table}.${column}`;
      const inMerge = MERGE_REPOINTED.has(key);
      const inDelete = key in DELETE_HANDLED;
      if (!inMerge && !inDelete) {
        offenders.push(key);
      }
    }

    expect(
      offenders,
      `The following contact-referencing columns are handled by neither ` +
        `mergeOnePair's FK repoint (MERGE_REPOINTED) nor deleteContact's ` +
        `refusal/cascade handling (DELETE_HANDLED) in ` +
        `test/contact-reference-manifest.test.ts -- a merge or a delete ` +
        `would silently leave a dangling contact reference: ${offenders.sort().join(", ")}`,
    ).toEqual([]);
  });

  it("contact_duplicate_dismissal is deliberately excluded from MERGE_REPOINTED (a dismissal judges a pair, never repointed onto a survivor)", () => {
    expect(MERGE_REPOINTED.has("contact_duplicate_dismissal.contact_id_a")).toBe(false);
    expect(MERGE_REPOINTED.has("contact_duplicate_dismissal.contact_id_b")).toBe(false);
    expect(DELETE_HANDLED["contact_duplicate_dismissal.contact_id_a"]).toBe("cascades");
    expect(DELETE_HANDLED["contact_duplicate_dismissal.contact_id_b"]).toBe("cascades");
  });
});
