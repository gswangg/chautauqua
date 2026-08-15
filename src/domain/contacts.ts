// Contacts/CRM domain core (J11), pure module per DEC-002.
// No node:/cloudflare imports — Web APIs only. This module consumes
// already-parsed CSV rows (parseCsv lives in src/lib/csv.ts, DEC-011); it
// never imports the CSV parser itself.

// DEC-467: exactly one normalizeEmail survives in the product (src/domain/email.ts).
import { normalizeEmail } from "./email";
import { ACTIVE_INVITE_STATUSES } from "./acceptance";
import { contactLabels, RESERVED_CUSTOM_FIELD_KEYS } from "./contact-labels";

const RESERVED_CUSTOM_FIELD_KEY_SET: Set<string> = new Set(Object.values(RESERVED_CUSTOM_FIELD_KEYS));
import { overBudgetBy } from "./count-copy";
import { MAX_NAME_LENGTH, MAX_LONG_TEXT_LENGTH, MAX_TEXT_LENGTH } from "../forms/validate"; // DEC-417
import { DEC_800 } from "../decisions";

void DEC_800;

// DEC-422 (amendment, wave 59): batch caps get one pure-core home so a
// route module can never hand-declare its own `const MAX_* = <number>`
// literal (see test/batch-cap-declaration.scan.test.ts). Bounds the
// segment rule set on BOTH the write path (POST/PATCH /segments) and the
// read path (?rules=), so a stored segment can never exceed what a live
// query is allowed to send -- same constant, one spelling (DEC-417,
// wave-31 amendment).
export const MAX_SEGMENT_RULES = 20;

// DEC-422 (amendment, wave 59): CSV import request-input bound, before
// parseCsv touches an arbitrarily large body (DEC-417).
export const MAX_IMPORT_CSV_BYTES = 5_000_000;

/** Hard cap on rows per CSV import (DEC-356, DEC-478): protects against an
 * unbounded per-row write burst. This is the ONE MAX_IMPORT_ROWS in the
 * product (DEC-478); the route layer imports it from here rather than
 * declaring its own. Producers must split larger files client-side.
 *
 * DEC-491 amendment (wave 47): the commit loop below issues NO awaited
 * writes per row — every create/update is resolved in memory and flushed
 * AFTER the loop through chunked multi-row statements (chunkRowsForInsert,
 * DEC-528), so the per-request statement count is O(rows / chunk size), not
 * O(rows). See MAX_D1_STATEMENTS_PER_REQUEST below for the derived bound
 * this is checked against.
 *
 * DEC-478 amendment (wave 62): moved from src/server/repo/contacts/import.ts
 * (a drizzle-importing repo module the SPA cannot import) to this pure-core
 * module so app/src/pages/contacts/ImportWizard.tsx can disclose the cap
 * where the file is chosen, not only in the 400 at the end. */
export const MAX_IMPORT_ROWS = 2000;

export interface SocialLinks {
  twitter: string;
  linkedin: string;
  github: string;
  website: string;
}

export interface ContactRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  title?: string;
  phone?: string;
  bio?: string;
  headshotUrl?: string;
  notes?: string;
  socialLinks?: SocialLinks;
  customFields?: Record<string, string>;
}

