## 2026-08-15 task-w42-c — contacts-integrity adjudication @ 824aac9b

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Adjudication-only lane (DEC-453/DEC-358/DEC-099/DEC-068 w42): FILE, NEVER
FIX. Two review-lens claims about contacts CRM integrity, both read
against the code, no product code touched.

CLAIM 1 (multi-id contact merge non-atomicity) — CONFIRMED-DEFECT.
`mergeContacts` (src/server/repo/contacts/merge.ts:703-714) folds each id
in `mergeIds` through `mergeOnePair` sequentially; each fold's writes
(steps (b)-(g), :437-650) commit to the DB — including the `DELETE FROM
contact` at :650 — before the next fold's `mergeOnePair` call begins.
`mergeOnePair`'s own docstring (:355-383) advertises "no partial merge",
but that guarantee is per-pair only: the login-conflict pre-check (:401-403)
and the email-owned-by-another-account pre-check (:414-423) both run
inside `mergeOnePair`, meaning a conflict thrown on fold N (of an
`N`-id merge request) is thrown AFTER folds 1..N-1 have already merged
and irreversibly deleted their contact rows, contradicting the
docstring's guarantee for any request with more than one `mergeIds`
entry. There is no `db.transaction` wrapping the loop in
src/routes/api/contacts/merge.ts:33 or in `mergeContacts` itself.
Verified both pre-checks CAN be hoisted ahead of the first write: (a) the
login-conflict check is equivalent, across the whole fold, to "at most one
of {keepId, ...mergeIds} may currently own a login" (by induction on the
fold: `mergeOnePair` only throws when a login-having merge id meets a
keep-side that has already accumulated a login from a prior fold, so >=2
login-owning ids in the full input set always throws at *some* fold if not
hoisted); this can be evaluated with one query over the full id set
before any write. (b) the final merged email is a pure function of the
whole ordered fold — `previewMerge`/`planMerge`
(src/domain/contacts-parts/merge.ts:37,187) already compute this fold
purely, with no DB writes — so the email-conflict pre-check can be
evaluated once against the fully-folded `merged.email` and the full id
set (extending `emailConflictsWithOtherAccount`'s exclusion list from
`{keepId, mergeId}` to the whole `{keepId, ...mergeIds}` set) before any
write begins.
Fix direction (NOT implemented): before the write loop in `mergeContacts`,
compute the full pure fold (reusing `previewMerge`'s planMerge chain) to
get the final merged email, fetch user-login rows for the whole id set in
one query, and run both pre-checks against that precomputed state; only
begin `mergeOnePair`'s writes once all pre-checks for the WHOLE request
pass. Named wave-43 owner: task-w43 contacts-merge-atomicity lane.

CLAIM 2 (`deleteContact` leaves `email_log.contact_id` dangling) —
DELIBERATE-BY-DESIGN, cf. DEC-979 (Amendment, wave 42). Enumerated every
reader of `schema.emailLog.contactId` under src/server/repo/** and
src/routes/**: none breaks, silently drops rows it shouldn't, or renders
an unresolvable recipient. `email_log.contact_id` is nullable
(src/db/schema/email.ts:31, no `.notNull()`); its recipient identity for
every current display path is the inline-snapshotted `to_email`
(DEC-006), never a join back to `contact`. `repo/submissions/history.ts`'s
INNER JOIN on `emailLog.contactId = participant.contactId` (:74) is
provably unreachable for a deleted contact because DEC-979 already keeps
any `participant` row a hard refusal on `deleteContact` — a contact with a
dangling `email_log` row can never simultaneously have a live
`participant` row for that join to match against. Full reasoning and the
binding ruling are recorded in decisions/DEC-979.md's wave-42 amendment.
No fix needed; no product code changed.

RESULT: PASS — both claims adjudicated; one CONFIRMED-DEFECT filed (not
fixed, per DEC-453 frozen-wave scope) with a named wave-43 owner, one
ruled DELIBERATE-BY-DESIGN and recorded as a DEC-979 amendment.

Full detail: docs/verification-log/task-w42-c-contacts-integrity-adjudication-824aac9b.md.

OPEN ITEMS: 1
