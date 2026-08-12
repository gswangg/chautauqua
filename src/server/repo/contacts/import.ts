// Contacts repo: CSV import (DEC-011/DEC-026). Split out of
// repo/contacts.ts (contention decomposition, no behavior change). See
// repo/contacts.ts for the module-level contract notes.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import type { ContactRecord } from "../../../domain/contacts";
import { ApiError } from "../../http";
import { chunkIds } from "../../../lib/chunk";
import { customFieldsJsonOf, type ContactPatch } from "./crud";
import { resolveImportUpsert } from "./query";
import { isValidEmail, normalizeEmail } from "../../../domain/email"; // DEC-454
import { newId } from "../../../domain/ids";
import { backfillNullAttribution } from "../attribution";

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
 * unbounded per-row write burst. This is the ONE MAX_IMPORT_ROWS in the
 * product (DEC-478); the route layer imports it from here rather than
 * declaring its own. Producers must split larger files client-side.
 *
 * DEC-491: applyImportRows below does NOT call createContact/patchContact
 * (src/server/repo/contacts/crud.ts) directly — those issue a trailing
 * findContactById re-read the import loop never uses, and patchContact also
 * cascades an email change onto schema.user (DEC-456), which import patches
 * never carry (resolveImportUpsert never puts `email` in an update patch).
 * Instead this file has its own createContactForImport/updateContactForImport
 * helpers that issue exactly:
 *   - create branch: 1 statement (the INSERT).
 *   - update branch: 1 statement (the contact UPDATE) + up to 2 statements
 *     (backfillNullAttribution's title/company UPDATEs, src/server/repo/
 *     attribution.ts:37,44 — DEC-299, only fires when the patch carries a
 *     non-blank title and/or company), so up to 3 in the worst case.
 * IMPORT_MAX_STATEMENTS_PER_ROW below is that worst case (3), measured by
 * test/contacts-import-write-burst.test.ts, not merely asserted here. */
export const MAX_IMPORT_ROWS = 2000;

/** DEC-491: worst-case D1 statements issued per import row (see the comment
 * above) — the update branch with both title and company present:
 * 1 contact UPDATE + 2 backfillNullAttribution UPDATEs = 3. */
export const IMPORT_MAX_STATEMENTS_PER_ROW = 3;

/** DEC-491/DEC-485: the real per-request write-burst bound — MAX_IMPORT_ROWS
 * is the row cap the route layer enforces, but the actual number of D1
 * statements a single import request can issue is this product. */
export const MAX_IMPORT_WRITE_STATEMENTS = MAX_IMPORT_ROWS * IMPORT_MAX_STATEMENTS_PER_ROW;

/** DEC-491: mint-and-insert only — no trailing findContactById re-read (the
 * import loop only ever needs the new id, never the hydrated row). Mirrors
 * createContact's INSERT exactly (src/server/repo/contacts/crud.ts). */
async function createContactForImport(db: Db, orgId: string, input: Omit<ContactRecord, "id">): Promise<string> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.contact).values({
    id,
    orgId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone ?? null,
    company: input.company ?? null,
    title: input.title ?? null,
    bio: input.bio ?? null,
    notes: input.notes ?? null,
    customFieldsJson: customFieldsJsonOf(input.customFields) ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** DEC-491: the contact UPDATE + DEC-299 attribution backfill only — no
 * trailing findContactById re-read, and no schema.user email cascade
 * (DEC-456 never applies here: resolveImportUpsert never puts `email` in an
 * update patch, so this path never touches login identity). */
async function updateContactForImport(db: Db, id: string, patch: ContactPatch): Promise<void> {
  await db
    .update(schema.contact)
    .set({
      ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
      ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.company !== undefined ? { company: patch.company } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.customFields !== undefined ? { customFieldsJson: customFieldsJsonOf(patch.customFields) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.contact.id, id));
  // DEC-299: repair any never-taken (NULL) attribution snapshot now that an
  // organizer/import has written a real title/company onto this contact.
  if (patch.title !== undefined || patch.company !== undefined) {
    await backfillNullAttribution(db, id, { title: patch.title ?? null, company: patch.company ?? null });
  }
}

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
      const id = await createContactForImport(db, orgId, decision.values);
      byEmail.set(key, id);
      created++;
      addContactId(id);
    } else {
      await updateContactForImport(db, decision.id, decision.patch);
      updated++;
      addContactId(decision.id);
    }
  }

  return { created, updated, skipped, contactIds };
}