/**
 * Sanitizes a stored contact URL for safe public rendering (DEC-322): trims
 * whitespace, returns null for blank input, and parses via the URL
 * constructor at this external-input boundary (try/catch is appropriate
 * here — malformed stored values are expected). Only http:/https: protocols
 * are allowed through; anything else (javascript:, data:, etc.) returns
 * null so it can never reach an href/src attribute.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
    return null;
  } catch {
    return null;
  }
}

// Wave-41 amendment (DEC-788): the whitespace class this function collapses
// is CLOSED and enumerated (not the open Unicode \s class) so a SQL prefilter
// can be a PROVABLE superset of this collapse rule rather than an
// approximation — space, tab, CR, LF, FF, VT, and NBSP. Output is otherwise
// identical to the prior open-\s behavior for every input this product's
// domain ever produces (contact names never carry other Unicode whitespace,
// e.g. U+2028/U+3000).
const CONTACT_NAME_WHITESPACE = /[\t\n\v\f\r\u0020\u00a0]+/g;

export function normalizedContactName(first: string, last: string): string {
  return `${first} ${last}`
    .toLowerCase()
    .trim()
    .replace(CONTACT_NAME_WHITESPACE, " ");
}

/**
 * Wave-41 (DEC-788 amendment): same closed whitespace class as
 * normalizedContactName, but STRIPS rather than collapses — a coarser
 * transform than normalizedContactName's own collapse-to-single-space, so
 * two names that normalizedContactName would treat as equal are still equal
 * under this stripping (whitespace removed entirely is a superset of
 * whitespace collapsed to one space), AND two names whose first/last SPLIT
 * differs (e.g. "Mary Jo"/"Smith" vs "Mary"/"Jo Smith") collapse to the same
 * string here even though normalizedContactName's own `${first} ${last}`
 * join would not. This asymmetric coarsening is exactly what makes it safe
 * as a SQL PREFILTER for findDuplicateGroups's own name-bucketing (see
 * repo/contacts/merge.ts's scanContactsForOrg narrowing): a real match can
 * never be excluded, only (rarely) over-included, and findDuplicateGroups
 * remains the sole decider of an actual match.
 */
export function stripContactNameWhitespace(s: string): string {
  return s.toLowerCase().replace(CONTACT_NAME_WHITESPACE, "");
}

function normalizedCompany(company: string | undefined): string {
  return (company ?? "").toLowerCase().trim();
}

/** DEC-800: why a pair/group was surfaced as a possible duplicate — an
 * exact email match, a same-name-same-company match (DEC-143), or a
 * same-name-different-company match (a person who changed employers). */
export type DuplicateReason = "email" | "name_and_company" | "name";

export interface DuplicateCandidate {
  contactIds: string[];
  reason: DuplicateReason;
}

/**
 * Groups contacts that are likely duplicates: first by case-insensitive
 * trimmed email (non-empty emails only), then — among contacts left over
 * with no non-empty email, or whose email did not match any other contact's
 * email — by normalized (lowercase, whitespace-collapsed) firstName+lastName,
 * sub-grouped by normalized company per DEC-143: within a name bucket,
 * contacts are further split by normalized company, except contacts with a
 * blank company match any named-company sub-group (a wildcard). Every
 * resulting sub-group of two or more is surfaced regardless of how many
 * distinct non-empty emails it spans — email diversity no longer suppresses
 * a same-name-same-company match.
 *
 * DEC-800: when a name bucket's members span two or more distinct non-empty
 * companies, the whole bucket is ALSO surfaced as its own candidate with
 * reason 'name' — the commonest CRM duplicate is a person who changed
 * employers, and the company sub-grouping above would otherwise never group
 * them. This is in addition to (not instead of) the 'name_and_company'
 * sub-group candidates; the same id set is never emitted twice, and a
 * two-member bucket with two distinct companies yields ONLY the 'name'
 * candidate since each company sub-group there has a single member.
 */
