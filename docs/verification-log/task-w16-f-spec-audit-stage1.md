# task-w16-f — STAGE-1 COMPLETION LEDGER (DEC-438, DEC-446, DEC-447)

`git rev-parse HEAD` = **S = 235d67799814580fafde386f87fb0aea7ea9f02c**
("merge task-w16-a"), branch `task-w16-f`, cut fresh from `main` at that
commit. This is the sha personally re-read for every citation below. No
verdict is inherited from `docs/verification-log/task-w15-f-spec-audit-
stage1.md` or `task-w14-h-spec-audit-stage1.md` — those are used only as a
map of file locations, per instruction. Per DEC-447, this is the first
ledger of this chain whose audited sha S contains this wave's own (and
only) source change: `38c87c1` "Fix last WCAG AA contrast offender, flip
CONTRAST_BLOCKING (DEC-444/445)" (task-w16-a) is an ancestor of S.

(Note: `task-w16-d-spec-audit.md` already exists in this directory —
belongs to a different, parallel campaign numbering (sha `7ac6aef`,
DEC-077 lineage) — confirmed present, untouched, not read for verdicts,
per the task's explicit instruction. The `-stage1` suffix on this file is
mandatory to avoid colliding with it.)

## Build/test at S

- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
  vite build --config app/vite.config.ts`): **PASS**, 0 type errors, 155
  modules transformed. Main SPA entry `index-DyWSxcKX.js` 183.82 kB / gzip
  59.96 kB.
- `npm test --silent`: **PASS — 278 test files / 2304 tests**, 0 failures,
  0 skipped.
- Also ran the SPEC §9 unit-invariant files directly (see §5 below):
  `npx vitest run test/spec9-invariants.test.ts test/edit-lock.test.ts
  test/task-file-access.test.ts test/headshot-gate.test.ts` → **4 files /
  33 tests, all PASS**.

Log-only lane (DEC-438/DEC-447): no source file changed by this task;
only this file is written.

---

## (1) J1–J12 (SPEC.md:95–181)

| Job | Status | Citation |
|---|---|---|
| J1 | VERIFIED | `src/db/schema.ts` `event_slug_idx`; `src/routes/public/submit.tsx` mounts `GET /submit/:eventSlug`, no auth middleware; conditional field visibility `src/forms/visibility.ts` |
| J2 | VERIFIED | Draft/submit handlers `src/routes/public/submit.tsx`; required-field gating `src/forms/validate.ts`; edit-lock `src/domain/edit-lock.ts:11`; confirmation email dispatch in the same submit route |
| J3 | VERIFIED | Saved views `src/routes/api/views.ts`; bulk status `src/routes/api/submissions.ts`; five-literal status set `src/domain/status.ts:5-17` (unchanged, re-read at S) |
| J4 | VERIFIED | Plan config `src/routes/review/plans.ts`; fewest-ratings-first `src/domain/evaluation.ts:334` `buildReviewerQueue`; reviewer-scoped queue load `src/server/repo/review/submissions.ts:126` `resolveReviewerSubmissions` (DEC-439, re-verified below) |
| J5 | VERIFIED (incl. bonus) | Decision≠email `test/spec9-invariants.test.ts:58-69` (ran directly, PASS); 100-cap `src/domain/compose.ts`; feedback-attach `src/routes/comms.ts` |
| J6 | VERIFIED | Exactly-once acceptance trigger `src/server/repo/submissions/status.ts`; default onboarding tasks `src/domain/acceptance.ts` `DEFAULT_ONBOARDING_TASKS` |
| J7 | VERIFIED | Portal shell `src/routes/portal/index.tsx`; one-record-two-views `src/routes/portal/profile.tsx`; cross-account IDOR `test/task-file-access.test.ts` (ran directly, PASS) |
| J8 | VERIFIED | Version chain `previous_file_id` in `src/db/schema.ts`; content-approval gate `src/server/repo/public/gates.ts`; upload allowlist `src/domain/files.ts` |
| J9 | VERIFIED | Conflicts surfaced-not-blocking + auto-schedule `src/domain/schedule.ts`; drag placement `app/src/pages/Agenda.tsx` |
| J10 | VERIFIED | Five public surfaces `src/routes/public/index.tsx`; `.ics` export `src/routes/public/feeds.ts`; three-gate visibility `src/server/repo/public/gates.ts`; embed generator `app/src/pages/settings/EmbedsPanel.tsx`; request-shaped cache skip `src/server/pubcache.ts:78-81` (DEC-442, re-verified below) |
| J11 | VERIFIED | Contact directory `src/server/repo/contacts.ts`; CSV import `src/lib/csv.ts`; merge integrity `test/contacts-merge-integrity.test.ts`; same three-gate ladder as J10 |
| J12 | VERIFIED | Exports `src/routes/api/exports.ts` incl. `showflow.csv` (SPEC §10 #7); bearer tokens `src/routes/api/tokens.ts`; Airtable one-way sync `src/sync/airtable.ts` (SPEC §10 #5) |

No J-row is a GAP at S.

---

## (2) SPEC §5 invariants (SPEC.md:290–303)

| Invariant | Status | Citation |
|---|---|---|
| Status pipeline literal set (`pending → accept_queue\|decline_queue → accepted\|declined`) | VERIFIED | `src/domain/status.ts:5-17`, `SUBMISSION_STATUSES` — exactly five literals, unchanged since DEC-003 |
| Status changes never send email | VERIFIED | `src/domain/status.ts:1-3` module header asserts zero mailer references; `test/spec9-invariants.test.ts:58-69` proves `updateSubmissionStatuses`'s write path never touches `schema.emailLog` (ran directly, PASS) |
| Contact→participant→public three-gate ladder never collapsed | VERIFIED | `src/server/repo/public/gates.ts` — distinct `visibleSessionConditions`/`visibleParticipantConditions`/`visibleSubmissionConditions`, ANDed only at point of use; per-event record prefixes `src/domain/ids.ts:23` `formatRef` |
| `close_date` past ⇒ new submissions rejected + unaccepted-speaker edits locked; accepted keep editing | VERIFIED | `src/routes/public/submit.tsx` close-date checks; `src/domain/edit-lock.ts:11`; `test/edit-lock.test.ts` (ran directly, PASS: pending+closed not editable, accepted+closed editable) |
| Acceptance auto-creation fires exactly once, idempotently | VERIFIED | `src/server/repo/submissions/status.ts` |
| Stable IDs / per-event record prefixes / `.ics` UIDs never churn | VERIFIED | `src/domain/ids.ts:23` `formatRef`; `.ics` UID stability `src/mail/ics.ts` |
| Files: `previous_file_id` chains, full history | VERIFIED | `src/db/schema.ts` |

---

## (3) SPEC §6 (SPEC.md:306–320)

Per DEC-428, SPEC.md:308's ">=600k" is amended to "100k" — code and spec
agree.

| Item | Status | Citation |
|---|---|---|
| PBKDF2-SHA256 100k, constant-time, session rotation | VERIFIED | `src/auth/password.ts:16` `ITERATIONS = 100_000`, used at `:52,64` |
| CSRF custom-header/token | VERIFIED | `src/server/middleware.ts:243-249` `x-chq-csrf` header on JSON mutations |
| Authz + object-level ownership | VERIFIED | role/event-grant middleware `src/server/middleware.ts`; IDOR case `test/task-file-access.test.ts` |
| Server-side filtering, never CSS-hidden | VERIFIED | `src/server/repo/public/gates.ts` |
| Uploads: allowlist/caps/random keys, no HTML content-type served | VERIFIED | `src/domain/files.ts` |
| Parameterized queries only (Drizzle) | VERIFIED | Drizzle usage repo-wide; no raw string SQL interpolation found under `src/server/repo/` |
| Rate limits on auth + public submission | VERIFIED | `checkAndIncrementScopedLimit` in `src/routes/public/submit.tsx` |
| Public submission validates server-side against form schema | VERIFIED | `src/forms/validate.ts`, invoked pre-persistence |

---

## (4) SPEC §7/§8 (SPEC.md:322–368)

| Item | Status | Citation |
|---|---|---|
| Admin API reads p95<50ms / writes<100ms, CI-enforced | VERIFIED (mechanism) | `scripts/perf-smoke-lib.ts` `PERF_CLASS_BUDGET_MS`; `test/perf-smoke.test.ts`. The two prior open items (reviewer-queue whole-plan load, results-endpoint compute-then-slice) are closed — see §6 below (DEC-439/DEC-440 re-verified in code) |
| One round trip per view | VERIFIED | `src/routes/api/overview.ts` single joined payload |
| Public pages Cache-Control+SWR, purge on write; bare `schedule.ics` joins the cache | VERIFIED | `src/server/pubcache.ts:78-81` `isUncacheableIcsRequest(url)` = `pathname.endsWith("/schedule.ics") && searchParams.has("ids")` — request-shaped, only an `?ids=`-carrying request skips cache (DEC-442) |
| Public `?page=`/row-LIMIT bounds (DEC-433) | VERIFIED | `src/routes/public/query.ts` `MAX_PUBLIC_PAGE = 50` clamp; `src/server/repo/public/bounds.ts` `MAX_PUBLIC_ROWS = 600`, `boundedRowLimit` asserts finite ints ≥1, throws otherwise |
| High-frequency actions optimistic + loud rollback | VERIFIED (mechanism) | `app/src/pages/Agenda.tsx` |
| D1 indexes on every FK + (event_id,status) + (event_id,slug) | VERIFIED | `src/db/schema.ts` index definitions; `test/schema-fk-indexes.test.ts` |
| Server pagination + filtering; thumbnailed headshots w/ cache headers | VERIFIED | `test/pagination.test.ts`; `src/routes/portal/profile.tsx` |
| SPA code-split by route, initial bundle <300KB gz | VERIFIED | `scripts/bundle-check-lib.ts` `BUDGET_BYTES = 300*1024`; this build's `index-DyWSxcKX.js` 59.96 kB gz |
| CI perf smoke against 2k-row seed | VERIFIED | `.github/workflows/ci.yml` perf-smoke job; `scripts/perf-seed.ts` |
| §8 quickstart (`npm i && db:migrate && seed && dev`, zero-setup) | VERIFIED | `package.json` `predev`: `tsx scripts/ensure-dev-vars.ts && vite build ...`; `dev`: `wrangler dev`. `npm run dev` is the sole zero-setup entrypoint (DEC-448) |
| §8 seed doubles as grader package, README lists creds | VERIFIED | `README.md` "For evaluators" section (`:135-`) |
| §8 GitHub public repo MIT, CI typecheck+unit tests | VERIFIED | `LICENSE`; CI build-and-test job |
| §8 `npm run deploy` | STAGE-2, correctly absent | no `"deploy"` script in `package.json` (checked `dev/build/db:migrate/seed` keys only, no `deploy`), per SPEC.md:59-63 |

---

## (5) SPEC §9 four unit invariants (SPEC.md:381–383) — run directly

```
npx vitest run test/spec9-invariants.test.ts test/edit-lock.test.ts \
  test/task-file-access.test.ts test/headshot-gate.test.ts
