# 2026-08-10 task-w15-j — spec-audit @ 675219f

Full detail for the `## 2026-08-10 task-w15-j — spec-audit @ 675219f` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

DEC-069 scope-4 spec-audit gate (SPEC §8/§9 static audit plus §2/§6
invariants), log-only lane per DEC-077/DEC-127: the only file this task
modifies is this log.

**(1) Sha re-derivation (DEC-114/DEC-091).** `main` tip at branch time is
`21ea856` ("scribe wave 15"); its first-parent diff against `675219f`
touches only `decisions/DEC-127.md`, `field-guide/index.md`, and
`src/decisions.ts` (a single pure string-constant append, `export const
DEC_127 = "..."`) — every path is in the DEC-114 bookkeeping-exclusion
set, so `21ea856` is not code-bearing. Its parent `675219f` ("merge
task-w14-k") is a merge whose first-parent-diff set includes
`src/routes/tasks.ts`, `src/server/repo/portal-edit.ts`,
`src/routes/portal/edit.tsx`, `src/routes/comms.ts`, `src/routes/review.ts`,
`src/forms/validate.ts`, `scripts/perf-seed.ts`, and their test files —
all outside the exclusion set, so `675219f` is code-bearing and is the
newest code-bearing sha, matching DEC-127's expectation ("675219f or
later"). Six-marker preflight run against the worktree tree (which sits
on `675219f`, no code-bearing commits since): all six markers present —
`src/routes/tasks.ts` DEC-120 block (line 16 import, line 38 `void
DEC_120`, lines 235-247 cross-org reject), `src/server/repo/portal-edit.ts`
`LOCKED_SPEAKER_FIELDS` prefill (line 16 import, lines 123-125), `src/
routes/comms.ts` `requireFullMatch` (line 30 def, lines 303 & 337 call
sites), `src/routes/review.ts` DEC-123 conflict guard (line 29 import,
line 32 `void DEC_123`, lines 224-238 immutability check), `src/forms/
validate.ts` `MAX_TEXT_LENGTH` (lines 3-9 import/const, lines 59-61 cap
enforcement), `scripts/perf-seed.ts` `kind: "rating"` (line 273). All six
confirmed present — no PASS would be valid against a tree missing any of
them, and none is missing.

