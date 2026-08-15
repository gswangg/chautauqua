// Contacts repo: CSV import (DEC-011/DEC-026). Split out of
// repo/contacts.ts (contention decomposition, no behavior change). See
// repo/contacts.ts for the module-level contract notes.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import {
  describeImportOverwrites,
  findImportDuplicateCandidates,
  MAX_IMPORT_ROWS,
  type ContactRecord,
} from "../../../domain/contacts";
import { ApiError } from "../../http";
import { chunkIds, chunkRowsForInsert } from "../../../lib/chunk";
import { customFieldsJsonOf } from "./crud";
import { resolveImportUpsert } from "./query";
import { toContactRecord, toRow, type ContactRow } from "./rows";
import { isValidEmail, normalizeEmail } from "../../../domain/email"; // DEC-454
import { newId } from "../../../domain/ids";
import { backfillNullAttributionMany } from "../attribution";
import { touchSubmissionsForContacts } from "../submissions/touch";

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

export { MAX_IMPORT_ROWS };

/** DEC-491 amendment (wave 47): a Cloudflare Workers request may issue on
 * the order of 1000 subrequests, and each D1 statement (including each
 * statement inside a chunked batch) counts as one. This is the ceiling the
 * import commit flush (and its attribution backfill) must stay under —
 * test/contacts-import-write-burst.test.ts drives a full MAX_IMPORT_ROWS
 * import and MEASURES the actual statement count against this constant
 * rather than asserting a per-row multiplier in a comment. */
export const MAX_D1_STATEMENTS_PER_REQUEST = 1000;

/** Row shape flushed to schema.contact for both the create and update
 * commit paths (see applyImportRows below) — deliberately identical column
 * sets for both branches so chunkRowsForInsert's ragged-row check never
 * trips, and so a single INSERT (create) or INSERT ... ON CONFLICT DO
 * UPDATE (update) can share one row-building helper. Columns the import
 * path has never touched (headshotUrl, socialLinksJson, externalRef) are
 * deliberately absent — omitted from both the create INSERT (so they
 * default to NULL, unchanged from createContactForImport's prior behavior)
 * and the update's ON CONFLICT SET list (so an update never overwrites
 * them, unchanged from updateContactForImport's prior behavior). */
