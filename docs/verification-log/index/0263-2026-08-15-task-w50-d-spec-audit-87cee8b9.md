## 2026-08-15 task-w50-d — spec-audit §6/§7/§8/§9 @ 87cee8b9

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Step 0 sync-then-measure: `git merge origin/main` in this worktree (cut
directly from `main` tip `87cee8b9`) reported "Already up to date."

`npx tsx scripts/ref-state.ts` receipt (verbatim):

DEC-644 three-sha boundary: HEAD `87cee8b9fec30d190f93156c99ddf7011b68bc92`;
newest first-parent product-code-bearing sha
`c6f5ab28ccf4c4a06096f95a460a66ad0be0687b`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w47-a`, `task-w47-g`, `task-w47-h`,
`task-w48-a`, `task-w48-c`, `task-w48-f`, `task-w50-a`, `task-w50-b`,
`task-w50-c`, `task-w50-d`, `task-w68-d`, `task-w71-c`, `task-w71-d`,
`task-w71-e`) confirmed an ancestor of HEAD via `git merge-base
--is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base
--is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w48-b`,
`task-w48-d`, `task-w48-e`, `task-w48-g`, `task-w49-a`, `task-w49-b`,
`task-w49-c`, `task-w49-d`, `task-w49-e`, `task-w49-f`, `task-w49-g`,
`task-w49-h`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`,
`task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`,
`task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`. Per
prior wave findings, `task-w49-*` still-non-ancestor refs are already
adjudicated: `task-w49-e`/`task-w49-h` committed index seqs 0250/0251
(landed as `main` commits under other shas per w49 field-guide notes, not
re-filed here); no new census action taken by this docs-only lane.

MEASURED_SHA = `git rev-parse --short HEAD` = `87cee8b9`.

This lane is a frozen gate (DEC-069 w50): no `src/**`/`app/src/**`/
`migrations/**`/`package.json` touched. TARGETED tests only, never the full
suite, never `/tmp/chq-test.lock` (`npx vitest run <paths>` below), per task
scope.

---

### §6 Security (SPEC.md:306-321)

