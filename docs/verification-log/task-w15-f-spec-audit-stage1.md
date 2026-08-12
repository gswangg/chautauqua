# task-w15-f — STAGE-1 COMPLETION LEDGER (DEC-438)

`git rev-parse HEAD` = **f4274f9075d5fdefb109fd67799a168618497ce1**
("merge task-w15-c"), branch `task-w15-f`, cut from `main` at that commit.
This is the sha personally re-read for every citation below; no verdict is
inherited from `docs/verification-log/task-w13-f-spec-audit-stage1.md`,
`task-w14-h-spec-audit-stage1.md`, or any wave summary. (Note: the `-stage1`
suffix is mandatory here because campaign-1's `task-w15-f-spec-audit.md` and
`task-w15-e-spec-audit.md` already exist in this directory — confirmed
present, untouched, not read for verdicts.)

**Build/test at S:**
- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
  vite build --config app/vite.config.ts`): **PASS**, 0 errors. Main SPA
  entry `index-BSzgTq9I.js` 183.82 kB / gzip 59.95 kB.
- `npm test --silent`: **PASS — 274 test files / 2288 tests**, 0 failures.

Log-only lane. No source file changed by this task; only this file is
written.

---

## Explicit re-checks required by this task (DEC-433/434/435, wave-14 landings)

1. **DEC-433 — two bounds.** Bound #1, `src/routes/public/query.ts:10-16`:
   `export const MAX_PUBLIC_PAGE = 50;` and `parsePage` clamps
   `n > MAX_PUBLIC_PAGE ? MAX_PUBLIC_PAGE : n` (never merely rejects — clamps,
   per the module comment at `:6-9` citing cache-cardinality). Bound #2,
   `src/server/repo/public/bounds.ts:9-19`: `export const MAX_PUBLIC_ROWS =
   600;` and `boundedRowLimit(page, perPage)` asserts both args are finite
   integers ≥1 (`assertFiniteIntGte1`, throws otherwise — fail-loudly, not a
   silent floor) then returns `Math.min(page * perPage, MAX_PUBLIC_ROWS)`.
   Both call sites verified: `src/server/repo/public/speakers.ts:11,68`
   (`.limit(boundedRowLimit(opts.page, opts.perPage))`) and
   `src/server/repo/public/sessions.ts:16,326` (`const limit =
   boundedRowLimit(opts.page, opts.perPage);`, consumed at `:101,115`).
   VERIFIED — both bounds present and wired into both public list queries.
2. **DEC-434 — one predicate, no truthiness leak.** `src/server/env.ts:59-60`:
   `export function isDevMode(env) { return env.DEV_MODE === "1"; }` is the
   only definition in the tree (`grep -rn "DEV_MODE ===" src` matches only
   this line plus its own doc comments). Three call sites checked, none
   re-spell the comparison: `src/server/context.ts:52` `if (env?.EMAIL &&
   !isDevMode(env))` in `makeMailer` (mailer selection); `src/routes/dev/
   mailbox.tsx:24` `shouldMountDevMailbox` returns `isDevMode(env)` directly;
   `src/server/origin.ts:98` `const devMode = isDevMode(c.env)`. `grep -rn
   "DEV_MODE" src/server/context.ts` shows no bare truthiness check
   (`env.DEV_MODE` alone, `!!env.DEV_MODE`, etc.) anywhere in the mailer path.
   VERIFIED.
3. **DEC-435 — formatRef, no hardcoded prefix.** `src/sync/airtable.ts:17,172`:
   `import { formatRef } from "../domain/ids";` ... `ref: formatRef(s.
   recordPrefix, s.seq)`. `grep -rln "SES-" src` matches only
   `src/decisions.ts` (the DEC-435 text itself), `src/db/schema.ts` (a doc
   comment example), and `src/domain/ids.ts` (formatRef's own doc example) —
   no live string-template prefix construction remains outside `formatRef`.
   VERIFIED.

All three wave-14 landings hold at S; none regressed.

---

## (1) J1–J12 (SPEC.md:95–181)

| Job | Status | Citation |
|---|---|---|
| J1 | VERIFIED | `src/db/schema.ts:120` `event_slug_idx`; `src/routes/public/submit.tsx` mounts `GET /submit/:eventSlug` with no auth middleware; conditional field visibility `src/forms/visibility.ts` |
| J2 | VERIFIED | Draft/submit handlers in `src/routes/public/submit.tsx`; required-field gating `src/forms/validate.ts`; edit-lock `src/domain/edit-lock.ts:11`; confirmation email dispatch in the same submit route |
| J3 | VERIFIED | Saved views `src/routes/api/views.ts`; bulk status `src/routes/api/submissions.ts`; status literal set `src/domain/status.ts` |
| J4 | VERIFIED | Plan config `src/routes/review/plans.ts`; fewest-ratings-first `src/domain/evaluation.ts:334` `buildReviewerQueue`; anonymization gating in `src/server/repo/files.ts` |
| J5 | VERIFIED (incl. bonus) | Decision≠email proven directly by `test/spec9-invariants.test.ts:58-69` (`updateSubmissionStatuses` write path touches only `schema.submission`, never `schema.emailLog`); 100-cap in `src/domain/compose.ts`; feedback-attach in `src/routes/comms.ts` |
| J6 | VERIFIED | Exactly-once acceptance trigger in `src/server/repo/submissions/status.ts`; default onboarding tasks `src/domain/acceptance.ts` `DEFAULT_ONBOARDING_TASKS` |
| J7 | VERIFIED | Portal shell `src/routes/portal/index.tsx`; one-record-two-views `updateContactProfile` in `src/routes/portal/profile.tsx`; cross-account IDOR test `test/task-file-access.test.ts` "403s for another speaker (IDOR)" |
| J8 | VERIFIED | Version chain `src/db/schema.ts` `previous_file_id`; content-approval gate `src/server/repo/public/gates.ts` `visibleSessionConditions`; upload allowlist `src/domain/files.ts` |
| J9 | VERIFIED | Conflicts surfaced-not-blocking `src/domain/schedule.ts`; auto-schedule greedy placement in the same module; optimistic drag + rollback in `app/src/pages/Agenda.tsx` |
| J10 | VERIFIED | Five public surfaces mounted in `src/routes/public/index.tsx`; `.ics` export in `src/routes/public/feeds.ts`; three-gate visibility `src/server/repo/public/gates.ts`; embed generator `app/src/pages/settings/EmbedsPanel.tsx` |
| J11 | VERIFIED | Contact directory `src/server/repo/contacts.ts`; CSV import `src/lib/csv.ts`; merge integrity `test/contacts-merge-integrity.test.ts`; same three-gate ladder as J10 |
| J12 | VERIFIED | Exports `src/routes/api/exports.ts` incl. `showflow.csv`; bearer tokens `src/routes/api/tokens.ts`; Airtable one-way sync `src/sync/airtable.ts`, `ref` now correct per DEC-435 re-check above |

No J-row is a GAP at S.

---

## (2) SPEC §5 invariants (SPEC.md:290–303)

| Invariant | Status | Citation |
|---|---|---|
| Status pipeline literal set (`pending → accept_queue|decline_queue → accepted|declined` + custom) | VERIFIED | `src/domain/status.ts` |
| Status changes never send email | VERIFIED | `test/spec9-invariants.test.ts:58-69` |
| Contact→participant→public three-gate ladder never collapsed | VERIFIED | `src/server/repo/public/gates.ts` — distinct `visibleSessionConditions`/`visibleParticipantConditions`/`visibleSubmissionConditions`, ANDed only at point of use |
| `close_date` past ⇒ new submissions rejected + unaccepted-speaker edits locked; accepted keep editing | VERIFIED | `src/routes/public/submit.tsx` close-date checks on draft/submit/edit paths; `src/domain/edit-lock.ts:11` |
| Acceptance auto-creation fires exactly once, idempotently | VERIFIED | `src/server/repo/submissions/status.ts` |
| Stable IDs / per-event record prefixes / `.ics` UIDs never churn | VERIFIED | `src/domain/ids.ts:23` `formatRef` used event-scoped everywhere, incl. Airtable sync per DEC-435 re-check; `.ics` UID stability `src/mail/ics.ts` |
| Files: `previous_file_id` chains, full history | VERIFIED | `src/db/schema.ts` |

---

## (3) SPEC §6 (SPEC.md:306–320)

| Item | Status | Citation |
|---|---|---|
| PBKDF2-SHA256 100k, constant-time, session rotation | VERIFIED | `src/auth/password.ts:16` `ITERATIONS = 100_000`; module comment cites the workerd 100k ceiling matching SPEC.md:308's amended text |
| CSRF custom-header/token | VERIFIED | `src/server/middleware.ts:248-249` — `x-chq-csrf` header check on non-bearer JSON mutations |
| Authz + object-level ownership | VERIFIED | role/event-grant middleware in `src/server/middleware.ts`; IDOR case `test/task-file-access.test.ts` |
| Server-side filtering, never CSS-hidden | VERIFIED | `src/server/repo/public/gates.ts` |
| Uploads: allowlist/caps/random keys, no HTML content-type served | VERIFIED | `src/domain/files.ts` |
| Parameterized queries only (Drizzle) | VERIFIED | repo-wide Drizzle usage, no raw string SQL interpolation found in `src/server/repo/` |
| Rate limits on auth + public submission | VERIFIED | `checkAndIncrementScopedLimit` gates in `src/routes/public/submit.tsx` (draft save) and portal-profile writes |
| Public submission validates server-side against form schema | VERIFIED | `src/forms/validate.ts`, invoked in the submit handler before persistence |

---

## (4) SPEC §7/§8 (SPEC.md:322–368)

| Item | Status | Citation |
|---|---|---|
| Admin API reads p95<50ms / writes<100ms, CI-enforced | VERIFIED (mechanism); 2 measured misses PENDING-OWNED | `scripts/perf-smoke-lib.ts` `PERF_CLASS_BUDGET_MS`; `test/perf-smoke.test.ts`. `docs/verification-log/task-w13-d-perf-smoke-stage1.md` names reviewer-queue whole-plan load and results-endpoint oversized payload as the two open items — both confirmed still present at S (`src/domain/evaluation.ts:334` `buildReviewerQueue` and the results/plan endpoint still compute-then-slice; no fix commit for either is an ancestor of S). PENDING-OWNED (DEC-439/DEC-440, `task-w15-a` and `task-w15-b`, not yet merged) |
| One round trip per view | VERIFIED | `src/routes/api/overview.ts` single joined payload |
| Public pages Cache-Control+SWR, purge on write; bare `schedule.ics` joins the cache | VERIFIED | `src/server/pubcache.ts` `publicCacheMiddleware` + `test/pubcache.test.ts`; DEC-442 fix (`726b72d`, "pubcache: let bare schedule.ics join the public edge cache") **is** an ancestor of S (`merge task-w15-c` at S's parent) — re-verified: `src/server/pubcache.ts` `isUncacheableIcsRequest(url)` = `parsed.pathname.endsWith("/schedule.ics") && parsed.searchParams.has("ids")`, i.e. request-shaped (only an `?ids=`-carrying schedule.ics request skips the cache), not the old path-shaped `isIcsPath` which skipped every `schedule.ics` request unconditionally |
| Public `?page=`/row-LIMIT bounds (DEC-433) | VERIFIED | see explicit re-check #1 above |
| High-frequency actions optimistic + loud rollback | VERIFIED (mechanism) | `app/src/pages/Agenda.tsx` |
| D1 indexes on every FK + (event_id,status) + (event_id,slug) | VERIFIED | `src/db/schema.ts` index definitions; `test/schema-fk-indexes.test.ts` |
| Server pagination + filtering; thumbnailed headshots w/ cache headers | VERIFIED | `test/pagination.test.ts`; headshot thumbnailing in `src/routes/portal/profile.tsx` |
| SPA code-split by route, initial bundle <300KB gz | VERIFIED | `scripts/bundle-check-lib.ts` `BUDGET_BYTES = 300*1024`; this build's `index-BSzgTq9I.js` 59.95 kB gz |
| CI perf smoke against 2k-row seed | VERIFIED | `.github/workflows/ci.yml` perf-smoke job; `scripts/perf-seed.ts` |
| §8 quickstart (`npm i && db:migrate && seed && dev`) | VERIFIED | `package.json` scripts; `README.md` quickstart |
| §8 seed doubles as grader package, README lists creds | VERIFIED | `README.md` "For evaluators" section |
| §8 GitHub public repo MIT, CI typecheck+unit tests | VERIFIED | `LICENSE`; CI build-and-test job |
| §8 `npm run deploy` | STAGE-2, correctly absent | no `"deploy"` script in `package.json`, per SPEC.md:59-63 |

---

## (5) SPEC §9 four unit invariants (SPEC.md:381–383)

| Invariant | Test file | Assertion |
|---|---|---|
| Close-date lock | `test/edit-lock.test.ts` | Pending+closed not editable; accepted+closed editable |
| Speaker isolation (cross-account IDOR) | `test/task-file-access.test.ts` | "403s for another speaker (IDOR)" |
| Hidden-speaker exclusion | `test/headshot-gate.test.ts` | "404s unauthenticated when the speaker isn't publicly visible (pending/hidden)" |
| Decision ≠ email | `test/spec9-invariants.test.ts:58-69` | `updateSubmissionStatuses` write path never touches `schema.emailLog` |

All four VERIFIED at S; ran `npx vitest run test/spec9-invariants.test.ts
test/edit-lock.test.ts` directly — 10/10 pass.

---

## (6) DEFERRED-TO-STAGE-2 (SPEC.md:59-63)

- Cloudflare provisioning (D1/R2/KV, cron) for a live deployment.
- `wrangler deploy` / `npm run deploy` (script absent — correct).
- Resend API key + real email delivery; stage 1 uses the dev-sink mailer +
  `/dev/mailbox` (`src/routes/dev/mailbox.tsx`).
- Production edge-cache validation (true CDN-hit TTFB, Smart Placement).
- Airtable one-way sync going live against a real base (code path exists,
  tested against a fake client, `src/sync/airtable.ts`).
- Domain/DNS, CI deploy pipeline.

---

## (7) SPEC §10 nice-to-haves (SPEC.md:390-400) — deferred-by-decision vs shipped

Per DEC-437 (§10 items 2, 3, 4 deferred-by-decision) as amended by DEC-441
(§10 #3 ships this wave, #2 waits one more wave, #4 stays deferred):

- **#1** `.ics` invite updates, same UID + SEQUENCE bump — VERIFIED,
  `src/mail/ics.ts` (SEQUENCE bumped by caller); `test/compose-ics.test.ts`.
- **#2** Decision-meeting view — DEFERRED-BY-DECISION (DEC-441: waits one
  more wave; not present at S — confirmed no such view file under
  `app/src/pages/`).
- **#3** Assisted chasing (reminder drafts) — **not present at S**
  (`grep -rln "reminder.*draft" src app/src` = 0 matches). Per DEC-441 this
  ships "now" but the owning task `task-w15-d` has not yet merged into `main`
  as of S (`git log --oneline` at S shows no `task-w15-d` merge commit).
  PENDING-OWNED (DEC-441, `task-w15-d`), not a gap.
- **#4** "Resubmit with guidance" — DEFERRED-BY-DECISION (DEC-437), correctly
  absent.
- **#5** Airtable one-way sync — VERIFIED, `src/sync/airtable.ts`; `test/
  airtable-sync.test.ts`.
- **#6** Public API docs page — VERIFIED, `src/routes/docs.tsx`.
- **#7** Show-flow export — VERIFIED, `src/routes/api/exports.ts`
  `showflow.csv`.
- **#8** Resend webhooks → delivery/open tracking — STAGE-2 (needs a real
  Resend account), correctly absent.

---

## CONTRAST_BLOCKING flip (DEC-436/DEC-443)

`scripts/render-sweep-contrast.ts:25`: `export const CONTRAST_BLOCKING =
false;` at S — still unflipped. Per DEC-443 the flip passes to wave 15's
build/test lane (`task-w15-e`) under DEC-436's unchanged rule (only the
flipping lane's own all-PASS run may flip it). `task-w15-e` has not merged
into `main` as of S. PENDING-OWNED (DEC-443, `task-w15-e`), not a gap.

---

## OPEN ITEMS

**FAIL-unowned (no decision, no dispatched task covers it):** none found.

**PENDING-OWNED (decision exists + task dispatched this wave, not yet
merged into `main` as of S):**

1. Reviewer-queue whole-plan load (SPEC §7 read-budget). DEC-439, branch
   `task-w15-a`.
2. Results-endpoint oversized payload / JS-vs-SQL aggregation boundary
   (SPEC §7 read-budget + fail-loudly invariant). DEC-439 + DEC-440, branch
   `task-w15-b`.
3. SPEC §10 #3 — assisted-chasing reminder drafts. DEC-441, branch
   `task-w15-d`.
4. CONTRAST_BLOCKING flip still `false`. DEC-443, branch `task-w15-e`.

(Bare `schedule.ics` uncached, formerly item 3 of
`task-w13-d-perf-smoke-stage1.md`'s open-items list — DEC-442, `task-w15-c`
— is now CLOSED at S: `task-w15-c` is an ancestor of S, verified above under
§4.)

FAIL-unowned list: **empty**. PENDING-OWNED list: **non-empty (4 items)**.

## RESULT

Per DEC-438, RESULT is PASS only when both lists are empty. The
PENDING-OWNED list is non-empty (4 items), so:

**RESULT: NOT PASS (PENDING-OWNED, 0 unowned FAILs).** All four open items
are named decisions with dispatched, in-flight branches (`task-w15-a`,
`task-w15-b`, `task-w15-d`, `task-w15-e`) not yet merged as of this ledger's
audited sha S. This is the expected, correct state mid-wave-15 — not a
gap requiring new dispatch.