```

| Invariant | Test file | Result |
|---|---|---|
| Close-date lock | `test/edit-lock.test.ts` | 9/9 PASS (pending+closed not editable; accepted+closed editable) |
| Speaker isolation (cross-account IDOR) | `test/task-file-access.test.ts` | 16/16 PASS, incl. "403s for another speaker (IDOR)" |
| Hidden-speaker exclusion | `test/headshot-gate.test.ts` | 7/7 PASS, incl. "404s unauthenticated when the speaker isn't publicly visible (pending/hidden)" |
| Decision ≠ email | `test/spec9-invariants.test.ts` | 1/1 PASS (`updateSubmissionStatuses` never touches `schema.emailLog`) |

4 files / 33 tests, all PASS at S.

---

## (6) Wave 15 landings, re-verified in code at S (not assumed)

1. **DEC-439 — reviewer-queue scoping.** `src/server/repo/review/
   submissions.ts:126-135` `resolveReviewerSubmissions`: loads only this
   `(plan, userId)`'s `plan_reviewer` rows first (`reviewerRows`), then
   issues one scoped `submission` query — cost scales with the reviewer's
   own slice, never the whole plan (doc comment at `:115-125` states this
   explicitly). `src/routes/review/shared.ts:259`: `const submissions =
   await repo.listPlanFilteredSubmissions(c.var.db, plan, { withTrackIds:
   false });` inside `buildResults` — confirmed present, with the doc
   comment directly above it at `:257-258` citing DEC-439/DEC-440 by name
   ("buildResults never reads trackIds, so skip the second whole-event
   submission_track scan"). VERIFIED, both landings hold.
2. **DEC-440 — aggregation stays in JS, throws on missing score.**
   `src/domain/evaluation.ts:78` `aggregateSubmission` throws at `:105-107`
   (`` `aggregateSubmission: missing score for criterion "${criterion.id}"` ``)
   when a criterion has no score; `:251` `aggregateDropdownCriterion` throws
   at `:263-265` and `:268-270` for a missing/non-string score or an
   out-of-options value. `grep -n "AVG\|GROUP BY" src/server/repo/review/`
   returns no matches — no SQL aggregation replaces these. VERIFIED, still
   a throwing invariant, not laundered into SQL.
3. **DEC-441 — SPEC §10 #3 shipped.** `src/routes/tasks.ts:446`
   `POST /api/v1/events/:eventId/onboarding/remind` (send) and `:465`
   `POST .../remind/preview` (preview) both exist; the preview route's
   comment at `:463-464` states it renders "what 'remind now' would send,
   rendered from the same buildReminderMessage" as the send path.
   `src/server/repo/tasks/reminders.ts:83` `buildReminderMessage`, called
   from both the send path (`:128`) and the preview path (`:238`) — one
   shared builder, not two divergent renderers. `test/reminder-drafts.
   test.ts` exists and exercises both routes (16 tests, ran as part of the
   full suite at S). VERIFIED.
4. **DEC-442 — pubcache request-shaped ics skip.** `src/server/pubcache.
   ts:78-81`: `export function isUncacheableIcsRequest(url: string):
   boolean { const parsed = new URL(url); return parsed.pathname.endsWith
   ("/schedule.ics") && parsed.searchParams.has("ids"); }`, consumed at
   `:136`. Only a `schedule.ics` request carrying `?ids=` skips the cache;
   a bare `schedule.ics` now joins the public edge cache. VERIFIED,
   request-shaped not path-shaped.

All four wave-15 landings hold at S; none regressed.

---

## (7) Wave 16's own fix — DEC-444/DEC-445 re-verified at S

`scripts/render-sweep-contrast.ts:25`: `export const CONTRAST_BLOCKING =
true;` — the flip fired, an ancestor commit (`38c87c1`, in this ledger's
own history per DEC-447) since the comment above it (`:14-24`) states this
lane's own render-sweep run read 42/42 all-PASS after the DEC-444
re-point. `test/render-sweep-contrast.test.ts:97-99`: `it("flip rule:
CONTRAST_BLOCKING flips true once a run reads all-PASS (DEC-444/DEC-445)",
() => { expect(CONTRAST_BLOCKING).toBe(true); });` — the flipping lane
(task-w16-a) owns the old-value ("starts false") test replacement, per
DEC-436's rule, confirmed correctly done (no stray `.toBe(false)`
assertion remains — `grep -n "CONTRAST_BLOCKING" test/render-sweep-
contrast.test.ts` shows only the import and this one `.toBe(true)`
assertion).

The two re-pointed declaration sites, re-read directly:
- `app/src/styles.css:1147-1149`: `.chq-forms-field-locked { color:
  var(--chq-muted); }`.
- `app/src/pages/forms/forms.css:130-132`: `.chq-forms-settings-title {
  color: var(--chq-muted); }`.
- `--chq-disabled` itself unchanged: `app/src/styles.css:30` `--chq-
  disabled: #8e8a7a;` — still frozen, still WCAG-exempt for genuinely
  disabled controls, per DEC-430/DEC-444 (remedies change pixels, never
  the instrument).