export function findDuplicateGroups(contacts: ContactRecord[]): DuplicateCandidate[] {
  const groups: DuplicateCandidate[] = [];

  const byEmail = new Map<string, ContactRecord[]>();
  const noEmail: ContactRecord[] = [];

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email);
    if (email === "") {
      noEmail.push(contact);
      continue;
    }
    const bucket = byEmail.get(email);
    if (bucket) {
      bucket.push(contact);
    } else {
      byEmail.set(email, [contact]);
    }
  }

  const emailGroupedIds = new Set<string>();
  for (const bucket of byEmail.values()) {
    if (bucket.length > 1) {
      groups.push({ contactIds: bucket.map((c) => c.id), reason: "email" });
      for (const c of bucket) emailGroupedIds.add(c.id);
    }
  }

  // Remaining contacts: those with no email, plus those whose email was
  // unique (didn't group with anyone). These may still group by name, but
  // never across two different non-empty emails.
  const remainder = contacts.filter((c) => !emailGroupedIds.has(c.id) && !alreadyInMultiEmailGroup(c, byEmail));

  const byName = new Map<string, ContactRecord[]>();
  for (const contact of remainder) {
    const name = normalizedContactName(contact.firstName, contact.lastName);
    if (name === "") continue;
    const bucket = byName.get(name);
    if (bucket) {
      bucket.push(contact);
    } else {
      byName.set(name, [contact]);
    }
  }

  for (const bucket of byName.values()) {
    if (bucket.length < 2) continue;
    for (const companyGroup of subGroupByCompany(bucket)) {
      if (companyGroup.length >= 2) {
        groups.push({ contactIds: companyGroup.map((c) => c.id), reason: "name_and_company" });
      }
    }

    // DEC-800: the bucket as a whole, when it spans two or more distinct
    // non-empty companies, is ALSO its own candidate (reason 'name') — a
    // person who changed employers. Every per-company sub-group above is by
    // construction a strict subset of the bucket whenever two or more named
    // companies exist (each sub-group holds only one named company's
    // members plus wildcards), so this id set can never collide with one
    // already emitted above.
    const distinctCompanies = new Set(
      bucket.map((c) => normalizedCompany(c.company)).filter((company) => company !== ""),
    );
    if (distinctCompanies.size >= 2) {
      groups.push({ contactIds: bucket.map((c) => c.id), reason: "name" });
    }
  }

  return groups;
}

/**
 * Splits a name-matched bucket into sub-groups by normalized company (DEC-
 * 143). Contacts with a blank company are wildcards: they join every named-
 * company sub-group that exists. If no contact in the bucket has a non-blank
 * company, the whole bucket is a single (all-blank) sub-group.
 */
function subGroupByCompany(bucket: ContactRecord[]): ContactRecord[][] {
  const named = new Map<string, ContactRecord[]>();
  const blanks: ContactRecord[] = [];

  for (const contact of bucket) {
    const company = normalizedCompany(contact.company);
    if (company === "") {
      blanks.push(contact);
      continue;
    }
    const existing = named.get(company);
    if (existing) {
      existing.push(contact);
    } else {
      named.set(company, [contact]);
    }
  }

  if (named.size === 0) {
    return [blanks];
  }

  return Array.from(named.values()).map((group) => [...group, ...blanks]);
}

function alreadyInMultiEmailGroup(
  contact: ContactRecord,
  byEmail: Map<string, ContactRecord[]>,
): boolean {
  const email = normalizeEmail(contact.email);
  if (email === "") return false;
  const bucket = byEmail.get(email);
  return !!bucket && bucket.length > 1;
}

/**
 * DEC-663: finds contacts that plausibly refer to the same human as an
 * about-to-be-imported CSV row, for the dry-run plan's `possibleDuplicates`.
 * Uses the SAME normalization findDuplicateGroups uses above (normalized
 * first+last name, sub-grouped by normalized company where a blank company
 * is a wildcard on EITHER side), restricted to candidates whose
 * normalizeEmail differs from the row's (a matching email is an update, not
 * a "possible" duplicate — resolveImportUpsert already handles that case).
 */
export function findImportDuplicateCandidates(
  row: { firstName?: string; lastName?: string; company?: string; email: string },
  candidates: ContactRecord[],
): ContactRecord[] {
  const name = normalizedContactName(row.firstName ?? "", row.lastName ?? "");
  if (name === "") return [];
  const rowEmail = normalizeEmail(row.email);
  const rowCompany = normalizedCompany(row.company);

  const nameMatches = candidates.filter(
    (c) => normalizeEmail(c.email) !== rowEmail && normalizedContactName(c.firstName, c.lastName) === name,
  );

  if (rowCompany === "") {
    // The row is a company-blank wildcard: it matches every name-matched
    // candidate regardless of that candidate's own company.
    return nameMatches;
  }

  return nameMatches.filter((c) => {
    const candidateCompany = normalizedCompany(c.company);
    return candidateCompany === "" || candidateCompany === rowCompany;
  });
}

