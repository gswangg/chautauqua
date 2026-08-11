// Contacts repo: CSV import (DEC-011/DEC-026). Split out of
// repo/contacts.ts (contention decomposition, no behavior change). See
// repo/contacts.ts for the module-level contract notes.

import { eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import type { ContactRecord } from "../../../domain/contacts";
import { createContact, patchContact } from "./crud";
import { resolveImportUpsert } from "./query";

export interface ImportSkip {
  line: number;
  reason: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: ImportSkip[];
  /** id of every created-or-updated contact, in row order, deduped (skipped rows excluded). */
  contactIds: string[];
}

/** Applies parsed+mapped rows to the org's contacts, one row already resolved
 * per resolveImportUpsert. Rows are applied in order so within-file
 * duplicate emails collapse onto the same created contact. */
export async function applyImportRows(
  db: Db,
  orgId: string,
  rows: { line: number; parsed: Record<string, unknown> }[],
): Promise<ImportResult> {
  const existing = await db
    .select({ id: schema.contact.id, email: schema.contact.email })
    .from(schema.contact)
    .where(eq(schema.contact.orgId, orgId));
  const byEmail = new Map<string, string>();
  for (const r of existing) byEmail.set(r.email.trim().toLowerCase(), r.id);

  let created = 0;
  let updated = 0;
  const skipped: ImportSkip[] = [];
  const contactIds: string[] = [];
  const seenContactIds = new Set<string>();

  const addContactId = (id: string) => {
    if (!seenContactIds.has(id)) {
      seenContactIds.add(id);
      contactIds.push(id);
    }
  };

  for (const { line, parsed } of rows) {
    const email = typeof parsed.email === "string" ? parsed.email : undefined;
    if (!email || email.trim() === "") {
      skipped.push({ line, reason: "missing email" });
      continue;
    }
    const key = email.trim().toLowerCase();
    const existingId = byEmail.get(key);
    const decision = resolveImportUpsert(existingId, parsed as Partial<ContactRecord>);
    if (decision.action === "create") {
      const row = await createContact(db, orgId, decision.values);
      byEmail.set(key, row.id);
      created++;
      addContactId(row.id);
    } else {
      await patchContact(db, decision.id, decision.patch);
      updated++;
      addContactId(decision.id);
    }
  }

  return { created, updated, skipped, contactIds };
}