interface ContactCommitRow {
  [key: string]: unknown;
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  bio: string | null;
  notes: string | null;
  customFieldsJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Builds the full commit row for a brand-new contact (mint-and-insert
 * only — no trailing findContactById re-read; the import loop only ever
 * needs the new id, never the hydrated row). Mirrors createContactForImport's
 * former column mapping exactly. */
function createCommitRow(id: string, orgId: string, input: Omit<ContactRecord, "id">, now: Date): ContactCommitRow {
  return {
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
  };
}

/** Applies an import patch onto a full base row (either a pre-existing DB
 * row or an earlier-in-this-file pending commit row — see applyImportRows),
 * producing the next full commit row. DEC-575: unprovided columns MUST
 * carry the base row's existing values so a partial patch never blanks a
 * column — this is the same "omitted from patch = leave alone" contract
 * updateContactForImport enforced per-column, just applied to a full row
 * instead of a per-column conditional SQL SET. createdAt/id/orgId/email
 * are carried through unchanged (import patches never touch email —
 * resolveImportUpsert never puts `email` in an update patch, so this path
 * never cascades onto schema.user's DEC-456 login-identity check). */
function applyCommitPatch(base: ContactCommitRow, patch: Partial<Omit<ContactRecord, "id">>, now: Date): ContactCommitRow {
  return {
    ...base,
    firstName: patch.firstName !== undefined ? patch.firstName : base.firstName,
    lastName: patch.lastName !== undefined ? patch.lastName : base.lastName,
    phone: patch.phone !== undefined ? patch.phone : base.phone,
    company: patch.company !== undefined ? patch.company : base.company,
    title: patch.title !== undefined ? patch.title : base.title,
    bio: patch.bio !== undefined ? patch.bio : base.bio,
    notes: patch.notes !== undefined ? patch.notes : base.notes,
    customFieldsJson: patch.customFields !== undefined ? (customFieldsJsonOf(patch.customFields) ?? null) : base.customFieldsJson,
    updatedAt: now,
  };
}

function commitRowFromExisting(row: ContactRow): ContactCommitRow {
  return {
    id: row.id,
    orgId: row.orgId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    company: row.company,
    title: row.title,
    bio: row.bio,
    notes: row.notes,
    customFieldsJson: row.customFieldsJson,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

/** DEC-491 amendment (wave 47): flushes every accumulated create row as one
 * or more chunked multi-row INSERTs (chunkRowsForInsert, DEC-528) — never a
 * per-row await inside applyImportRows' commit loop. */
async function flushContactCreates(db: Db, rows: ContactCommitRow[]): Promise<void> {
  for (const chunk of chunkRowsForInsert(rows)) {
    await db.insert(schema.contact).values(chunk);
  }
}

/** DEC-491 amendment (wave 47): flushes every accumulated update row as one
 * or more chunked `INSERT ... ON CONFLICT (id) DO UPDATE SET <col> =
 * excluded.<col>` statements — the same idiom src/server/repo/rate-limit.ts
 * already uses for an atomic single-row upsert, applied here to a
 * multi-row batch. Every row's target id already exists (it came from the
 * chunked pre-pass lookup or an earlier row in this same file), so this
 * never actually inserts — it is a set-based UPDATE, expressed as an
 * upsert so one statement can carry many rows' distinct values via the
 * `excluded` pseudo-table. Columns never touched by import (headshotUrl,
 * socialLinksJson, externalRef) are absent from `set`, so they're
 * untouched on conflict — identical to updateContactForImport's prior
 * per-column conditional SET. */
async function flushContactUpdates(db: Db, rows: ContactCommitRow[]): Promise<void> {
  for (const chunk of chunkRowsForInsert(rows)) {
    await db
      .insert(schema.contact)
      .values(chunk)
      .onConflictDoUpdate({
        target: schema.contact.id,
        set: {
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          phone: sql`excluded.phone`,
          company: sql`excluded.company`,
          title: sql`excluded.title`,
          bio: sql`excluded.bio`,
          notes: sql`excluded.notes`,
          customFieldsJson: sql`excluded.custom_fields_json`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    // DEC-725 (wave-32 amendment): the dependent-submission touch is NOT done
    // here. This flush sees only the post-patch rows, so it cannot tell a real
    // rename from a same-name re-import, and touching the whole chunk would
    // make every 200-row CSV re-import reorder the producer's awaiting-approval
    // worklist (src/server/repo/overview.ts orders by desc(updatedAt)). The
    // caller compares pre- and post-values and passes only genuinely renamed
    // contact ids to touchSubmissionsForContacts.
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
  opts?: { skipLines?: number[] },
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
  // DEC-575: the update branch needs each matched contact's currently
  // stored custom fields to merge into (rather than replace with the
  // file's blob) -- fetched here, in the SAME chunked pre-pass that
  // already builds byEmail, so the per-row statement budget (DEC-491)
  // never grows.
  //
  // DEC-491 amendment (wave 47): this pre-pass now selects the FULL
  // contact row (not just id/email/customFieldsJson) so the commit loop
  // below can compute a complete merged row for the update flush without
  // an extra per-row read -- `existingById` is that full-row lookup.
  const existingCustomFieldsById = new Map<string, Record<string, string>>();
  const existingById = new Map<string, ContactRow>();
  const emailList = [...fileEmails];
  for (const batch of chunkIds(emailList)) {
    const existing = await db
      .select()
      .from(schema.contact)
      .where(
        and(
          eq(schema.contact.orgId, orgId),
          inArray(sql`lower(${schema.contact.email})`, batch),
        ),
      );
    for (const raw of existing as (typeof schema.contact.$inferSelect)[]) {
      const row = toRow(raw);
      byEmail.set(normalizeEmail(row.email), row.id);
      existingById.set(row.id, row);
      if (row.customFieldsJson) {
        existingCustomFieldsById.set(row.id, JSON.parse(row.customFieldsJson) as Record<string, string>);
      }
    }
  }

  let created = 0;
  let updated = 0;
  const skipped: ImportSkip[] = [];
  const contactIds: string[] = [];
  const seenContactIds = new Set<string>();
  // DEC-663: lines an organizer chose to skip on the dry-run plan screen
  // never reach create/update — reported in `skipped`, real-run counts
  // still tallied AFTER commit exactly as today (they simply never fire
  // for a skipped line).
  const skipLineSet = new Set(opts?.skipLines ?? []);

  const addContactId = (id: string) => {
    if (!seenContactIds.has(id)) {
      seenContactIds.add(id);
      contactIds.push(id);
    }
  };

  // DEC-491 amendment (wave 47): the commit loop below contains NO await.
  // Every row is resolved through the unchanged resolveImportUpsert and
  // staged into `pendingById` (the row's current full state, so a
  // within-file duplicate email's second occurrence patches the FIRST
  // occurrence's still-in-memory row rather than needing a real read) plus
  // `newIds` (which of those ids are creates, flushed via a plain INSERT,
  // vs. updates, flushed via the ON CONFLICT upsert). Everything is
  // flushed in chunked multi-row statements after the loop.
  const now = new Date();
  const pendingById = new Map<string, ContactCommitRow>();
  const newIds = new Set<string>();
  const attributionUpdates: { contactId: string; title: string | null; company: string | null }[] = [];

  for (const { line, parsed } of rows) {
    if (skipLineSet.has(line)) {
      skipped.push({ line, reason: "skipped by organizer" });
      continue;
    }
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
    const decision = resolveImportUpsert(
      existingId,
      normalizedParsed as Partial<ContactRecord>,
      existingId !== undefined ? existingCustomFieldsById.get(existingId) : undefined,
    );
    if (decision.action === "create") {
      const id = newId();
      byEmail.set(key, id);
      pendingById.set(id, createCommitRow(id, orgId, decision.values, now));
      newIds.add(id);
      created++;
      addContactId(id);
    } else {
      const base = pendingById.get(decision.id) ?? (existingById.has(decision.id) ? commitRowFromExisting(existingById.get(decision.id)!) : undefined);
      if (!base) {
        throw new Error(`applyImportRows: update decision for unknown contact ${decision.id}`);
      }
      pendingById.set(decision.id, applyCommitPatch(base, decision.patch, now));
      updated++;
      addContactId(decision.id);
      // DEC-299: repair any never-taken (NULL) attribution snapshot now
      // that an organizer/import has written a real title/company onto
      // this contact — collected here, flushed in one set-based pass
      // after the loop (backfillNullAttributionMany).
      if (decision.patch.title !== undefined || decision.patch.company !== undefined) {
        attributionUpdates.push({
          contactId: decision.id,
          title: decision.patch.title ?? null,
          company: decision.patch.company ?? null,
        });
      }
    }
  }

  const createRows: ContactCommitRow[] = [];
  const updateRows: ContactCommitRow[] = [];
  // DEC-725 (wave-32 amendment): compare each UPDATE row's final (net, after
  // any within-file duplicate-email patches collapse onto it) name against
  // the ORIGINAL pre-import row — never against an intermediate in-memory
  // patch — so a name change only touches dependent submissions when the
  // string actually differs from what airtable.ts already pushed, and a
  // company/title/phone/bio/custom-fields-only row never touches.
  const renamedContactIds: string[] = [];
  for (const [id, row] of pendingById) {
    if (newIds.has(id)) {
      createRows.push(row);
      continue;
    }
    updateRows.push(row);
    const original = existingById.get(id);
    if (original && (original.firstName !== row.firstName || original.lastName !== row.lastName)) {
      renamedContactIds.push(id);
    }
  }
  if (createRows.length > 0) await flushContactCreates(db, createRows);
  if (updateRows.length > 0) await flushContactUpdates(db, updateRows);
  if (attributionUpdates.length > 0) await backfillNullAttributionMany(db, attributionUpdates);
  if (renamedContactIds.length > 0) await touchSubmissionsForContacts(db, renamedContactIds, now);

  return { created, updated, skipped, contactIds };
}

export interface ImportPlanOverwrite {
  field: "firstName" | "lastName" | "company" | "title" | "phone" | "bio";
  from: string;
  to: string;
}

export interface ImportPlanRow {
  line: number;
  email: string;
  action: "create" | "update" | "skip";
  reason?: string;
  contactId?: string;
  overwrites?: ImportPlanOverwrite[];
  possibleDuplicates?: ContactRecord[];
}

export interface ImportPlan {
  rows: ImportPlanRow[];
  created: number;
  updated: number;
  skipped: number;
}

/** DEC-663 amendment (wave 61): merges a resolveImportUpsert patch onto a
 * ContactRecord for the plan-only byEmail bookkeeping above -- an omitted
 * patch field leaves the existing value alone, same "absent key is
 * silence" contract resolveImportUpsert already enforces for the patch
 * itself. */
function mergeContactRecord(existing: ContactRecord, patch: Partial<Omit<ContactRecord, "id">>): ContactRecord {
  return {
    ...existing,
    ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
    ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
    ...(patch.company !== undefined ? { company: patch.company } : {}),
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
    ...(patch.customFields !== undefined ? { customFields: patch.customFields } : {}),
  };
}

async function selectContactsWhere(
  db: Db,
  orgId: string,
  extra: ReturnType<typeof inArray>,
): Promise<ContactRecord[]> {
  const raw = await db
    .select()
    .from(schema.contact)
    .where(and(eq(schema.contact.orgId, orgId), extra));
  return (raw as (typeof schema.contact.$inferSelect)[]).map((r) => toContactRecord(toRow(r)));
}

/**
 * DEC-663: the read-only dry-run counterpart of applyImportRows above — NO
 * writes. Reuses the same chunked-by-file-contents pre-pass idiom
 * (applyImportRows above) for BOTH lookups it needs: by lower(email) (as
 * applyImportRows already does, to decide create vs. update) and, new here,
 * by lower(last_name) over the file's distinct last names (to surface
 * findImportDuplicateCandidates possible-duplicate matches) — cost stays
 * proportional to the file's distinct emails/last names, never a whole-org
 * scan (DEC-356).
 */
export async function planImportRows(
  db: Db,
  orgId: string,
  rows: { line: number; parsed: Record<string, unknown> }[],
): Promise<ImportPlan> {
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ApiError(
      "invalid",
      `CSV has ${rows.length} rows, which exceeds the ${MAX_IMPORT_ROWS}-row import cap; split the file into smaller batches and import each separately.`,
      { csvText: "Too many rows" },
    );
  }

  const fileEmails = new Set<string>();
  const fileLastNames = new Set<string>();
  for (const { parsed } of rows) {
    const email = typeof parsed.email === "string" ? parsed.email : undefined;
    if (email && email.trim() !== "" && isValidEmail(email)) {
      fileEmails.add(normalizeEmail(email));
    }
    const lastName = typeof parsed.lastName === "string" ? parsed.lastName.trim().toLowerCase() : "";
    if (lastName !== "") fileLastNames.add(lastName);
  }

  const byEmail = new Map<string, ContactRecord>();
  // DEC-663 amendment (wave 61): tracks which byEmail keys came from the DB
  // pre-pass (as opposed to a same-file collapsed row, added below) so the
  // row loop can tell "updates the SAME record a later row in this file
  // planned as a create" apart from a genuine pre-existing-contact update.
  const fromDb = new Set<string>();
  for (const batch of chunkIds([...fileEmails])) {
    const found = await selectContactsWhere(db, orgId, inArray(sql`lower(${schema.contact.email})`, batch));
    for (const c of found) {
      byEmail.set(normalizeEmail(c.email), c);
      fromDb.add(normalizeEmail(c.email));
    }
  }

  // DEC-663: candidates for findImportDuplicateCandidates — every org
  // contact whose last name (lowercased) appears in the file, chunked over
  // the file's distinct last names so cost is proportional to the file, not
  // the org's whole directory (DEC-356/DEC-554's MAX_CONTACT_DIRECTORY_SCAN
  // is deliberately never touched here).
  const nameCandidates: ContactRecord[] = [];
  for (const batch of chunkIds([...fileLastNames])) {
    const found = await selectContactsWhere(db, orgId, inArray(sql`lower(${schema.contact.lastName})`, batch));
    nameCandidates.push(...found);
  }

  const planRows: ImportPlanRow[] = [];
  let created = 0;
  let updated = 0;
  let skippedCount = 0;

  for (const { line, parsed } of rows) {
    const email = typeof parsed.email === "string" ? parsed.email : undefined;
    if (!email || email.trim() === "") {
      planRows.push({ line, email: "", action: "skip", reason: "missing email" });
      skippedCount++;
      continue;
    }
    if (!isValidEmail(email)) {
      planRows.push({ line, email, action: "skip", reason: "invalid email" });
      skippedCount++;
      continue;
    }
    const key = normalizeEmail(email);
    const existing = byEmail.get(key);
    const normalizedParsed = { ...parsed, email: key } as Partial<ContactRecord>;
    const decision = resolveImportUpsert(existing?.id, normalizedParsed, existing?.customFields);

    if (decision.action === "create") {
      created++;
      const duplicates = findImportDuplicateCandidates(
        {
          firstName: normalizedParsed.firstName,
          lastName: normalizedParsed.lastName,
          company: normalizedParsed.company,
          email: key,
        },
        nameCandidates,
      );
      planRows.push({
        line,
        email: key,
        action: "create",
        ...(duplicates.length > 0 ? { possibleDuplicates: duplicates } : {}),
      });
      // DEC-663 amendment (wave 61): register this create's resolved values
      // under the normalized email so a LATER row in this same file with
      // the same email plans an update against them (matching
      // applyImportRows' byEmail-set-back-in at line ~309) instead of
      // wrongly planning a second create.
      byEmail.set(key, { id: "", ...decision.values });
    } else {
      updated++;
      const overwrites = existing ? describeImportOverwrites(existing, decision.patch) : [];
      // DEC-663 amendment (wave 61): a row that resolves to an update
      // against a same-file collapsed create (never a real DB row) has no
      // contact id yet -- state that explicitly instead of a fabricated id.
      const isSameFileCollapse = !fromDb.has(key);
      planRows.push({
        line,
        email: key,
        action: "update",
        ...(isSameFileCollapse
          ? { reason: "same email as an earlier row in this file" }
          : { contactId: decision.id }),
        ...(overwrites.length > 0 ? { overwrites } : {}),
      });
      // Keep byEmail current so a THIRD occurrence of the same email in
      // this file plans against the cumulative patched state, mirroring
      // applyImportRows' base-chaining (pendingById.get(decision.id) ??
      // existingById).
      if (existing) byEmail.set(key, mergeContactRecord(existing, decision.patch));
    }
  }

  return { rows: planRows, created, updated, skipped: skippedCount };
}
