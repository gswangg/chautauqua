# task-w42-c — contacts-integrity adjudication @ 824aac9b

Adjudication-only lane (DEC-453 w42: FILE, NEVER FIX). No file under
`src/**`, `app/src/**`, `migrations/**`, or `package.json` was touched by
this task. Scope: adjudicate the two review-lens claims about contacts CRM
integrity named in the task brief, deciding CONFIRMED-DEFECT /
DELIBERATE-BY-DESIGN / RULED-NOT-A-DEFECT / STALE for each, with a quoted
file:line + minimal fix direction + named wave-43 owner for any
CONFIRMED-DEFECT (never implemented in this lane).

## CLAIM 1 — multi-id contact merge is non-atomic

**Read:** `mergeContacts` (src/server/repo/contacts/merge.ts:697-714):

```
export async function mergeContacts(db: Db, keepId: string, mergeIds: string[]): Promise<ContactRow> {
  const toMerge = Array.from(new Set(mergeIds)).filter((id) => id !== keepId);
  ...
  let survivor: ContactRow | undefined;
  for (const mergeId of toMerge) {
    survivor = await mergeOnePair(db, keepId, mergeId);
  }
  ...
}
```

`mergeOnePair` (:384-655) is not called inside any `db.transaction`, and
none is opened by the route (src/routes/api/contacts/merge.ts:33,
`await repo.mergeContacts(c.var.db, body.keepId, mergeIds)` — a plain
call, no wrapper). Each `mergeOnePair` invocation performs its own writes
in sequence — the `UPDATE contact` at :437-454, the participant/task
dedupe writes at :512-522/:551-553, the pipeline repoint/delete at
:581-589, the generic FK repoints at :596-616, the user-email cascade at
:622-625, the dismissal delete at :630, and — the operative one for this
claim — `DELETE FROM contact WHERE id = mergeId` at :650. These commit to
the D1/SQLite connection as they run (no deferred/pending transaction to
roll back), so by the time fold N (`mergeId` = `toMerge[N]`) begins, folds
0..N-1 have already deleted their `mergeId` contact rows and repointed
every FK.

`mergeOnePair`'s docstring (:355-383) states:

> (a) BEFORE any write, load both contacts' user rows; if both have a
> login account, throw a conflict (no partial merge — a merge that
> silently orphaned one login would be worse than refusing it).

and the two pre-checks that back this promise both live inside
`mergeOnePair`, each running fresh on every fold:

- (a) login-conflict, :390-403:
  ```
  const keepUserRows = await db.select(...).from(schema.user).where(eq(schema.user.contactId, keepId)).limit(1);
  const mergeUserRows = await db.select(...).from(schema.user).where(eq(schema.user.contactId, mergeId)).limit(1);
  if (keepUserRows.length > 0 && mergeUserRows.length > 0) {
    throw new ApiError("conflict", "Both contacts have a login account; remove one account before merging");
  }
  ```
- (b2) email-owned-by-another-account, :408-423:
  ```
  const owner = emailConflictRows[0];
  if (owner && emailConflictsWithOtherAccount(owner.contactId, keepId, mergeId)) {
    throw new ApiError("conflict", "That email already belongs to another account");
  }
  ```

