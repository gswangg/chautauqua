# task-w14-h — STAGE-1 COMPLETION LEDGER (DEC-438)

`git rev-parse HEAD` = **d41fd01ceccd68f4d6128187abdb79000e403c6a** ("merge
task-w14-b"), branch `task-w14-h`, cut from `main` at that commit.

**Build/test at S:**
- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
  vite build --config app/vite.config.ts`): **PASS**, 0 errors. Main SPA
  entry `index-BSzgTq9I.js` 183.82 kB / gzip 59.95 kB.
- `npm test --silent`: **PASS — 272 test files / 2270 tests**, 0 failures.

Log-only lane. No source file changed by this task; only this file is
written. Every citation below was re-read directly against **this**
worktree's tree at S — nothing is carried forward from
`task-w13-f-spec-audit-stage1.md`'s `RESULT: PASS`. Two of that ledger's
"closed" rows have since regressed relative to S because `main` forked into
parallel wave-14 lanes after S was cut, and the fixes for two of those
lanes (`task-w14-a`, `task-w14-c`) merged into `main` *after* S — they are
real, dispatched, and sitting on `main` right now, just not yet ancestors of
this branch's cut point. Both are reported below as PENDING-OWNED, not as
unowned FAILs.

---

## Explicit re-checks required by this task (no inherited verdicts)

1. **Save-draft rate limit** — `src/routes/public/submit.tsx:481-489`:
   `checkAndIncrementScopedLimit(kv, "draft", ip, Date.now(), { windowSeconds:
   3600, max: 60 })` runs before any KV write in the draft-save handler,
   throwing `ApiError("invalid", "Too many submissions...")` on `!rate.ok`.
   Present at S. VERIFIED.
2. **Portal/profile length caps** — `src/routes/portal/profile.tsx:283-291,
   293-301`: `capped` array bounds `firstName/lastName/title/company/
   twitter/linkedin/github/website` at `MAX_TEXT_LENGTH` and `bio` at
   `MAX_LONG_TEXT_LENGTH`, 400 SSR re-render naming the field before
   `updateContactProfile` runs. Present at S. VERIFIED.
3. **PBKDF2 100k vs SPEC.md:308 (DEC-428)** — `src/auth/password.ts:1-9`:
   module comment states "100000 iterations... 100k is the max the
   production Workers runtime supports (workerd rejects PBKDF2 above 100000
   iterations with NotSupportedError...)". SPEC.md:308 (current text, this
   tree) reads "100,000 iterations, the workerd production ceiling;
   DEC-004/DEC-237" — code and spec agree. VERIFIED.
4. **J5 reviewer-feedback attach** — `src/routes/comms.ts:320`:
   `const feedbackComments = includeFeedback ? await
   repo.listFeedbackComments(c.var.db, recipient.submissionId) : [];`, fed
   into `buildMergeVars({ ..., feedbackComments })` at `:322-328`, consumed
   by both preview and send paths. Present at S. VERIFIED.
5. **DEC-432's two SQL moves** — `src/server/repo/portal.ts:699,713`:
   `getMyResources` scopes via `for (const batch of chunkIds(eventIds))` +
   `.where(and(eq(schema.event.orgId, orgId),
   inArray(schema.resource.eventId, batch)))` — WHERE-clause scoping, not a
   post-fetch `.filter()`. Commit `ce3aa01` (`DEC-432: push
   getMyResources/getContactStats post-filters into SQL`) IS an ancestor of
   S (`git merge-base --is-ancestor ce3aa01 HEAD` = true). Present at S.
   VERIFIED.
6. **DEC-430's two contrast remedies** — commit `87c6586` (`DEC-430/431:
   fix forms drag glyph + track chip contrast, flip render-sweep gates`) IS
   an ancestor of S. Forms drag glyph now `--chq-muted` in the forms CSS
   lane; public track chip renders ink-on-surface + bordered swatch dot
   instead of organizer-colour-as-text-background, guarded by a hex regex,
   tested `test/public-track-chip.test.ts`. Present at S. VERIFIED.
7. **DEC-433's two public paging bounds** — `src/routes/public/query.ts:6-9`
   (the only `parsePage` in the tree, `grep -rl boundedRowLimit|MAX_PUBLIC_ROWS|
   MAX_PUBLIC_PAGE src app test` = 0 matches):
   ```
   export function parsePage(raw: string | undefined): number {
     const n = Number(raw);
     return Number.isInteger(n) && n > 0 ? n : 1;
   }
   ```
   This is the **pre-DEC-433 form** — no `MAX_PUBLIC_PAGE` clamp, no
   `boundedRowLimit`. The DEC-433 fix is commit `d3794a9` ("Bound public
   paging param and row LIMIT (DEC-433)") on branch `task-w14-a`
   (`git branch -a --contains d3794a9` on the base repo = only `main`, whose
   graph shows `d3794a9` as the tip of the `merge task-w14-a` branch);
   `git merge-base --is-ancestor d3794a9 HEAD` (this branch, S) = **false**.
   `task-w14-a` merged into `main` (`3dd6512`) chronologically after S was
   cut. **NOT present at S. OPEN — PENDING-OWNED (DEC-433, branch
   task-w14-a, already merged to main post-S).**
8. **DEC-434's dev-mode predicate** — `b6a4f93` ("DEC-434: collapse dev-mode
   predicate into isDevMode(env)") IS S's immediate parent-side commit
   (`git log --oneline -3` at S shows `d41fd01 merge task-w14-b` ->
   `b6a4f93` -> `2a08944`). `src/server/env.ts` exports the sole
   `isDevMode(env)` (`DEV_MODE === "1"`, nothing else). Present at S.
   VERIFIED.
9. **DEC-435's formatRef repair** — `src/sync/airtable.ts:169`:
   ```
   ref: `SES-${String(s.seq).padStart(3, "0")}`,
   ```
   still hardcodes the `SES-` prefix rather than calling `formatRef` (
   `src/domain/ids.ts:23`) with the owning event's per-event prefix — this
   is exactly the SPEC §5 "per-event record prefixes" violation DEC-435
   names. The repair is commit `a4a38bb` ("Fix airtable sync to use
   formatRef instead of hardcoded SES- prefix (DEC-435)") on branch
   `task-w14-c`; `git merge-base --is-ancestor a4a38bb HEAD` (S) = **false**.
   `task-w14-c` merged into `main` (`f3d7db8`) chronologically after S.
   **NOT present at S. OPEN — PENDING-OWNED (DEC-435, branch task-w14-c,
   already merged to main post-S).**

---

## (1) J1–J12 (SPEC.md:95–181)

| Job | Status | Citation |
|---|---|---|
| J1 | VERIFIED | `src/db/schema.ts:106` (`slug`), `:120` (`event_slug_idx`); `src/routes/public/submit.tsx:410` `GET /submit/:eventSlug` mounted with no auth middleware; conditional visibility `src/forms/visibility.ts` |
| J2 | VERIFIED | Draft/submit routes `src/routes/public/submit.tsx:466,554`; required-field gating `src/forms/validate.ts` called at `:624`; edit-lock `src/domain/edit-lock.ts:11`; confirmation email `src/routes/public/submit.tsx:751-783` |
| J3 | VERIFIED | Saved views `src/routes/api/views.ts`; bulk status `src/routes/api/submissions.ts:347`; status literal set `src/domain/status.ts` |
| J4 | VERIFIED | Plan config `src/routes/review/plans.ts`; fewest-ratings-first `src/domain/evaluation.ts:334` `buildReviewerQueue`; anonymization `src/server/repo/files.ts` |
| J5 | VERIFIED (incl. bonus) | Decision≠email proven by `test/spec9-invariants.test.ts:58-69`; 100-cap `src/domain/compose.ts:9`; preview never mints creds `src/routes/comms.ts:280-296`; feedback attach `src/routes/comms.ts:320` (re-check #4 above) |
| J6 | VERIFIED | Exactly-once trigger `src/server/repo/submissions/status.ts:254`; default tasks `src/domain/acceptance.ts:14` `DEFAULT_ONBOARDING_TASKS` |
| J7 | VERIFIED | Portal `src/routes/portal/index.tsx`; one-record-two-views `src/routes/portal/profile.tsx:304` `updateContactProfile`; IDOR test `test/task-file-access.test.ts` |
| J8 | VERIFIED | Version chain `src/db/schema.ts:545,552`; content-approval gate `src/server/repo/public/gates.ts:25` `visibleSessionConditions`; upload allowlist `src/domain/files.ts:55` |
| J9 | VERIFIED | Conflicts surfaced-not-blocking `src/domain/schedule.ts:36,79`; auto-schedule `src/domain/schedule.ts:108`; optimistic drag + rollback `app/src/pages/Agenda.tsx:46-63` |
| J10 | VERIFIED | Five public surfaces `src/routes/public/index.tsx:105`; `.ics` `:197`; visibility gate `src/server/repo/public/gates.ts:25-56`; embed generator `app/src/pages/settings/EmbedsPanel.tsx` |
| J11 | VERIFIED | Contact directory `src/server/repo/contacts.ts`; CSV import `src/lib/csv.ts:4`; merge `test/contacts-merge-integrity.test.ts`; three-gate ladder same as J10 |
| J12 | VERIFIED | Exports `src/routes/api/exports.ts:44` showflow.csv (re-check §10 below); bearer tokens `src/routes/api/tokens.ts`; Airtable sync `src/sync/airtable.ts:4`, ref bug per re-check #9 (does not block J12 itself — J12 only requires the sync exist and be tested, which it is: `test/airtable-sync.test.ts`) |

No J-row is a GAP at S.

---

## (2) SPEC §5 invariants (SPEC.md:290–303)

| Invariant | Status | Citation |
|---|---|---|
| Status pipeline literal set | VERIFIED | `src/domain/status.ts` |
| Status changes never send email | VERIFIED | `test/spec9-invariants.test.ts:58-69` |
| Contact→participant→public three-gate ladder never collapsed | VERIFIED | `src/server/repo/public/gates.ts:25` distinct `visibleSessionConditions`/`visibleParticipantConditions`/`visibleSubmissionConditions`, ANDed only at point of use |
| `close_date` past ⇒ new submissions rejected + unaccepted-speaker edits locked; accepted keep editing | VERIFIED | `src/routes/public/submit.tsx:417-423,473-479,561-567`; `src/domain/edit-lock.ts:11` |
| Acceptance auto-creation fires exactly once, idempotently | VERIFIED | `src/server/repo/submissions/status.ts:254` |
| **Stable IDs / per-event record prefixes (`SES-014`) / .ics UIDs never churn** | **PARTIAL — see re-check #9** | `src/domain/ids.ts:23` `formatRef` is correct and used event-scoped everywhere in admin/public surfaces; `src/sync/airtable.ts:169` bypasses it with a hardcoded `SES-` literal, breaking the per-event-prefix invariant specifically for the Airtable sync payload. .ics UID stability itself (`src/mail/ics.ts` `uidFor`) is unaffected — this is scoped to the Airtable export field only. PENDING-OWNED (DEC-435, task-w14-c) |
| Files: `previous_file_id` chains, full history | VERIFIED | `src/db/schema.ts:545,552` |

---

## (3) SPEC §6 (SPEC.md:306–320)

| Item | Status | Citation |
|---|---|---|
| PBKDF2-SHA256 100k, constant-time, session rotation | VERIFIED | `src/auth/password.ts:1-9`; re-check #3 above |
| CSRF custom-header/token | VERIFIED | `src/server/middleware.ts:247,256` |
| Authz + object-level ownership | VERIFIED | `src/server/middleware.ts` requireOrganizer/requireReviewer/requireSpeaker; `test/task-file-access.test.ts` IDOR case |
| Server-side filtering, never CSS-hidden | VERIFIED | `src/server/repo/public/gates.ts` |
| Upload allowlist/caps/no HTML content-type | VERIFIED | `src/domain/files.ts:18,55` |
| Parameterized queries only | VERIFIED | Repo-wide Drizzle usage |
| Rate limits on auth + public submission (incl. save-draft) | VERIFIED | `src/routes/public/submit.tsx:484-492` (re-check #1) |
| Server-side form-schema validation | VERIFIED | `src/forms/validate.ts` |
| Portal-profile free-text caps | VERIFIED | `src/routes/portal/profile.tsx:283-301` (re-check #2) |

---

## (4) SPEC §7/§8 stage-1-measurable rows (SPEC.md:322–368)

| Item | Status | Citation |
|---|---|---|
| Admin API reads p95<50ms / writes<100ms (CI-enforced mechanism) | VERIFIED | `scripts/perf-smoke-lib.ts:18` `PERF_CLASS_BUDGET_MS`; `test/perf-smoke.test.ts` |
| One round trip per view | VERIFIED | `src/routes/api/overview.ts` single joined payload |
| Public pages Cache-Control+SWR, purge on write | VERIFIED (mechanics; edge-hit TTFB is stage-2) | `publicCacheMiddleware` in `src/routes/public/index.tsx`; `test/pubcache.test.ts` |
| **Public `?page=`/row-LIMIT bounds (DEC-433)** | **OPEN at S** | `src/routes/public/query.ts:6-9` — unbounded `parsePage`, no `MAX_PUBLIC_PAGE` clamp, no `boundedRowLimit` guard anywhere in the tree (re-check #7). PENDING-OWNED (DEC-433, task-w14-a) |
| High-frequency actions optimistic + loud rollback | VERIFIED (mechanism) | `app/src/pages/Agenda.tsx:46-63` |
| D1 indexes on every FK + (event_id,status) + (event_id,slug) | VERIFIED | `src/db/schema.ts` `event_slug_idx` (`:120`), `file_previous_file_id_idx` (`:552`); `test/schema-fk-indexes.test.ts` |
| Server pagination + filtering; thumbnailed headshots w/ cache headers | VERIFIED | `test/pagination.test.ts`; `src/routes/portal/profile.tsx:411-425` |
| SPA code-split by route, initial bundle <300KB gz | VERIFIED | `scripts/bundle-check-lib.ts:5` `BUDGET_BYTES = 300*1024`; this build's `index-BSzgTq9I.js` 59.95 kB gz |
| CI perf smoke against 2k-row seed | VERIFIED | `.github/workflows/ci.yml` `perf-smoke` job; `scripts/perf-seed.ts` |
| §8 quickstart (`npm i && db:migrate && seed && dev`) | VERIFIED | `package.json:7-11`; `README.md` quickstart |
| §8 seed doubles as grader package, README lists creds | VERIFIED | `README.md:135` `## For evaluators` |
| §8 GitHub public repo MIT, CI typecheck+unit tests | VERIFIED | `LICENSE`; CI `build-and-test` job |
| §8 `npm run deploy` | STAGE-2 | No `"deploy"` script in `package.json`, correct per SPEC.md:59-63 |

---

## (5) SPEC §9 four unit invariants (SPEC.md:381–383)

| Invariant | Test file | Assertion |
|---|---|---|
| Close-date lock | `test/edit-lock.test.ts` | Pending+closed not editable; accepted+closed editable |
| Speaker isolation (IDOR) | `test/task-file-access.test.ts` | "403s for another speaker (IDOR)" |
| Hidden-speaker exclusion | `test/headshot-gate.test.ts` | "404s unauthenticated when the speaker isn't publicly visible" |
| Decision ≠ email | `test/spec9-invariants.test.ts:58-69` | `updateSubmissionStatuses` never touches `schema.emailLog` |

All four VERIFIED at S.

---

## (6) DEFERRED-TO-STAGE-2

- Cloudflare provisioning (D1/R2/KV, cron) for a live deployment.
- `wrangler deploy` / `npm run deploy` (script absent — correct).
- Resend API key + real email delivery; stage 1 uses the dev-sink mailer +
  `/dev/mailbox`.
- Production edge-cache validation (true CDN-hit TTFB, Smart Placement).
- Airtable one-way sync going live against a real base (code path exists,
  tested against a fake client, `test/airtable-sync.test.ts`).
- Domain/DNS, CI deploy pipeline.
- Sessionboard importer (SPEC §3 — no API key, roadmap item).

---

## (7) DEFERRED-BY-DECISION (DEC-437 — SPEC §10 items 2, 3, 4)

Per DEC-437 (`SPEC §10 items 2, 3 and 4 are deferred by decision, not
missing`), the following SPEC.md:391-398 nice-to-haves are explicitly out of
stage-1 scope, not gaps:

- **#2** Decision-meeting view (live slot countdown, per-reviewer
  "my top-ranked" queue, accept-with-condition note) — DEFERRED-BY-DECISION.