`docs/verification-log/task-w16-a-build-test-stage1.md` (read in full):
records `npm run build` PASS, `npm test` 278/2304 PASS, `npm run
bundle:check` PASS (62.07 kB gzip vs 300 kB budget), and `npm run
gate:render-sweep` exit 0 with the full 42/42 desktop-route table showing
every route (including `/admin/submissions/forms`) at ratio ≥5.95, well
above the 4.5:1 AA floor — the prior 3.06 offender now reads 6.28. The log
ends `RESULT: PASS`, self-consistent with the code state re-read above.

CONFIRMED: DEC-445's flip fired correctly, in this lane's ancestor
history, per DEC-447's designed ordering.

---

## Wave 16's log-only lanes (task-w16-b/c/d/e) — noted per DEC-447, not scored as PENDING-OWNED

Per DEC-447/DEC-438, this wave's log-only lanes own no SPEC item — listed
here only to record which logs exist at S and what they said, never as
PENDING-OWNED regardless of merge state.

- `docs/verification-log/task-w16-b-walkthrough-confirm.md` and
  `task-w16-b-walkthrough.md` — both present at S. These belong to a
  distinct campaign lineage cut at a different sha (`7ac6aef`/`675219f`,
  DEC-114/127/128 numbering, not this ledger's DEC-438/446/447 chain).
  Both end `RESULT: PASS`.
- `task-w16-c-perf-smoke.md`, `-confirm.md`, `-2.md` — present at S, same
  other-campaign lineage, all end `RESULT: PASS` (p95 well under budget,
  e.g. submissions list 10.7ms vs 150ms budget in that campaign's numbers).
- `task-w16-d-spec-audit.md`, `-confirm.md` — present at S, same other
  lineage, both `RESULT: PASS`. (This is the file the task instructions
  warn is already owned by "campaign 1" — confirmed present, not read for
  verdicts in this ledger, only its existence and `RESULT` noted here.)
- `task-w16-e-triage-closure.md`, `-confirm.md` — present at S, same other
  lineage, `OPEN ITEMS: 0`, `RESULT: PASS`.

These files do not correspond to task-w16-b/c/d/e as dispatched in *this*
wave's chain (this wave's b/c/d/e are log-only lanes per DEC-447 in the
DEC-438/446/447 numbering); they are pre-existing artifacts from a
parallel campaign that happen to share the `task-w16-*` naming prefix and
were already on `main` before this branch was cut. Nothing in them
contradicts this ledger's findings; none is treated as PENDING-OWNED.

---

## (8) SPEC §10 (SPEC.md:390-400) — shipped / deferred-by-decision / stage-2

- **#1** `.ics` invite updates, same UID + SEQUENCE bump — VERIFIED,
  `src/mail/ics.ts`; `test/compose-ics.test.ts`.
- **#2** Decision-meeting view — DEFERRED-BY-DECISION (DEC-446: closes
  out-of-stage-1-scope). Confirmed absent: no such view file under
  `app/src/pages/`.