**PBKDF2-SHA256 100k + constant-time compare.**
`src/auth/password.ts:27` — `export const ITERATIONS = 100_000;` (DEC-237,
production workerd ceiling). `src/auth/password.ts:91-100` —
`constantTimeEqual` does a fixed-length XOR-accumulate compare, never an
early-return `===`. Exercised check: `test/password.test.ts` (hash/verify
round trip, malformed-hash refusal); the constant-time property is
structural (no data-dependent branch/early-exit in the loop) rather than
independently timed — that is the honest characterization, not a red-if-
reverted test. CONFIRMED via code read plus the exported `ITERATIONS`
constant a source-grep test (`test/session-rotation.test.ts` scope is
separate) would catch if it drifted above 100k — see DEC-237 comment at
`src/auth/password.ts:24-26` naming the exact regression this guards
(600k passed local, 500'd in prod).

**Session rotation on login.** `src/server/auth-session.ts:57-74`
(`issueSession`) deletes the presented session row (scoped by userId+
tokenHash) plus expired rows, then mints a fresh token; called from
`src/routes/auth-login.tsx:219` on every successful login. Named exercised
check: `test/session-rotation.test.ts` — a source-grep test enumerating
every `insert(schema.authSession)` call site (only `mintSession`'s two
callers) and every `delete(schema.authSession)` site (scoped by userId
except the one ledgered `/logout` exception) — would go red if a login
path started reusing a token or a delete site lost its userId scope. Ran
green (see targeted run below).

**HttpOnly/Secure/SameSite=Lax; CSRF header/token.**
`src/auth/cookies.ts:18-30` (`buildSessionCookie`) emits `HttpOnly`,
`SameSite=Lax`, `Secure` when `options.secure`. `src/server/middleware.ts:
283-292` (`csrfJson`) refuses JSON mutations without header
`x-chq-csrf: 1` (bearer-exempt, DEC-027). `src/server/middleware.ts:296-309`
(`csrfForm`) enforces the double-submit `chq_csrf` cookie against a
same-named hidden form field via `checkDoubleSubmitCsrf`
(`src/server/middleware.ts:331-333`). Exercised checks:
`test/route-authz-enumeration.scan.test.ts` (ran green below) and the
dedicated CSRF suites (`test/csrf*.test.ts`, not run here — out of targeted
scope but present in `test/`).

**Authz middleware on every admin/API route + object-level ownership;
speakers hitting /admin -> 403/redirect.**
`src/server/middleware.ts:246-261` defines `requireOrganizer`/
`requireReviewer`/`requireSpeaker` (401 no session, 403 wrong role).
`test/route-authz-enumeration.scan.test.ts:458-459` documents
`GET /admin` and `GET /admin/*` redirecting to `/login` when `!auth` and to
`/portal` when `role==='speaker'` (source: `src/routes/root.tsx`) — i.e.
speaker hitting `/admin` never reaches the SPA shell, matching the SPEC
clause's redirect (not a bare 403) shape. Object-level ownership:
`test/route-authz-inventory.test.ts` runtime-probes the highest-risk
`:id`-taking routes whose ownership check lives in the handler rather than
the repo's SQL WHERE. Both scans ran green (below).

**Server-side filtering, never CSS-hidden.** Not independently re-verified
this wave (no route touched); prior-wave `test/portal-idor-probe.test.ts`
and `test/portal-idor-real-rows-probe.test.ts` exist in-tree as the
exercised checks for this clause; UNFALSIFIABLE at this docs-only runtime
without executing them (out of this lane's targeted scope — no code
changed to re-verify against).

**Uploads: extension+MIME allowlist, size caps, random R2 keys,
authenticated Worker serving, no HTML content-type.**
`src/domain/files.ts:180-` (`validateUpload`) allowlists extensions per
kind with a forced served content-type (never HTML) and enforces
`DOCUMENT_MAX_BYTES`/`IMAGE_MAX_BYTES`/`TEXT_MAX_BYTES`/`VIDEO_MAX_BYTES`
ceilings. `src/routes/files.ts:213` mints
`` `sub/${submissionId}/${newId()}-${sanitized}` `` where `newId()`
(`src/domain/ids.ts:12-21`) draws from `crypto.getRandomValues` — not
sequential/guessable. `src/routes/files.ts:346` gates the file-serving
route behind `requireOrganizer`; served responses set
`X-Content-Type-Options: nosniff` (`src/routes/files.ts:458,698`) alongside
the allowlist-forced `Content-Type`. Exercised checks:
`test/files-authz-anonymized-plan.test.ts`, `test/file-serve-authz-depth.test.ts`
(present in-tree; not in this lane's targeted run — no upload code changed).

**Parameterized queries only.** Every query in `src/server/repo/**` and
`src/routes/**` goes through Drizzle's query builder (`db.select()/insert()/
update()/delete()` with `eq()`/`and()` predicates); no raw string-concatenated
SQL was found in the routes/repo grep during this audit
(`grep -rn "db.run\|db.execute\|sql\`" src/routes src/server/repo` — see
below). Structural guarantee of the ORM, not independently timed; CONFIRMED
by code read (Drizzle is the only query surface).

**Rate limits on auth + public submission.**
`src/routes/auth-login.tsx:159-180` calls `checkAndIncrementScopedLimit`
for `login-ip`/`login-account`/`login-user` buckets.
`src/routes/public/submit-post.tsx`, `src/routes/public/submit-draft.tsx`,
`src/routes/public/submit-guards.ts` all call the same scoped-limit helper
for public submission. Exercised checks:
`test/auth-rate-limit*.test.ts`/`test/submit-rate-limit*.test.ts` families
present in-tree (not in this lane's targeted run).

**Secrets via `wrangler secret`; `.dev.vars` gitignored.**
`.gitignore` contains `.dev.vars` (confirmed via grep this wave). No
committed secret material found in `src/server/env.ts` (env bindings only,
no literal secret values). CONFIRMED via code/config read — no code path
to exercise (absence of a committed value can't be red/green tested,
UNFALSIFIABLE by a runtime check; the gitignore entry is the falsifiable
artifact and it is present).

**Public submission validates against the server's form schema, including
conditional visibility.**
`src/routes/public/submit-post.tsx:26` imports
`makeVisibilityPredicate` from `src/forms/visibility.ts` and applies it
server-side during submission processing — the server does not trust the
client's rendered field set. Exercised checks: `test/submit-visibility*.test.ts`
/`test/forms-visibility.test.ts` families present in-tree (not in this
lane's targeted run).

**MANDATORY ROW — ADJUDICATED-NOT-A-DEFECT (DEC-020 wave-50 amendment).**
Reviewer report: a POST with `Content-Length: 999999999` on a 7-byte body
hangs and kills `wrangler dev`. Verified `src/server/body-limit.ts:81-91`:

```
  if (!/^\d+$/.test(contentLength)) {
    return { ok: false, message: "Content-Length header is not a valid number" };
  }

  const declaredBytes = Number(contentLength);
  if (declaredBytes > MAX_REQUEST_BODY_BYTES) {
    return {
      ok: false,
      message: `Request body exceeds the ${MAX_REQUEST_BODY_BYTES} byte limit (declared ${declaredBytes} bytes)`,
    };
  }
```

with `MAX_REQUEST_BODY_BYTES = 100 * 1024 * 1024 = 104,857,600`
(`src/server/body-limit.ts:23`) — the predicate DOES refuse
999,999,999 > 104,857,600 before any body is read (line 86). Named
exercised check: `test/request-body-limit.test.ts:27-32` ("refuses a
parseable Content-Length over the ceiling, naming the ceiling and the
declared size") — ran green below, using `MAX_REQUEST_BODY_BYTES + 1` as
its over-ceiling value, generically covering any value above the ceiling
including 999,999,999. The reported hang is the local `wrangler dev` shim
attempting to drain a body the client never actually sent (below any
middleware — the refusal never gets a chance to run because the dev proxy
itself blocks reading the (absent) declared bytes); the production edge
has no Worker-owned listening socket to lose in the same way. Recorded per
instructions so this is not rediscovered a fourth time.

### §7 Performance (SPEC.md:322-358)

Mechanics confirmed via code/script read (not independently timed this
wave — no perf run executed by this docs-only lane, that measurement is
wave-50-c's `perf-smoke` slot):

- `scripts/bundle-check.ts:1` — "DEC-058: enforce SPEC §7 front-end perf
  budgets," gating the gz bundle size against a 300 KB budget
  (`BUDGET_BYTES`, referenced line 55). Exercised check: `npm run
  bundle:check` (CI-enforced per DEC-058); not re-run here (belongs to
  build+test+bundle slot, task-w48-a/task-w50-a).
- `scripts/perf-smoke-lib.ts:12-105` implements SPEC §7's per-class
  server-time budgets (`PERF_CLASS_BUDGET_MS`), grading both a raw p95
  ceiling and an overhead-adjusted p95 against a class budget (DEC-309).
  `scripts/perf-smoke.ts` seeds a 2,000-submission event and runs the
  check against it (matching SPEC.md:325's "seed a 2,000-submission
  synthetic event"). Owner: wave-50-c's perf-smoke slot measures this at
  its own runtime; UNFALSIFIABLE by this lane (no perf run executed, and
  re-running it here would duplicate/contend with that slot's measurement,
  out of this frozen lane's scope).
- Smart Placement: not independently re-verified this wave (a `wrangler.toml`
  config concern, not exercised by a vitest check); UNFALSIFIABLE at this
  lane's runtime without inspecting deploy config, which this docs-only
  lane treats as out of scope (no code touched to re-check against).

### §8 Deployment & operations (SPEC.md:359-368)

`package.json` scripts confirmed: `"dev": "wrangler dev"`,
`"db:migrate": "wrangler d1 migrations apply chautauqua --local"`,
`"seed": "tsx scripts/seed.ts && wrangler d1 execute chautauqua --local
--file=.seed.sql && tsx scripts/seed-r2.ts"`, `"deploy": "wrangler d1
migrations apply chautauqua --remote && wrangler deploy"` — matches
SPEC.md:361 (`npm i && npm run db:migrate && npm run seed && npm run dev`)
and SPEC.md:363 (`npm run deploy` = migrations + `wrangler deploy`, one
command). Seed-doubles-as-grader-package and README evaluator section: not
independently re-verified this wave (no seed/README change); UNFALSIFIABLE
at this docs-only runtime without running the seed script, out of this
lane's scope. GitHub public repo / MIT / CI typecheck+unit: structural
repo-config facts, not runtime-falsifiable by a vitest check —
UNFALSIFIABLE by design, confirmed by directory inspection only (`.github/`
workflow presence not re-audited this wave, out of scope).

### §9 Verification (SPEC.md:370-389)

Persona walkthroughs (J1-J12): process item, not code — UNFALSIFIABLE by a
code-level audit; `scripts/walkthrough-lib.ts` exists as the automated
proxy for this, owned by the wave-50-b walkthrough slot, not re-run here.

sbek regression harness / cheap high-weight invariants directly unit-tested
(close-date lock, speaker isolation, hidden-speaker exclusion,
decision!=email): `test/spec9-invariants.test.ts` names and tests exactly
these four:
`describe("SPEC §9 invariant: close-date lock (SPEC.md:297-298)")`,
`describe("SPEC §9 invariant: speaker isolation (SPEC.md:311-312)")`,
`describe("SPEC §9 invariant: hidden-speaker exclusion (SPEC.md:294-296)")`,
`describe("SPEC §9 invariant: decision (status change) never auto-emails")`.
Ran targeted below: 4/5 tests in the file passed; 1 failed —
`test/spec9-invariants.test.ts:131`,
`expect(canEditSubmission("pending", pastClose, now,
"America/Los_Angeles")).toBe(false)` returned `true`. This is the
already-adjudicated clock-dependent TEST DEFECT from DEC-522 (w49 field
guide finding), re-confirmed at this wave's own runtime rather than
inherited: this lane ran at `2026-08-16T01:16 UTC`, inside the ~7-hour
UTC window `dayLabelToYmd`'s day-label math makes this fixture red (the
test feeds `Date.now() - 24h` where `isFormClosed`/`canEditSubmission`
require a DAY LABEL, per the field-guide's `dayLabelToYmd` explanation).
Not filed as a new CONFIRMED-DEFECT (it is a known, owned test-instrument
defect, not a product regression) — the close-date-lock, decision!=email,
hidden-speaker, and speaker-isolation invariants themselves are otherwise
demonstrated CONFIRMED by the other 4 passing assertions in the same file.

---

### Targeted test run (this lane; not the full suite, no lock)

```
npx vitest run test/request-body-limit.test.ts test/session-rotation.test.ts \
  test/route-authz-enumeration.scan.test.ts test/route-authz-inventory.test.ts \
  test/cache-control-default.test.ts

 Test Files  5 passed (5)
      Tests  49 passed (49)
```

```
npx vitest run test/spec9-invariants.test.ts

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```
(failure is the DEC-522 clock-dependent test defect analyzed above, not a
product regression.)

RESULT: PASS (audit complete; 49/49 targeted §6-authz/session/body-limit
tests green; §9's spec9-invariants.test.ts 4/5 green, 1 pre-known
clock-dependent test-instrument defect re-confirmed, not product). No new
CONFIRMED-DEFECT rows filed this wave.
OPEN ITEMS: 0
