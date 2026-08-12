// Contacts/CRM domain core (J11), pure module per DEC-002.
// No node:/cloudflare imports — Web APIs only. This module consumes
// already-parsed CSV rows (parseCsv lives in src/lib/csv.ts, DEC-011); it
// never imports the CSV parser itself.

// DEC-467: exactly one normalizeEmail survives in the product (src/domain/email.ts).
import { normalizeEmail } from "./email";

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

function normalizedName(first: string, last: string): string {
  return `${first} ${last}`
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedCompany(company: string | undefined): string {
  return (company ?? "").toLowerCase().trim();
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
 */
export function findDuplicateGroups(contacts: ContactRecord[]): string[][] {
  const groups: string[][] = [];

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
      groups.push(bucket.map((c) => c.id));
      for (const c of bucket) emailGroupedIds.add(c.id);
    }
  }

  // Remaining contacts: those with no email, plus those whose email was
  // unique (didn't group with anyone). These may still group by name, but
  // never across two different non-empty emails.
  const remainder = contacts.filter((c) => !emailGroupedIds.has(c.id) && !alreadyInMultiEmailGroup(c, byEmail));

  const byName = new Map<string, ContactRecord[]>();
  for (const contact of remainder) {
    const name = normalizedName(contact.firstName, contact.lastName);
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
        groups.push(companyGroup.map((c) => c.id));
      }
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
  const name = normalizedName(row.firstName ?? "", row.lastName ?? "");
  if (name === "") return [];
  const rowEmail = normalizeEmail(row.email);
  const rowCompany = normalizedCompany(row.company);

  const nameMatches = candidates.filter(
    (c) => normalizeEmail(c.email) !== rowEmail && normalizedName(c.firstName, c.lastName) === name,
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

export interface MergeFieldPreview {
  key: string;
  label: string;
  kept: string;
  discarded: string[];
  outcome: "keep" | "fill" | "append" | "combine";
}

const MERGE_PREVIEW_STANDARD_FIELDS: { key: "firstName" | "lastName" | "email" | "phone" | "company" | "title" | "bio"; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "bio", label: "Bio" },
];

/**
 * DEC-705: pure preview of what mergeContacts will actually write, computed
 * by folding planMerge over `duplicates` in the exact same order the repo's
 * mergeOnePair chain does (primary, then each duplicate in turn, survivor
 * becoming the next primary) -- this is the ONLY place that reasons about
 * merge rules besides planMerge itself; it never re-derives them.
 *
 * Reports one entry per field that differs from the running primary or is
 * combined from a duplicate, across all standard fields, notes, and every
 * custom field key touched by any duplicate. `kept` is the field's final
 * value after every fold; `discarded` collects the distinct dropped values
 * (never populated for 'fill'/'append'/'combine' -- nothing is lost there,
 * it's incorporated into `kept`, not thrown away).
 */
export function previewMerge(primary: ContactRecord, duplicates: ContactRecord[]): MergeFieldPreview[] {
  const outcomeByKey = new Map<string, MergeFieldPreview["outcome"]>();
  const discardedByKey = new Map<string, string[]>();
  const labelByKey = new Map<string, string>();

  let survivor = primary;
  for (const duplicate of duplicates) {
    const before = survivor;
    const { merged } = planMerge(before, duplicate);

    for (const { key, label } of MERGE_PREVIEW_STANDARD_FIELDS) {
      labelByKey.set(key, label);
      const beforeVal = (before[key] ?? "").trim();
      const dupVal = (duplicate[key] ?? "").trim();
      if (dupVal === "" || dupVal === beforeVal) continue;
      if (beforeVal === "") {
        if (!outcomeByKey.has(key)) outcomeByKey.set(key, "fill");
      } else {
        outcomeByKey.set(key, "keep");
        const list = discardedByKey.get(key) ?? [];
        if (!list.includes(dupVal)) list.push(dupVal);
        discardedByKey.set(key, list);
      }
    }

    // Notes: DEC-167 always appends duplicate-only notes text onto the
    // running primary's notes rather than filling/discarding, whether or
    // not the primary already had notes of its own.
    labelByKey.set("notes", "Notes");
    const beforeNotes = (before.notes ?? "").trim();
    const dupNotes = (duplicate.notes ?? "").trim();
    if (dupNotes !== "" && dupNotes !== beforeNotes) {
      outcomeByKey.set("notes", "append");
    }

    // Custom fields: union, primary wins on key collision (a 'keep'), a
    // duplicate-only key is added by the union (a 'combine').
    for (const [fieldKey, dupValue] of Object.entries(duplicate.customFields ?? {})) {
      const key = `customFields.${fieldKey}`;
      labelByKey.set(key, fieldKey);
      const beforeValue = before.customFields?.[fieldKey];
      if (beforeValue === undefined) {
        if (!outcomeByKey.has(key)) outcomeByKey.set(key, "combine");
      } else if (beforeValue !== dupValue) {
        outcomeByKey.set(key, "keep");
        const list = discardedByKey.get(key) ?? [];
        if (!list.includes(dupValue)) list.push(dupValue);
        discardedByKey.set(key, list);
      }
    }

    survivor = merged;
  }

  const keptValue = (key: string): string => {
    if (key === "notes") return (survivor.notes ?? "").trim();
    if (key.startsWith("customFields.")) {
      return survivor.customFields?.[key.slice("customFields.".length)] ?? "";
    }
    return (survivor[key as keyof ContactRecord] as string | undefined)?.trim() ?? "";
  };

  const out: MergeFieldPreview[] = [];
  for (const [key, outcome] of outcomeByKey) {
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