/**
 * DEC-663: describes which non-blank stored fields a resolveImportUpsert
 * update `patch` would REPLACE on `existing` — a field is an overwrite only
 * when the incoming value is non-blank, the stored value is non-blank, and
 * they differ after trim (a blank incoming cell is ABSENT DATA, per
 * resolveImportUpsert's existing setIfNonBlank semantics, which this
 * function does not change — it only describes, never decides, what a patch
 * would do).
 */
export function describeImportOverwrites(
  existing: ContactRecord,
  patch: Partial<ContactRecord>,
): Array<{ field: "firstName" | "lastName" | "company" | "title" | "phone" | "bio"; from: string; to: string }> {
  const fields = ["firstName", "lastName", "company", "title", "phone", "bio"] as const;
  const out: Array<{ field: (typeof fields)[number]; from: string; to: string }> = [];
  for (const field of fields) {
    const incoming = patch[field];
    if (incoming === undefined) continue;
    const incomingTrimmed = incoming.trim();
    if (incomingTrimmed === "") continue;
    const stored = (existing[field] ?? "").trim();
    if (stored === "") continue;
    if (stored === incomingTrimmed) continue;
    out.push({ field, from: stored, to: incomingTrimmed });
  }
  return out;
}

export interface MergePlan {
  merged: ContactRecord;
  duplicateId: string;
}

/**
 * Pure descriptor for merging duplicate into primary: primary wins on every
 * field; blank/missing primary fields are filled from duplicate; customFields
 * are unioned with primary taking precedence on key collisions. Does not
 * touch the database — repointing participant/submission/task_assignment/
 * email_log rows to primary.id is wave-3 wiring.
 *
 * DEC-167: primary wins are still fill-if-blank for phone/bio/headshotUrl,
 * socialLinks are filled per-key (each of twitter/linkedin/github/website
 * independently falls back to duplicate's value when primary's is blank),
 * and notes are never silently dropped — primary's notes are kept, with
 * duplicate's notes appended after a '\n\n---\n\n' separator when duplicate
 * has non-blank notes that differ from primary's (so duplicate-only notes
 * always survive the merge instead of being destroyed).
 */
export function planMerge(primary: ContactRecord, duplicate: ContactRecord): MergePlan {
  const fill = (primaryVal: string | undefined, dupVal: string | undefined): string | undefined => {
    if (primaryVal !== undefined && primaryVal.trim() !== "") return primaryVal;
    return dupVal;
  };

  const merged: ContactRecord = {
    id: primary.id,
    email: fill(primary.email, duplicate.email) ?? "",
    firstName: fill(primary.firstName, duplicate.firstName) ?? "",
    lastName: fill(primary.lastName, duplicate.lastName) ?? "",
  };

  const company = fill(primary.company, duplicate.company);
  if (company !== undefined) merged.company = company;

  const title = fill(primary.title, duplicate.title);
  if (title !== undefined) merged.title = title;

  const phone = fill(primary.phone, duplicate.phone);
  if (phone !== undefined) merged.phone = phone;

  const bio = fill(primary.bio, duplicate.bio);
  if (bio !== undefined) merged.bio = bio;

  const headshotUrl = fill(primary.headshotUrl, duplicate.headshotUrl);
  if (headshotUrl !== undefined) merged.headshotUrl = headshotUrl;

  if (primary.socialLinks !== undefined || duplicate.socialLinks !== undefined) {
    const keys: (keyof SocialLinks)[] = ["twitter", "linkedin", "github", "website"];
    const socialLinks = {} as SocialLinks;
    for (const key of keys) {
      socialLinks[key] = fill(primary.socialLinks?.[key], duplicate.socialLinks?.[key]) ?? "";
    }
    merged.socialLinks = socialLinks;
  }

  const primaryNotes = primary.notes?.trim() ?? "";
  const duplicateNotes = duplicate.notes?.trim() ?? "";
  if (duplicateNotes !== "" && duplicateNotes !== primaryNotes) {
    merged.notes = primaryNotes !== "" ? `${primaryNotes}\n\n---\n\n${duplicateNotes}` : duplicateNotes;
  } else if (primaryNotes !== "") {
    merged.notes = primaryNotes;
  }

  const customFields = { ...(duplicate.customFields ?? {}), ...(primary.customFields ?? {}) };
  if (Object.keys(customFields).length > 0) merged.customFields = customFields;

  return { merged, duplicateId: duplicate.id };
}