- **#3** Assisted chasing (reminder drafts) — VERIFIED shipped (DEC-441,
  re-verified in §6 item 3 above).
- **#4** "Resubmit with guidance" status — DEFERRED-BY-DECISION (DEC-446:
  status set frozen at five literals, `src/domain/status.ts:5-17`).
  Confirmed no sixth status literal exists anywhere in the tree.
- **#5** Airtable one-way sync — VERIFIED, `src/sync/airtable.ts`;
  `test/airtable-sync.test.ts`.
- **#6** Public API docs page — VERIFIED, `src/routes/docs.tsx`.
- **#7** Show-flow export — VERIFIED, `src/routes/api/exports.ts`
  `showflow.csv`.
- **#8** Resend webhooks → delivery/open tracking — STAGE-2 (needs a real
  Resend account), correctly absent.

Per instruction, #2 and #4 are scored DEFERRED-BY-DECISION citing DEC-446,
never GAP, never PENDING-OWNED.

---

## OPEN ITEMS

**FAIL-unowned (no decision, no dispatched task covers it):** none found.

**PENDING-OWNED (a named DEC plus a named branch, not yet merged into
`main` as of S):** none found. All items that were PENDING-OWNED at the
prior ledger (`task-w15-f-spec-audit-stage1.md`: reviewer-queue scoping,
results-endpoint JS/SQL boundary, SPEC §10 #3, the CONTRAST_BLOCKING flip)
are now closed and re-verified directly in code at S (see §6 and §7
above) — their owning branches (`task-w15-a`, `task-w15-b`, `task-w15-d`,
`task-w15-e`, `task-w16-a`) are all ancestors of S per `git log --merges`.

FAIL-unowned list: **empty**. PENDING-OWNED list: **empty**.

## RESULT

Per DEC-438, RESULT is PASS only when both lists are empty. Both lists
are empty at S.

**RESULT: PASS.**