- **#3** Assisted chasing (reminder drafts for human review) —
  DEFERRED-BY-DECISION.
- **#4** "Resubmit with guidance" status + near-miss CRM invite lane —
  DEFERRED-BY-DECISION.

The other four SPEC §10 items already shipped in stage 1 (confirming DEC-437
correctly scoped only 2/3/4, not the whole section):

- **#1** .ics invite updates, same UID + SEQUENCE bump — `src/mail/ics.ts:2`
  (module comment: "stable UID from submission id, SEQUENCE bumped by
  caller"), `:110` `SEQUENCE:${e.sequence}`; tested `test/compose-ics.test.ts`.
- **#5** Airtable one-way sync — `src/sync/airtable.ts` (module comment
  `:1-8`: "Airtable is NEVER a source of truth... read-only on their side");
  tested `test/airtable-sync.test.ts`. (Ships with the DEC-435 ref-format bug
  tracked above — the *feature* shipped, the ref-format defect is a separate
  open item.)
- **#6** Public API docs page — `src/routes/docs.tsx:1` (module comment:
  "DEC-056: public, no-login API docs page at GET /docs/api"), route
  registered `:331`; linked from `src/routes/root.tsx:119`.
- **#7** Show-flow export — `src/routes/api/exports.ts:3,44`
  (`GET /api/v1/events/:eventId/exports/showflow.csv`).