// invite_status's full vocabulary is 'none' | 'invited' | 'accepted' |
// 'declined' (DEC-003); 'accepted'/'none' are restated here from
// ACTIVE_INVITE_STATUSES (src/domain/acceptance.ts) rather than a second,
// independently-typed literal union so the two modules can't drift.
const [INVITE_STATUS_NONE, INVITE_STATUS_ACCEPTED] = ACTIVE_INVITE_STATUSES;
const INVITE_STATUS_RANK: Record<string, number> = {
  [INVITE_STATUS_ACCEPTED]: 3,
  declined: 2,
  invited: 1,
  [INVITE_STATUS_NONE]: 0,
};

// Wave-39 (DEC-020 amendment): INVITE_STATUS_RANK is a plain object literal
// — `INVITE_STATUS_RANK[x]` for a prototype key like `constructor` returns a
// function, so the `?? -1` fallback never fires and the doc-promised "ranks
// lowest" guarantee breaks. Own-property lookup only, matching
// src/domain/files.ts's allowedContentType shape.
function lookupInviteStatusRank(status: string): number | null {
  return Object.prototype.hasOwnProperty.call(INVITE_STATUS_RANK, status)
    ? INVITE_STATUS_RANK[status]!
    : null;
}

/**
 * DEC-282 amendment: picks the surviving participant.inviteStatus when both
 * contacts being merged are participants on the same submission. Rank
 * accepted(3) > declined(2) > invited(1) > none(0) so a genuine acceptance is
 * never silently discarded by merging the accepted duplicate into a keeper
 * that only got as far as 'declined' or 'invited' — max wins. An unrecognized
 * literal ranks lowest (below 'none') and can never displace a known
 * status; ties keep `a` (the kept contact's own value).
 */
export function mergedInviteStatus(a: string, b: string): string {
  const rankA = lookupInviteStatusRank(a) ?? -1;
  const rankB = lookupInviteStatusRank(b) ?? -1;
  return rankB > rankA ? b : a;
}

/**
 * DEC-282 amendment: picks the surviving participant.visible flag when both
 * contacts being merged are participants on the same submission — logical
 * OR, so merging a publicly-visible duplicate into a keeper that was hidden
 * never silently pulls the merged person out of public visibility.
 */
export function mergedParticipantVisible(a: boolean, b: boolean): boolean {
  return a || b;
}

export interface MergeFieldPreview {
  key: string;
  label: string;
  kept: string;
  discarded: string[];
  outcome: "keep" | "fill" | "append" | "combine";
}

const MERGE_PREVIEW_STANDARD_FIELDS: { key: "email" | "company" | "title" | "phone" | "bio"; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "phone", label: "Phone" },
  { key: "bio", label: "Bio" },
];

// DEC-748 amendment (wave 2): the six identity rows a merge preview ALWAYS
// shows, in this fixed order, regardless of whether the fields actually
// differ -- a pair identical in every field still shows all six ('keep',
// empty discarded). Name folds firstName+lastName to one row (no separate
// First/Last rows); Labels folds every customFields.* key through
// contactLabels (src/domain/contact-labels.ts) into one row -- no raw
// customFields.* row reaches the client any more.
const MERGE_PREVIEW_IDENTITY_FIELDS: { key: "name" | "email" | "company" | "title" | "labels" | "notes"; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "labels", label: "Labels" },
  { key: "notes", label: "Notes" },
];

function fullName(c: ContactRecord): string {
  return `${(c.firstName ?? "").trim()} ${(c.lastName ?? "").trim()}`.trim();
}

