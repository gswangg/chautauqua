// Contacts/CRM domain core (J11), pure module per DEC-002.
// No node:/cloudflare imports — Web APIs only.
//
// Part of the contacts.ts decomposition (structure custodian): base record
// shape, URL sanitization, and name-normalization primitives shared by the
// other contacts-parts/* modules. src/domain/contacts.ts re-exports
// everything here; import from that barrel, not this file, outside of the
// contacts-parts/* sibling modules themselves.

import { personName } from "../person-name";

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

export function normalizedCompany(company: string | undefined): string {
  return (company ?? "").toLowerCase().trim();
}

// DEC-613 (wave-5 amendment): one join, one owner -- delegates to
// src/domain/person-name.ts's personName rather than hand-rolling the
// `${first} ${last}`.trim() join here too. Output is identical for every
// input this module ever produced (mononym or both-present).
export function fullName(c: ContactRecord): string {
  return personName(c);
}