---

## OPEN ITEMS

**FAIL-unowned (no decision + no dispatched task covers it):** none found.

**PENDING-OWNED (decision exists, fix already dispatched and merged to
`main`, just not an ancestor of this ledger's audited sha S because S was
cut before those wave-14 lanes landed):**

1. DEC-433 — public `?page=`/row-LIMIT bounds not yet in this tree's
   `src/routes/public/query.ts`. Owning branch: `task-w14-a` (commit
   `d3794a9`, merged to `main` at `3dd6512`).
2. DEC-435 — `src/sync/airtable.ts:169` still hardcodes `SES-` instead of
   calling `formatRef`. Owning branch: `task-w14-c` (commit `a4a38bb`,
   merged to `main` at `f3d7db8`).

FAIL-unowned list: **empty**. PENDING-OWNED list: **non-empty (2 items)**.

## RESULT

Per DEC-438, RESULT is PASS only when both lists are empty. The
PENDING-OWNED list is non-empty (2 items), so:

**RESULT: NOT PASS (PENDING-OWNED, 0 unowned FAILs).** Both open items are
already fixed on `main` (merged after this branch's cut point, S) by named,
completed wave-14 lanes (`task-w14-a` for DEC-433, `task-w14-c` for
DEC-435); nothing here is an unowned gap requiring new dispatch. A ledger
audited against current `main` HEAD rather than this branch's frozen cut
point S would find both items closed.