**(2) Re-run of the task-w11-e checklist structure against SPEC.md/docs/
at `675219f`.** The seven items task-w11-e re-verified (DEC-108 invite
gate, DEC-109 file carry-over, DEC-110 rules-JSON escaping, DEC-111
backing-form self-heal, DEC-099 pubcache headers, DEC-100 atomic seq,
DEC-101 six-FK merge) are untouched by any wave-12..14 commit (none of
those source files appear in any wave-12/13/14 commit's diff — confirmed
via `git log --format=%H -- src/server/repo/public.ts src/views/
form-render.tsx src/server/repo/submissions/status.ts src/domain/
acceptance.ts src/server/pubcache.ts src/server/repo/submissions/seq.ts
src/server/repo/contacts.ts` between `3b7ed3d` and `675219f`, which
returns zero hits), so task-w11-e's `RESULT: PASS` for those seven items
stands unchanged and is not re-derived line-by-line here (spot-check in
(3) instead, per this task's brief). No new SPEC §8/§9 drift found:
public-visibility filtering (§9), no-IDOR object-level checks (§6),
communications-deliberate (§2 principle 4), and the pure-core boundary
(§2/DEC-002) all remain consistent with the tree at `675219f`.

**(3) Five wave-14 defect closures — file:line + test-file evidence,
independently re-read at `675219f`:**

- **SPEC §6 no-IDOR, task assign (DEC-120).** `src/routes/tasks.ts:235-247`:
  after the existing ownership/org check (line 230), the handler dedupes
  `contactIds`, calls `findContactsForOrg(db, dedupedContactIds,
  auth.orgId)`, and rejects with 400 `invalid` (`One or more contacts do
  not belong to this org`) if any requested id is not returned —
  atomic, no partial assignment. `test/tasks-assign-org-scope.test.ts`
  (3 tests) run green in isolation: cross-org contact ids rejected,
  same-org ids succeed. Confirmed closed.

- **J2/J7 portal-edit locked speaker fields, read-only email (DEC-121).**
  Prefill: `src/server/repo/portal-edit.ts:123-125` sets
  `answers[LOCKED_SPEAKER_FIELDS[0..2]]` from `contact.firstName/
  lastName/email`, never from `submission_answer`. Sync-back:
  `src/server/repo/portal-edit.ts:184-192` writes edited first/last name
  to the `contact` row (email intentionally excluded from the sync). Form
  read path: `src/routes/portal/edit.tsx:74-84` refuses to read a
  body-supplied `field__email` value, always carrying over the stored
  (contact-sourced) answer instead. Render path:
  `src/routes/portal/edit.tsx:155-167` renders every locked field except
  email through the normal editable `FormFieldsSection`, then renders the
  email field separately as plain read-only text
  (`Email: {...} (read-only)`). `test/portal-edit-speaker-locked.test.ts`
  (5 tests) and `test/portal-edit-speaker-locked-route.test.ts` (3 tests)
  run green. Confirmed closed.

- **DEC-019 no-silent-skips, compose full-set match (DEC-122).**
  `src/routes/comms.ts:302-305` (preview) and `:336-339` (send): both
  call `requireFullMatch(input.submissionIds, submissions)` immediately
  after `loadComposeSubmissions`, strictly before `preflightIcsSchedule`
  runs — an id silently dropped by the (event-scoped) load can no longer
  reach the ics/merge-field preflights un-flagged. `test/
  compose-full-set.test.ts` (6 tests) run green, including a 400 on a
  nonexistent submission id for preview. Confirmed closed on both
  endpoints.

- **Plan criteria/scale immutability after evaluations exist (DEC-123).**
  `src/routes/review.ts:224-238`: once `body.criteria !== undefined ||
  body.scale !== undefined` and `planHasEvaluations(db, plan.id)` is
  true, a criteria or scale value that is not `deepEqual` to the stored
  value throws `ApiError("conflict", ...)` (409); identical (no-op)
  PATCHes still pass through, so full-object admin-SPA PATCHes keep
  working. `test/plan-criteria-guard.test.ts` (7 tests) run green,
  including the 409-then-200-results regression case. Confirmed closed.

- **Server-side answer length caps (DEC-124).** `src/forms/validate.ts:8-9`
  defines `MAX_TEXT_LENGTH = 2000` / `MAX_LONG_TEXT_LENGTH = 20000`;
  `:59-61` enforces the kind-appropriate cap inside `validateAnswers`,
  erroring `Too long (max N characters)` before the value reaches
  `cleaned`. `test/answer-length-caps.test.ts` (10 tests) run green.
  Confirmed closed.

All 34 tests across these six test files pass in isolation
(`npx vitest run test/tasks-assign-org-scope.test.ts test/portal-edit-
speaker-locked.test.ts test/portal-edit-speaker-locked-route.test.ts
test/compose-full-set.test.ts test/plan-criteria-guard.test.ts
test/answer-length-caps.test.ts` — 6 files / 34 tests, 0 failures).

**(4) DEC-108..111 spot-check (unchanged since task-w11-e, re-confirmed
present at `675219f`):** `src/server/repo/public.ts:38,239` —
`inArray(schema.participant.inviteStatus, ["none", "accepted"])` present
at both the shared gate and the `hydrateSessions` speaker-hydration
query. `src/routes/portal/edit.tsx:63-70` (task-w11-e cited `61-65`;
content unchanged, line numbers shifted slightly by unrelated
intervening edits elsewhere in the file) — file-kind answers still
never read from `body`, stored answer still carried over verbatim. `src/views/
form-render.tsx:145,176-177` — `safeJson = json.replace(/</g,
"\\u003c")` still precedes the `dangerouslySetInnerHTML` embed; inline
`<script>` still static template content. `src/server/repo/submissions/
status.ts:78-82` (task-w11-e cited `78-82`; unchanged) — self-heal path
still calls `getOrCreateFormTaskForm` and updates the task row in place
when an existing 'form' task has a null `formId`. No drift from any of
the four.

No new SPEC violation found anywhere in this run — the five wave-14
defects are closed with matching code and passing tests, all six DEC-127
preflight markers are present, and the DEC-108..111 spot-check found no
regression.

RESULT: PASS