/**
 * DEC-705: pure preview of what mergeContacts will actually write, computed
 * by folding planMerge over `duplicates` in the exact same order the repo's
 * mergeOnePair chain does (primary, then each duplicate in turn, survivor
 * becoming the next primary) -- this is the ONLY place that reasons about
 * merge rules besides planMerge itself; it never re-derives them.
 *
 * DEC-748 amendment (wave 2): the FIRST SIX entries returned are always, in
 * fixed order, Name/Email/Company/Title/Labels/Notes -- present even when
 * nothing differs (outcome 'keep', discarded []). Any other differing field
 * (Phone, Bio) follows after, in the order it's declared above.
 *
 * `kept` is the field's final value after every fold; `discarded` collects
 * the distinct dropped values (never populated for 'fill'/'append'/'combine'
 * -- nothing is lost there, it's incorporated into `kept`, not thrown away).
 * A duplicate with a BLANK value against a non-blank primary field still
 * discards "" rather than being silently skipped -- only truly identical
 * values (dupVal === beforeVal, including both blank) leave no trace.
 */
export function previewMerge(primary: ContactRecord, duplicates: ContactRecord[]): MergeFieldPreview[] {
  const outcomeByKey = new Map<string, MergeFieldPreview["outcome"]>();
  const discardedByKey = new Map<string, string[]>();
  const labelByKey = new Map<string, string>();

  let survivor = primary;
  for (const duplicate of duplicates) {
    const before = survivor;
    const { merged } = planMerge(before, duplicate);

    // Name: firstName+lastName folded to one row (DEC-748 amendment).
    labelByKey.set("name", "Name");
    const beforeName = fullName(before);
    const dupName = fullName(duplicate);
    if (dupName !== beforeName) {
      if (beforeName === "") {
        if (!outcomeByKey.has("name")) outcomeByKey.set("name", "fill");
      } else {
        outcomeByKey.set("name", "keep");
        const list = discardedByKey.get("name") ?? [];
        if (!list.includes(dupName)) list.push(dupName);
        discardedByKey.set("name", list);
      }
    }

    for (const { key, label } of MERGE_PREVIEW_STANDARD_FIELDS) {
      labelByKey.set(key, label);
      const beforeVal = (before[key] ?? "").trim();
      const dupVal = (duplicate[key] ?? "").trim();
      if (dupVal === beforeVal) continue;
      if (beforeVal === "") {
        // dupVal is non-blank here (dupVal !== beforeVal === "")
        if (!outcomeByKey.has(key)) outcomeByKey.set(key, "fill");
      } else {
        // beforeVal survives whether dupVal is blank or a differing value --
        // either way the duplicate's side is discarded (DEC-748: a blank
        // dupVal is discarded too, as "").
        outcomeByKey.set(key, "keep");
        const list = discardedByKey.get(key) ?? [];
        if (!list.includes(dupVal)) list.push(dupVal);
        discardedByKey.set(key, list);
      }
    }

    // Notes: DEC-167 always appends duplicate-only notes text onto the
    // running primary's notes rather than filling/discarding, whether or
    // not the primary already had notes of its own. DEC-802: the Notes row
    // is shown whenever either side has notes at all, even when the
    // duplicate contributes nothing (a keeper-only note must still be
    // visible in the preview).
    labelByKey.set("notes", "Notes");
    const beforeNotes = (before.notes ?? "").trim();
    const dupNotes = (duplicate.notes ?? "").trim();
    if (dupNotes !== "" && dupNotes !== beforeNotes) {
      outcomeByKey.set("notes", "append");
    } else if (beforeNotes !== "" && !outcomeByKey.has("notes")) {
      outcomeByKey.set("notes", "keep");
    }

    // Labels: union of both sides' customFields keys folded into ONE row
    // through contactLabels (DEC-738/DEC-748 amendment) -- never a raw
    // customFields.<key> row. The reserved keys (dietary, travel,
    // accessibility -- DEC-292 amendment findings wave 5) are excluded
    // (they're each edited via their own textarea, never listed as a
    // label). A duplicate-only key upgrades the row to 'combine'; a
    // colliding key that differs stays 'keep' with the dropped "key value"
    // pair recorded in discarded.
    labelByKey.set("labels", "Labels");
    const customFieldKeys = new Set<string>([
      ...Object.keys(before.customFields ?? {}),
      ...Object.keys(duplicate.customFields ?? {}),
    ]);
    for (const fieldKey of customFieldKeys) {
      if (RESERVED_CUSTOM_FIELD_KEY_SET.has(fieldKey)) continue;
      const beforeValue = before.customFields?.[fieldKey];
      const hasDupValue = Object.prototype.hasOwnProperty.call(duplicate.customFields ?? {}, fieldKey);
      const dupValue = duplicate.customFields?.[fieldKey];
      if (beforeValue === undefined) {
        if (hasDupValue) outcomeByKey.set("labels", "combine");
      } else if (hasDupValue && beforeValue !== dupValue) {
        if (outcomeByKey.get("labels") !== "combine") outcomeByKey.set("labels", "keep");
        const list = discardedByKey.get("labels") ?? [];
        const entry = `${fieldKey} ${dupValue ?? ""}`;
        if (!list.includes(entry)) list.push(entry);
        discardedByKey.set("labels", list);
      }
    }

    survivor = merged;
  }

  const keptValue = (key: string): string => {
    if (key === "name") return fullName(survivor);
    if (key === "notes") return (survivor.notes ?? "").trim();
    if (key === "labels") return contactLabels(survivor.customFields ?? {}).join(", ");
    return (survivor[key as keyof ContactRecord] as string | undefined)?.trim() ?? "";
  };

  const out: MergeFieldPreview[] = MERGE_PREVIEW_IDENTITY_FIELDS.map(({ key, label }) => ({
    key,
    label,
    kept: keptValue(key),
    discarded: discardedByKey.get(key) ?? [],
    outcome: outcomeByKey.get(key) ?? "keep",
  }));

  const identityKeys = new Set<string>(MERGE_PREVIEW_IDENTITY_FIELDS.map((f) => f.key));
  for (const [key, outcome] of outcomeByKey) {
    if (identityKeys.has(key)) continue;
    out.push({
      key,
      label: labelByKey.get(key) ?? key,
      kept: keptValue(key),
      discarded: discardedByKey.get(key) ?? [],
      outcome,
    });
  }
  return out;
}

