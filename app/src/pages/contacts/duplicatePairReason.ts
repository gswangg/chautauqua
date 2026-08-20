// DEC-380: Chautauqua Contacts.dc.html:159 draws a per-pair match reason
// ('Same email domain, one has no company') under every possible-duplicate
// row; DuplicatesView/DirectoryRail rendered the pair and its Merge/Keep
// both actions with no such sentence -- an organiser was asked to merge two
// people without being told why they were paired. This derives the frame's
// sentence from data the view already has: the server's own `reason` (the
// rule that produced the pair -- exact email, name+company, or name alone,
// findDuplicateGroupsForOrg/DuplicateGroup['reason']) plus the two contacts'
// `company` field, both already carried on the group -- never a new API
// field, per this lane's own instruction.
import type { DuplicateReason } from './types';
import { DEC_380 } from '../../../../src/decisions';

void DEC_380; // this whole module builds the frame caption DEC-380's own commit calls out as buildable, not deferred

export interface DuplicatePairReasonContact {
  company?: string | null;
}

/** The base clause per matching rule, in the frame's own words. 'email'
 * fires on an exact email match (a stronger condition than same-domain, so
 * "Same email domain" is still true); 'name_and_company' and 'name' are
 * DEC-800's existing two name-based rules, renamed to the frame's phrasing
 * ("Same last name" for the different-company case, since the pair's last
 * names are what actually matched -- the frame never says "different
 * company" itself). */
const BASE_REASON: Record<DuplicateReason, string> = {
  email: 'Same email domain',
  name_and_company: 'Same name and company',
  name: 'Same last name',
};

function hasCompany(c: DuplicatePairReasonContact): boolean {
  return Boolean(c.company && c.company.trim() !== '');
}

/** The frame's per-pair reason sentence. `contacts` is the group's own
 * contact list -- when it holds exactly the pair (the common case; a 3+
 * contact email-bucket group has no single pair, DEC-770/findDuplicateGroupsForOrg's
 * own comment), a one-sided company gap is named as a trailing clause on
 * top of the base rule. Any other contact count (the fallback) states only
 * the base rule -- "one has no company" is a claim about a PAIR and cannot
 * be made about a larger group without picking two of its members
 * arbitrarily. */
export function duplicatePairReason(reason: DuplicateReason, contacts: DuplicatePairReasonContact[]): string {
  const base = BASE_REASON[reason];
  if (contacts.length !== 2) return base;
  const [a, b] = contacts;
  const oneMissingCompany = hasCompany(a!) !== hasCompany(b!);
  return oneMissingCompany ? `${base}, one has no company` : base;
}
