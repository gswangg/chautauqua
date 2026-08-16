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
  MAX_POSSIBLE_DUPLICATES,
  type ContactRecord,
} from "../../../domain/contacts";
import { fullName } from "../../../domain/contacts-parts/types";
import { ApiError } from "../../http";
import { chunkIds, chunkRowsForInsert } from "../../../lib/chunk";
import { customFieldsJsonOf, parseContactCustomFields } from "./crud";
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

/** DEC-417 (amendment): renders a capViolations map (target -> overBudgetBy
 * message, from src/domain/contacts.ts's importFieldCapViolations) into one
 * skip/reason string naming every offending target -- so a row over cap on
 * more than one field states all of them, not just the first. */
function describeCapViolations(capViolations: Record<string, string>): string {
  const parts = Object.entries(capViolations).map(([field, message]) => `${field}: ${message}`);
  return `over the field length cap (${parts.join(", ")})`;
}

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
          // DEC-663 (wave-64 amendment): email is now part of the SET list
          // -- a plain (non-merge) update's commit row still carries the
          // base row's UNCHANGED email through (applyCommitPatch never
          // touches it), so this is a same-value no-op for every row except
          // a merge line, where it's the whole point: the CSV row's email
          // REPLACES the target's stored email.
          email: sql`excluded.email`,
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
  rows: { line: number; parsed: Record<string, unknown>; capViolations?: Record<string, string> }[],
  opts?: { skipLines?: number[]; mergeLines?: { line: number; contactId: string }[] },
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
      existingCustomFieldsById.set(row.id, parseContactCustomFields(row.customFieldsJson));
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

  // DEC-663 (wave-64 amendment): a merged line does NOT create -- it patches
  // an organizer-named existing contact through the SAME resolveImportUpsert
  // update path an email match would take, with the CSV row's email
  // REPLACING the target's stored email. The server never trusts the
  // client's merge choice: every merged line is re-derived against the same
  // possible-duplicate candidate set planImportRows would compute, and any
  // mismatch (unknown/foreign contact, a line also marked skip, a line whose
  // email already resolves to an update) throws before ANY write below.
  const mergeLines = opts?.mergeLines ?? [];
  const mergeLineMap = new Map<number, string>();
  for (const { line, contactId } of mergeLines) {
    mergeLineMap.set(line, contactId);
  }
  if (mergeLines.length > 0) {
    const rowsByLine = new Map<number, { parsed: Record<string, unknown> }>();
    for (const r of rows) rowsByLine.set(r.line, r);

    const mergeTargetIds = [...new Set(mergeLines.map((m) => m.contactId))];
    const mergeTargetById = new Map<string, ContactRow>();
    for (const batch of chunkIds(mergeTargetIds)) {
      const existing = await db
        .select()
        .from(schema.contact)
        .where(and(eq(schema.contact.orgId, orgId), inArray(schema.contact.id, batch)));
      for (const raw of existing as (typeof schema.contact.$inferSelect)[]) {
        const row = toRow(raw);
        mergeTargetById.set(row.id, row);
      }
    }

    // Same candidate idiom as planImportRows: every org contact whose last
    // name (lowercased) appears among the merged lines' rows, chunked over
    // those distinct last names (DEC-356 — cost proportional to the merge
    // set, never a whole-org scan).
    const mergeLastNames = new Set<string>();
    for (const { line } of mergeLines) {
      const parsed = rowsByLine.get(line)?.parsed;
      const lastName = typeof parsed?.lastName === "string" ? parsed.lastName.trim().toLowerCase() : "";
      if (lastName !== "") mergeLastNames.add(lastName);
    }
    const mergeNameCandidates: ContactRecord[] = [];
    for (const batch of chunkIds([...mergeLastNames])) {
      const found = await selectContactsWhere(db, orgId, inArray(sql`lower(${schema.contact.lastName})`, batch));
      mergeNameCandidates.push(...found);
    }

    for (const { line, contactId } of mergeLines) {
      const row = rowsByLine.get(line);
      if (!row) {
        throw new ApiError("invalid", `Line ${line} is not part of this import batch`, {
          mergeLines: `line ${line}: unknown row`,
        });
      }
      if (skipLineSet.has(line)) {
        throw new ApiError("invalid", `Line ${line} cannot be both skipped and merged`, {
          mergeLines: `line ${line}: also present in skipLines`,
        });
      }
      const target = mergeTargetById.get(contactId);
      if (!target) {
        throw new ApiError("invalid", `Line ${line}: merge target contact ${contactId} was not found`, {
          mergeLines: `line ${line}: unknown contact`,
        });
      }
      const email = typeof row.parsed.email === "string" ? row.parsed.email : undefined;
      if (email && email.trim() !== "" && isValidEmail(email) && byEmail.has(normalizeEmail(email))) {
        throw new ApiError(
          "invalid",
          `Line ${line} already matches an existing contact by email; it resolves to an update, not a merge`,
          { mergeLines: `line ${line}: resolves to an update` },
        );
      }
      const candidates = findImportDuplicateCandidates(
        {
          firstName: typeof row.parsed.firstName === "string" ? row.parsed.firstName : undefined,
          lastName: typeof row.parsed.lastName === "string" ? row.parsed.lastName : undefined,
          company: typeof row.parsed.company === "string" ? row.parsed.company : undefined,
          email: email ?? "",
        },
        mergeNameCandidates,
      );
      if (!candidates.some((c) => c.id === contactId)) {
        throw new ApiError(
          "invalid",
          `Line ${line}: contact ${contactId} is not a possible duplicate for this row`,
          { mergeLines: `line ${line}: not a candidate` },
        );
      }
      // Validated: fold this merge target into the same pre-pass maps the
      // main commit loop below already reads, so the merge branch there
      // needs no extra query.
      existingById.set(target.id, target);
      existingCustomFieldsById.set(target.id, parseContactCustomFields(target.customFieldsJson));
    }
  }

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

  for (const { line, parsed, capViolations } of rows) {
    if (skipLineSet.has(line)) {
      skipped.push({ line, reason: "skipped by organizer" });
      continue;
    }
    // DEC-417 (amendment): the same rows planImportRows flagged over-cap at
    // dry-run time are refused here too -- applyImportRows never writes a
    // row its own plan marked as a rejection.
    if (capViolations && Object.keys(capViolations).length > 0) {
      skipped.push({ line, reason: describeCapViolations(capViolations) });
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
    const normalizedParsed = { ...parsed, email: key };

    const mergeTargetId = mergeLineMap.get(line);
    if (mergeTargetId !== undefined) {
      // DEC-663 (wave-64 amendment): validated above against the same
      // possible-duplicate candidate set planImportRows uses -- patches the
      // named contact through the same resolveImportUpsert update path a
      // real email match would take, then forces the CSV row's email onto
      // the commit row (resolveImportUpsert's patch never carries email —
      // see applyCommitPatch's doc comment).
      const decision = resolveImportUpsert(
        mergeTargetId,
        normalizedParsed as Partial<ContactRecord>,
        existingCustomFieldsById.get(mergeTargetId),
      );
      if (decision.action !== "update") {
        throw new Error("applyImportRows: merge line resolved to create — unreachable (existingId always defined)");
      }
      const base = pendingById.get(mergeTargetId) ?? (existingById.has(mergeTargetId) ? commitRowFromExisting(existingById.get(mergeTargetId)!) : undefined);
      if (!base) {
        throw new Error(`applyImportRows: merge target ${mergeTargetId} missing from pre-pass`);
      }
      const patched = applyCommitPatch(base, decision.patch, now);
      pendingById.set(mergeTargetId, { ...patched, email: key });
      updated++;
      addContactId(mergeTargetId);
      byEmail.set(key, mergeTargetId);
      if (decision.patch.title !== undefined || decision.patch.company !== undefined) {
        attributionUpdates.push({
          contactId: mergeTargetId,
          title: decision.patch.title ?? null,
          company: decision.patch.company ?? null,
        });
      }
      continue;
    }

    const existingId = byEmail.get(key);
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

/** Chunked lower(email) -> contactId lookup for the caller's org, reusing
 * applyImportRows' own byEmail pre-pass idiom (DEC-356: cost proportional to
 * the file's distinct emails, never a whole-org scan). `emails` must already
 * be normalized (normalizeEmail). Exposed so
 * routes/api/contacts/import.ts's pre-write MAX_PARTICIPANTS_PER_SUBMISSION
 * check (DEC-604 amendment, findings wave 15) can resolve which file emails
 * already have an org contact without duplicating this query inline. */
export async function lookupContactIdsByEmail(db: Db, orgId: string, emails: string[]): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  for (const batch of chunkIds(emails)) {
    const existing = await db
      .select({ id: schema.contact.id, email: schema.contact.email })
      .from(schema.contact)
      .where(and(eq(schema.contact.orgId, orgId), inArray(sql`lower(${schema.contact.email})`, batch)));
    for (const row of existing as { id: string; email: string }[]) {
      byEmail.set(normalizeEmail(row.email), row.id);
    }
  }
  return byEmail;
}

export interface ImportPlanOverwrite {
  field: "firstName" | "lastName" | "company" | "title" | "phone" | "bio";
  from: string;
  to: string;
}

/** DEC-663 amendment (wave 64): the wire shape of a possible-duplicate
 * match -- a narrow projection of ContactRecord, never the full record.
 * `possibleDuplicates` must carry ONLY these four fields; bio/notes/
 * customFields (and everything else on ContactRecord) never reach the wire.
 * The only reader (app/src/pages/contacts/ImportWizard.tsx) prints
 * `contactId`/`name`, which this record now actually carries -- the prior
 * `ContactRecord[]` shape left both undefined at render time (DEC-663
 * wave-64 fix). */
export interface ImportPlanDuplicate {
  contactId: string;
  name: string;
  email: string;
  company?: string | null;
}

function toImportPlanDuplicate(c: ContactRecord): ImportPlanDuplicate {
  return { contactId: c.id, name: fullName(c), email: c.email, company: c.company ?? null };
}

export interface ImportPlanRow {
  line: number;
  email: string;
  action: "create" | "update" | "skip";
  reason?: string;
  contactId?: string;
  overwrites?: ImportPlanOverwrite[];
  possibleDuplicates?: ImportPlanDuplicate[];
  /** DEC-663 amendment (wave 64): count of possible-duplicate matches beyond
   * the MAX_POSSIBLE_DUPLICATES cap; omitted (never 0) when there is none. */
  possibleDuplicatesMore?: number;
  /** DEC-417 (amendment): target -> overBudgetBy message, from
   * importFieldCapViolations -- present (action: "skip") whenever this row
   * would mint/patch a contact over a per-column cap the hand-typed drawer
   * also enforces. The ImportWizard Review step surfaces this the same way
   * it surfaces possibleDuplicates/overwrites, so the offending field is
   * named before the organizer commits the import (not only at apply). */
  capViolations?: Record<string, string>;
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
  rows: { line: number; parsed: Record<string, unknown>; capViolations?: Record<string, string> }[],
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

  for (const { line, parsed, capViolations } of rows) {
    const email = typeof parsed.email === "string" ? parsed.email : undefined;
    // DEC-417 (amendment): a row over a per-column cap is planned as a skip
    // (never a create/update) so it surfaces on the dry-run Review step --
    // applyImportRows refuses this exact same line for the exact same
    // reason, never truncating the value to fit.
    if (capViolations && Object.keys(capViolations).length > 0) {
      planRows.push({
        line,
        email: email ?? "",
        action: "skip",
        reason: describeCapViolations(capViolations),
        capViolations,
      });
      skippedCount++;
      continue;
    }
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
        ...(duplicates.length > 0
          ? { possibleDuplicates: duplicates.slice(0, MAX_POSSIBLE_DUPLICATES).map(toImportPlanDuplicate) }
          : {}),
        ...(duplicates.length > MAX_POSSIBLE_DUPLICATES
          ? { possibleDuplicatesMore: duplicates.length - MAX_POSSIBLE_DUPLICATES }
          : {}),
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