/**
 * Splits a free-text contact search query into lowercase, whitespace-
 * separated tokens (DEC-266). Empty/whitespace-only input yields [] (the
 * caller treats zero tokens as "match everything").
 */
export function tokenizeContactQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t !== "");
}

export interface SegmentRule {
  field: string;
  op: "eq" | "ne" | "contains";
  value: string;
}

// DEC-554: exported so the segment/rules whole-directory scan (crud.ts)
// can derive its SQL projection by enumeration instead of hand-listing.
export const SEGMENT_STANDARD_FIELDS = new Set(["email", "firstName", "lastName", "company", "title"]);

function fieldValue(contact: ContactRecord, field: string): string {
  if (field.startsWith("custom.")) {
    const key = field.slice("custom.".length);
    return contact.customFields?.[key] ?? "";
  }
  if (!SEGMENT_STANDARD_FIELDS.has(field)) {
    throw new Error(`matchesSegment: unknown field "${field}"`);
  }
  const value = (contact as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

/** The standard fields 'any' fans out across (DEC-149) — custom.<key> fields
 * are intentionally excluded from 'any', matching the free-text search box's
 * historical scope of name/email/company/title. */
const ANY_FIELDS = ["email", "firstName", "lastName", "company", "title"] as const;

function matchesRule(rule: SegmentRule, contact: ContactRecord): boolean {
  const expected = rule.value.toLowerCase();

  if (rule.field === "any") {
    const values = ANY_FIELDS.map((f) => fieldValue(contact, f).toLowerCase());
    switch (rule.op) {
      case "eq":
        return values.some((v) => v === expected);
      case "contains":
        return values.some((v) => v.includes(expected));
      case "ne":
        return values.every((v) => v !== expected);
      default:
        throw new Error(`matchesSegment: unknown op "${rule.op}"`);
    }
  }

  const actual = fieldValue(contact, rule.field).toLowerCase();
  switch (rule.op) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "contains":
      return actual.includes(expected);
    default:
      throw new Error(`matchesSegment: unknown op "${rule.op}"`);
  }
}

/**
 * AND semantics across all rules, case-insensitive comparisons. Custom
 * fields are addressable as 'custom.<key>'. field === 'any' (DEC-149)
 * evaluates against email/firstName/lastName/company/title: a rule matches
 * if ANY of those fields matches for eq/contains, or if ALL of them differ
 * for ne. An unknown standard field name (other than 'any') throws (fail
 * loudly) — this module never silently treats unrecognized fields as empty.
 */
export function matchesSegment(rules: SegmentRule[], contact: ContactRecord): boolean {
  return rules.every((rule) => matchesRule(rule, contact));
}

/**
 * Maps an already-parsed CSV row into a partial ContactRecord using a
 * csvColumn -> targetField mapping. Targets are the standard fields
 * (email, firstName, lastName, company, title, phone, bio) plus 'custom.<key>'.
 * Columns with no mapping entry are ignored. If the mapped email column is
 * missing or blank, returns {} so callers can reject the row.
 */
export function mapImportRow(
  mapping: Record<string, string>,
  header: string[],
  row: string[],
): Partial<ContactRecord> {
  const result: Partial<ContactRecord> = {};
  const customFields: Record<string, string> = {};
  let hasCustom = false;

  for (let i = 0; i < header.length; i++) {
    const column = header[i];
    if (column === undefined) continue;
    const target = mapping[column];
    if (!target) continue;
    const value = row[i] ?? "";

    if (target.startsWith("custom.")) {
      const key = target.slice("custom.".length);
      customFields[key] = value;
      hasCustom = true;
      continue;
    }

    switch (target) {
      case "email":
        result.email = value;
        break;
      case "firstName":
        result.firstName = value;
        break;
      case "lastName":
        result.lastName = value;
        break;
      case "company":
        result.company = value;
        break;
      case "title":
        result.title = value;
        break;
      case "phone":
        result.phone = value;
        break;
      case "bio":
        result.bio = value;
        break;
      default:
        throw new Error(`mapImportRow: unknown target field "${target}"`);
    }
  }

  if (hasCustom) result.customFields = customFields;

  if (!result.email || result.email.trim() === "") {
    return {};
  }

  return result;
}

/** DEC-417 (amendment): the per-column caps every hand-typed contact editor
 * enforces (src/routes/api/contacts/crud.ts's checkLen, portal-edit.ts) —
 * applied to an already-mapped import row, so a CSV import can never mint
 * (or update) a contact its own drawer would then refuse to re-save.
 * NEVER truncates: a value over cap is reported by target name, and the
 * caller (planImportRows/applyImportRows) refuses the whole row instead of
 * silently shortening it (fail loudly). custom.<key> values are capped at
 * MAX_TEXT_LENGTH, matching checkLen's own customFields.<key> cap in
 * crud.ts. Returns {} when the row is within every cap. */
export function importFieldCapViolations(parsed: Partial<ContactRecord>): Record<string, string> {
  const violations: Record<string, string> = {};
  const check = (value: string | undefined, field: string, max: number) => {
    if (value !== undefined && value.length > max) violations[field] = overBudgetBy(value.length, max);
  };
  check(parsed.email, "email", MAX_NAME_LENGTH);
  check(parsed.firstName, "firstName", MAX_NAME_LENGTH);
  check(parsed.lastName, "lastName", MAX_NAME_LENGTH);
  check(parsed.company, "company", MAX_NAME_LENGTH);
  check(parsed.title, "title", MAX_NAME_LENGTH);
  check(parsed.phone, "phone", MAX_NAME_LENGTH);
  check(parsed.bio, "bio", MAX_LONG_TEXT_LENGTH);
  if (parsed.customFields) {
    for (const [key, value] of Object.entries(parsed.customFields)) {
      check(value, `custom.${key}`, MAX_TEXT_LENGTH);
    }
  }
  return violations;
}
