// Contacts/CRM domain core (J11), pure module per DEC-002.
// No node:/cloudflare imports — Web APIs only.
//
// Part of the contacts.ts decomposition (structure custodian): duplicate
// detection (findDuplicateGroups, findImportDuplicateCandidates,
// describeImportOverwrites). src/domain/contacts.ts re-exports everything
// here; import from that barrel, not this file, outside of the
// contacts-parts/* sibling modules themselves.

// DEC-467: exactly one normalizeEmail survives in the product (src/domain/email.ts).
import { normalizeEmail } from "../email";
import { DEC_800 } from "../../decisions";
import type { ContactRecord } from "./types";
import { normalizedContactName, normalizedCompany } from "./types";

void DEC_800;

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
