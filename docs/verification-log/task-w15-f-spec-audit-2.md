# 2026-08-10 task-w15-f — spec-audit @ 1033d45

Full detail for the `## 2026-08-10 task-w15-f — spec-audit @ 1033d45` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

**Preconditions (DEC-196/DEC-114).** First-parent walk from `main`
(HEAD `4e5256e` "scribe wave 15") lands on `1033d45` "merge
task-w14-c" as the newest code-bearing commit: `4e5256e`'s own diff
touches only `decisions/DEC-196.md`, `field-guide/index.md`, and
`src/decisions.ts` (one pure append, `DEC_196`, plus a same-line
escape-sequence typo fix inside the already-bookkeeping `DEC_131`
string constant — no executable/application code changed), all
within DEC-114's bookkeeping exclusion set, so it is non-code-bearing
and `1033d45` stands as S'''' exactly as expected. `git merge-base
--is-ancestor 2dd2f33 1033d45` and `--is-ancestor 7f7477e 1033d45`
both exit 0. DEC-196 fix-marker preconditions all present at
`1033d45`: `DEC-191` comment + `contactId: null` in both
`src/routes/api/users.ts` and `src/routes/review.ts`;
`data-required` in `src/views/form-render.tsx`; `chunkSelection` and
`/tracks` in `app/src/pages/submissions/SubmissionsTable.tsx`;
`test/email-log-null-contact.test.ts`, `test/form-render-rules.test.ts`,
`app/src/pages/submissions/bulk.ts`, `app/src/pages/submissions/bulk.test.ts`
all present in `git ls-tree -r 1033d45 --name-only`, which lists
`.dev.vars.example` and does NOT list `.dev.vars`. No PASS section
citing `spec-audit @ 1033d45` pre-existed on main; this is a fresh
audit, not a citation.

**(1) Scope.** `git diff --stat 7f7477e..1033d45` (27 files changed,
1795 insertions, 47 deletions). Code-bearing paths beyond ledger/
decisions/field-guide/decisions.ts bookkeeping are exactly the three
declared w14 fix surfaces: `app/src/pages/submissions/SubmissionsTable.tsx`,
`app/src/pages/submissions/bulk.ts` + `bulk.test.ts`, and the related
render-test touch `app/src/pages/submissions/Submissions.render.test.tsx`;
`src/views/form-render.tsx` + `test/form-render-rules.test.ts`;
`src/routes/api/users.ts`, `src/routes/review.ts`, `src/mail/types.ts`
(null-contact handling) + `test/email-log-null-contact.test.ts`.
Nothing else appears in the diff. No line-by-line dispositioning
against SPEC.md/clarifications.md is required beyond the four DEC-
19x conformance checks below.

**(2) Fix conformance.**
- DEC-192 (tracks fetch, CFP-12 track triage) — `SubmissionsTable.tsx`
  adds a `useEffect` that calls `apiList<Track>(`/events/${eventId}/tracks`)`
  and populates the previously-empty `tracks` state (was
  `const [tracks] = useState<Track[]>([])`, permanently empty). Track
  filter is now backed by live data. CONFORMS.
- DEC-193 (chunking with stop-loudly + refetch, no silent rollback) —
  `bulk.ts` exports `BULK_STATUS_CHUNK_SIZE = 500` and pure
  `chunkSelection`, covered by 5 unit tests (empty, exact multiple,
  remainder, order-preservation, below-limit). `SubmissionsTable.tsx`
  `applyBulkStatus` iterates batches sequentially via `apiPost`,
  tracks `completed` count, and on failure no longer restores the
  pre-update snapshot (the old `setItems(previous)` silent-rollback
  path is deleted); instead it surfaces `Bulk status update failed
  after N of M batches: <message>` and bumps `refreshToken` to force
  a refetch of server truth. This is fail-loudly (house rule) rather
  than silent — a partial-success case now reports its extent instead
  of masking it behind a rollback. CONFORMS.
- DEC-194 (data-required vs DEC-008 script at form-render.tsx:167) —
  `FieldControl` now emits `data-required="true"/"false"` alongside
  `required` on all four required-capable controls (text, long_text,
  dropdown, number). The inline script at line ~167
  (`el.dataset.required`, confirmed via `input.dataset.required ===
  'true'` string in `FieldRulesScript`'s test) reads this exact
  dataset key; `test/form-render-rules.test.ts` adds coverage for
  required/optional/rule-gated-visible cases. Restores the DEC-008
  contract. CONFORMS.
- DEC-191 (contact-or-NULL email_log writes, J11 integrity) —
  `src/mail/types.ts` widens `RenderedEmail.contactId` and
  `EmailLogEntry.contactId` to `string | null`; `src/routes/api/users.ts`
  (new-user welcome email) and `src/routes/review.ts` (reviewer
  reminder) now pass `contactId: null` instead of a user id
  masquerading as a contact id. `migrations/0000_secret_matthew_murdock.sql`
  line 36 already declares `email_log.contact_id` as nullable
  (`text`, no `NOT NULL`) — no migration needed, matching DEC-191's
  binding. `git diff 7f7477e..1033d45` touches no file under
  `src/server/repo/contacts.ts` or `migrations/`, confirming no
  contact-merge/filter code needed to change; `test/email-log-null-
  contact.test.ts` (177 lines, new) exercises the null-contact write
  path end to end. CONFORMS.

**(3) Standing anchor re-confirmation.** `task-w12-f — spec-audit @
7f7477e` §8/§9 anchors re-grepped at `1033d45`: `formatCell` in
`src/lib/csv.ts`, `peekScopedLimit`/`incrementScopedLimit`/
`resetScopedLimit` in `src/lib/rate-limit.ts`, `csrfFormOrHeader` in
`src/server/middleware.ts`, `parseBoundedIdArray` in
`src/server/http.ts` all present and unchanged by the w14 diff (none
of those files appear in `git diff --stat 7f7477e..1033d45`). Anchors
hold.

**(4) Secrets.** `git diff 7f7477e..1033d45 | grep -i` for token/key/
password patterns turns up only historical prose mentions of the
string `AIRTABLE_TOKEN` inside DEC-190's narrative text (no value, no
`.dev.vars` diff hunk). `.dev.vars` was not read or printed.
`git ls-tree -r 1033d45 --name-only` lists `.dev.vars.example` and no
`.dev.vars`. Zero secrets confirmed.

**OPEN ITEMS: 0**

**RESULT: PASS**
