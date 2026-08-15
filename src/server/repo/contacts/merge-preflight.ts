// Contacts repo: pure, db-free whole-operation merge preflight. No Db, no
// drizzle, no io -- unit-tested directly (mirrors the thin-pure shape of
// ./query.ts). See mergeContacts (merge.ts) for how this is wired in, and
// decisions/DEC-026.md's wave-43 amendment for the "all-or-nothing" rule
// this exists to enforce.

import { planMerge, type ContactRecord } from "../../../domain/contacts";

export interface MergeFoldStep {
  mergeId: string;
  mergedEmail: string;
}

export interface MergeFoldResult {
  steps: MergeFoldStep[];
  finalEmail: string;
}

/** Folds the EXISTING planMerge cumulatively over `merges` in the exact same
 * order mergeContacts applies them (keep, then each merge id in turn, the
 * survivor of each fold becoming the "primary" for the next) -- a pure
 * mirror of mergeOnePair's own (b) step, performing no write. planMerge's
 * merged email can CHANGE at each step (a blank keep-side email is filled
 * from the duplicate), so every intermediate address -- not only the final
 * one -- is part of the conflict surface a whole-operation preflight must
 * check against. `merges` must be in the same order mergeContacts will fold
 * them; `keep`/`merges` entries are the PRE-merge records (never touched by
 * this function itself). */
export function planMergeFold(keep: ContactRecord, merges: ContactRecord[]): MergeFoldResult {
  const steps: MergeFoldStep[] = [];
  let survivor: ContactRecord = keep;
  for (const merge of merges) {
    const { merged } = planMerge(survivor, merge);
    steps.push({ mergeId: merge.id, mergedEmail: merged.email });
    survivor = merged;
  }
  const finalEmail = steps.length > 0 ? steps[steps.length - 1]!.mergedEmail : keep.email;
  return { steps, finalEmail };
}

export type MergeConflict = { code: "both_logins" | "email_taken"; message: string };

export interface DetectMergeConflictsInput {
  keepId: string;
  mergeIds: string[];
  /** Every contact id (a subset of [keepId, ...mergeIds]) that holds a login
   * account (a schema.user row with that contactId). */
  contactIdsWithLogin: Set<string>;
  /** lower(email) -> the owning schema.user row's contactId, or null for a
   * staff login (organizer/reviewer, created with contactId NULL -- DEC-565).
   * Only needs to cover the fold's own intermediate merged emails; an email
   * with no entry (no user row owns it at all) is never a conflict. */
  emailOwners: Map<string, string | null>;
  /** planMergeFold's own step output, same order. */
  steps: MergeFoldStep[];
}

export const MERGE_BOTH_LOGINS_MESSAGE = "Both contacts have a login account; remove one account before merging";
export const MERGE_EMAIL_TAKEN_MESSAGE = "That email already belongs to another account";

/** DEC-026 wave-43 amendment: the whole-operation conflict check that a
 * per-pair check (mergeOnePair's old (a)/(b2)) cannot see, because each pair
 * commits before the next pair's checks run. Both branches below are
 * cumulative over the FULL [keepId, ...mergeIds] set, not any single pair:
 *
 * (a) MORE THAN ONE contact in the full set holding a login is a conflict
 *     even when NO INDIVIDUAL PAIR trips it -- e.g. keepId and the third
 *     mergeId both have logins, but the fold's middle step (keepId, second
 *     mergeId) is clean on its own, so a per-pair check never sees the
 *     keepId+third-mergeId collision until it's too late.
 * (b) an intermediate merged email (every step's mergedEmail, not only the
 *     final one) owned by a user row whose contactId sits OUTSIDE the full
 *     [keepId, ...mergeIds] set is a conflict. Evaluated in JS against
 *     `emailOwners`, never as a SQL `NOT IN` -- DEC-565: SQLite's NOT IN
 *     evaluates to NULL (not TRUE) whenever the compared column is NULL,
 *     which is exactly a staff login's contactId, so a SQL NOT IN would
 *     silently let a staff-owned email collision through. A null owner
 *     (the email belongs to a login with no contact) is therefore ALWAYS a
 *     conflict, same as the pre-existing emailConflictsWithOtherAccount
 *     predicate (merge.ts) treats it.
 *
 * Returns the FIRST conflict found (in fold order); callers throw before any
 * write, so which one is reported first has no correctness consequence. */
export function detectMergeConflicts(input: DetectMergeConflictsInput): MergeConflict | null {
  const { keepId, mergeIds, contactIdsWithLogin, emailOwners, steps } = input;
  const allIds = [keepId, ...mergeIds];
  const idSet = new Set(allIds);

  let loginCount = 0;
  for (const id of allIds) {
    if (contactIdsWithLogin.has(id)) loginCount++;
  }
  if (loginCount > 1) {
    return { code: "both_logins", message: MERGE_BOTH_LOGINS_MESSAGE };
  }

  for (const step of steps) {
    const owner = emailOwners.get(step.mergedEmail.toLowerCase());
    if (owner === undefined) continue; // no user row owns this email at all
    if (owner === null || !idSet.has(owner)) {
      return { code: "email_taken", message: MERGE_EMAIL_TAKEN_MESSAGE };
    }
  }

  return null;
}
