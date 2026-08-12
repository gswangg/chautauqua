// Contacts repo: CSV import (DEC-011/DEC-026). Split out of
// repo/contacts.ts (contention decomposition, no behavior change). See
// repo/contacts.ts for the module-level contract notes.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import type { ContactRecord } from "../../../domain/contacts";
import { ApiError } from "../../http";
import { chunkIds } from "../../../lib/chunk";
import { createContact, patchContact } from "./crud";
import { resolveImportUpsert } from "./query";
import { isValidEmail, normalizeEmail } from "../../../domain/email"; // DEC-454

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

/** Hard cap on rows per CSV import (DEC-356, DEC-478): protects against an
 * unbounded per-row write burst — applyImportRows below issues one D1
 * statement per row (see the createContact/patchContact calls in the loop),
 * so this is a real per-request write-burst bound, not an arbitrary number.
 * This is the ONE MAX_IMPORT_ROWS in the product (DEC-478); the route layer
 * imports it from here rather than declaring its own. Producers must split
 * larger files client-side. */
export const MAX_IMPORT_ROWS = 2000;

/** Applies parsed+mapped rows to the org's contacts, one row already resolved
 * per resolveImportUpsert. Rows are applied in order so within-file
 * duplicate emails collapse onto the same created contact.
 *
 * DEC-356: rather than loading the org's entire contact table, this looks up
 * only the rows whose email appears in the file (chunked by ID_CHUNK_SIZE),
 * keeping cost proportional to the file's distinct emails, not org size. */
export async function applyImportRows(
  db: Db,
  orgId: string,
  rows: { line: number; parsed: Record<string, unknown> }[],
): Promise<ImportResult> {
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ApiError(
      "invalid",
      `CSV has ${rows.length} rows, which exceeds the ${MAX_IMPORT_ROWS}-row import cap; split the file into smaller batches and import each separately.`,
      { csvText: "Too many rows" },
    );
  }

  const fileEmails = new Set<string>();
  for (const { parsed } of rows) {
    const email = typeof parsed.email === "string" ? parsed.email : undefined;
    if (!email || email.trim() === "" || !isValidEmail(email)) continue;
    fileEmails.add(normalizeEmail(email));
  }

  const byEmail = new Map<string, string>();
  const emailList = [...fileEmails];
  for (const batch of chunkIds(emailList)) {
    const existing = await db
      .select({ id: schema.contact.id, email: schema.contact.email })
      .from(schema.contact)
      .where(
        and(
          eq(schema.contact.orgId, orgId),
          inArray(sql`lower(${schema.contact.email})`, batch),
        ),
      );
    for (const r of existing) byEmail.set(normalizeEmail(r.email), r.id);
  }

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
    if (!isValidEmail(email)) {
      skipped.push({ line, reason: "invalid email" });
      continue;
    }
    const key = normalizeEmail(email);
    const existingId = byEmail.get(key);
    const normalizedParsed = { ...parsed, email: key };
    const decision = resolveImportUpsert(existingId, normalizedParsed as Partial<ContactRecord>);
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