Both are genuinely "no partial merge" **for that one pair**: if fold N
throws, fold N's own writes (steps (b)-(g)) never ran, because both
pre-checks execute before :437 (the first write). But `mergeContacts`'s
docstring (:697-702, "DEC-629: set-based merge... folds each remaining id
through mergeOnePair in order") makes no atomicity claim across the whole
`mergeIds` array, and the ROUTE-level guarantee an organiser actually
experiences — "select 4 duplicates, click Merge, get one result" — is
what breaks: a `keepId` + 4 `mergeIds` request that conflicts on the 3rd
id returns HTTP 409 to the organiser, but ids 1 and 2 are already merged
into `keepId` and permanently deleted (their contact rows, and — because
`mergeOnePair` runs `DELETE FROM contact` per fold, not per request —
there is no way to detect from the response alone that this happened).
The organiser sees a single "conflict" error for what looks like one
atomic operation, with no indication two of the four contacts already
merged.

**Could the pre-checks be hoisted ahead of the first mutation?** Yes, for
both:

- **Login conflict.** By induction on the fold: entering fold `i`,
  `keepRow`'s accumulated login state equals "has a login" iff any of
  `{keepId, toMerge[0], ..., toMerge[i-1]}` had one AND no earlier fold
  threw (because fold `i-1`'s generic FK repoint, :604-605, moves
  `toMerge[i-1]`'s user row's `contactId` onto `keepId` whenever
  `toMerge[i-1]` had one and `keepId` didn't). So `mergeOnePair` throws
  the login conflict at fold `i` exactly when `toMerge[i]` has a login AND
  at least one of `{keepId, toMerge[0..i-1]}` already did — which means:
  if **two or more** of `{keepId, ...mergeIds}` have logins, the fold is
  GUARANTEED to throw at the first such collision, no matter where in the
  order it falls. This is equivalent to one up-front check: fetch all
  `user` rows for `{keepId, ...mergeIds}` in one query and refuse if more
  than one of those ids has a login — this can run before any write.
- **Email conflict.** `previewMerge`/`planMerge`
  (src/domain/contacts-parts/merge.ts:37-, :187-) already compute the
  exact same left-fold (`survivor = primary; for (duplicate of
  duplicates) { survivor = planMerge(survivor, duplicate).merged }`) as
  PURE functions with zero DB writes — this is precisely what the
  `GET /contacts/merge/preview` route already uses
  (src/routes/api/contacts/merge.ts:65-68) to show the "N submissions and
  M tasks move" preview without writing anything. Running that same fold
  once, up front, over `{keepId, ...mergeIds}`'s full contact records
  yields the FINAL `merged.email` without any writes; checking that email
  against the `user` table (excluding owners in the whole
  `{keepId, ...mergeIds}` set, not just one pair) once, before any write,
  is equivalent to today's per-fold check but runs before fold 0 begins.

**Verdict: CONFIRMED-DEFECT.** The docstring's "no partial merge"
guarantee is real but scoped to a single pair, and the caller-visible
contract (one Merge action over N duplicates) is not atomic — a mid-fold
conflict leaves earlier folds' merges and deletes committed while
returning a single failure to the organiser. Both blocking pre-checks are
provably hoistable to before the first write, using code the repo already
has (the `previewMerge`/`planMerge` pure fold).

**Fix direction (NOT implemented, per DEC-453 frozen-wave scope):** in
`mergeContacts` (merge.ts:703), before the `for` loop: (1) load
`{keepId, ...toMerge}`'s contact + user rows in one batch, (2) run the
pure `planMerge` fold (mirroring `previewMerge`) to compute the final
`merged` record without writing, (3) run the login-count check and the
email-conflict check (extended to exclude the WHOLE id set, not just one
pair) against that precomputed state, throwing before any write if either
fails, (4) only then run the existing per-fold write loop (which can keep
its own defensive re-checks as belt-and-suspenders, but the route-visible
contract no longer depends on them for atomicity). **Named wave-43
owner:** task-w43 contacts-merge-atomicity lane.

## CLAIM 2 — `deleteContact` leaves `email_log.contact_id` dangling

**Read:** `deleteContact` (src/server/repo/contacts/crud.ts:285-302) clears
`pipeline_activity`, `pipeline_entry`, `task_assignment`, and duplicate
dismissals, then `DELETE FROM contact`, and indeed never touches
`email_log`. Contrast with `mergeOnePair`'s generic FK repoint
(merge.ts:602-603):
```
} else if (op.table === "email_log") {
  await db.update(schema.emailLog).set({ contactId: op.to }).where(eq(schema.emailLog.contactId, op.from));
```
— the merge path treats `email_log.contactId` as a maintained FK; the
delete path does not.

**Is `email_log.contact_id` nullable?** Yes — src/db/schema/email.ts:31:
`contactId: text("contact_id"),` with no `.notNull()`. So a dangling
reference cannot itself violate a NOT NULL/FK constraint (D1/SQLite here
has no enforced foreign key on this column either — see
`buildMergeRepointOps`'s CONTACT_FK_TABLES, which is exactly the list of
columns the codebase itself treats as FK-shaped, contra any DB-level
enforcement).

**Enumerated every reader of `schema.emailLog.contactId`** (grep across
src/server/repo/** and src/routes/**):

1. `src/server/repo/email.ts:135` (`SELECTED_COLUMNS`) — passthrough
   column on `getEmailLogById`, used only by
   `GET /api/v1/events/:eventId/email-log/:emailId`
   (src/routes/comms/email-log.ts:26-42). The response includes raw
   `contactId: string | null`, but the audit view's rendered recipient is
   `toEmail` (an inline snapshot, DEC-006) — nothing in that route joins
   `contactId` back to `contact` for display. A dangling id here is
   inert: the same shape as a row that was always `contactId: null`.
2. `src/server/repo/email.ts:157` (`emailLogConditions`) — `contactId` is
   used ONLY as an optional caller-supplied WHERE filter
   (`?contactId=<id>`) for `GET /api/v1/events/:eventId/email-log`
   (src/routes/api/email-log.ts:36-91). This is a query parameter a
   caller must already know; there is no UI surface that could supply a
   deleted contact's id here (the contact's own drawer, the only place
   that links into this filter, no longer exists once the contact is
   deleted). Filtering by a dangling id simply returns rows whose
   `contact_id` still equals that id — correct rows, correctly matched,
   never "silently dropped."
3. `src/server/repo/contacts/history.ts:103,114` — filters by
   `contactId` = the contact whose OWN drawer is currently open, i.e. a
   still-live contact. This reader can never be invoked with a deleted
   contact's id (there is no drawer to invoke it from), so a different
   contact's `deleteContact` call cannot affect it.
4. `src/server/repo/submissions/history.ts:74` —
   `INNER JOIN schema.participant ON eq(schema.emailLog.contactId,
   schema.participant.contactId)`, filtered to
   `participant.submissionId = <this submission>`. This is the one join
   that COULD, in principle, "silently drop a row" if `email_log`'s
   `contact_id` pointed at a contact who used to be a participant on this
   submission but no longer is. But DEC-979 (this same decision, base
   text) already makes ANY `participant` row a hard refusal on
   `deleteContact` — `listContactReferenceRows`
   (src/server/repo/contacts/crud.ts:204-219) scans `participant` with NO
   submission scoping (i.e. across every submission the contact has ever
   participated in), and the route refuses the whole delete if that scan
   finds even one row. So the INNER JOIN's premise — an `email_log` row
   whose `contact_id` is dangling (contact deleted) while a matching
   `participant` row for the SAME contact still exists — is unreachable:
   deleting a contact who has any live `participant` row is refused
   before it happens, full stop. The join is therefore safe by
   construction, not by luck.

No reader path breaks, silently drops rows it shouldn't, or renders an
unresolvable recipient. The one plausible collision (submissions/history's
INNER JOIN) is provably guarded by this same DEC's existing refusal-class
rule.

**Does DEC-979's refusal-class reasoning intend history rows to survive
their contact?** Yes, by direct analogy: DEC-979's base text already rules
that `task_assignment` and `pipeline_entry` are "JOIN rows, not
documents" whose "content lives elsewhere" and therefore may cascade-
delete with the contact, while a `participant` row is kept as a refusal
class specifically because a submission would otherwise lose an author (a
real information loss). `email_log` sits on the OTHER side of that same
line from `task_assignment`/`pipeline_entry`: it is not a JOIN row that
cascades away — DEC-006 already establishes that every `email_log` row is
"full rendered content inline" (subject/body/ics/to_email), i.e. it IS a
document, a self-contained one that owns its own content. Deleting the
contact does not delete the email; the email's `contact_id` becoming
stale is exactly the same shape as `to_email` staying valid after a
contact's email address later changes — the log is a point-in-time
snapshot, not a live reference.

**Verdict: DELIBERATE-BY-DESIGN**, formalized as a new
`## Amendment (wave 42)` on decisions/DEC-979.md (this task added it —
see that file for the full ruling text). No product code was changed; no
fix is warranted given the enumerated reader set. If a future feature
adds a NEW reader that joins `email_log` to `contact` for DISPLAY
(distinct from filtering by a live, currently-open contact's id — the
only pattern every existing reader uses today), that feature owns
handling the missing-contact case (e.g. `leftJoin` + a "(deleted
contact)" fallback label), not `deleteContact`.

## Summary

| Claim | Verdict | Product code changed |
|---|---|---|
| 1 — merge non-atomicity | CONFIRMED-DEFECT (wave-43 owner: task-w43 contacts-merge-atomicity) | No |
| 2 — dangling email_log.contact_id | DELIBERATE-BY-DESIGN (DEC-979 Amendment, wave 42) | No |

RESULT: PASS — both claims adjudicated per DEC-453's FILE-NEVER-FIX scope.
OPEN ITEMS: 1 (claim 1, CONFIRMED-DEFECT, owned by task-w43).
