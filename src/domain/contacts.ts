// Contacts/CRM domain core (J11), pure module per DEC-002.
// No node:/cloudflare imports — Web APIs only. This module consumes
// already-parsed CSV rows (parseCsv lives in src/lib/csv.ts, DEC-011); it
// never imports the CSV parser itself.

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

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
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
    const email = normalizedEmail(contact.email);
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
  const email = normalizedEmail(contact.email);
  if (email === "") return false;
  const bucket = byEmail.get(email);
  return !!bucket && bucket.length > 1;
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

const STANDARD_FIELDS = new Set(["email", "firstName", "lastName", "company", "title"]);

function fieldValue(contact: ContactRecord, field: string): string {
  if (field.startsWith("custom.")) {
    const key = field.slice("custom.".length);
    return contact.customFields?.[key] ?? "";
  }
  if (!STANDARD_FIELDS.has(field)) {
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
