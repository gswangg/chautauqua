# task-w12-f — spec-audit @ 7f7477e (S'')

## Preconditions (DEC-188)

- First-parent walk from `main`: `7f7477e` = "merge task-w12-a" — matches
  the expected S'' exactly. Precondition satisfied; audit proceeds.
- `git merge-base --is-ancestor 2dd2f33 7f7477e` — exits 0 (ancestor
  confirmed).
- `git merge-base --is-ancestor 629d57e 7f7477e` — exits 0 (the
  code-bearing operator commit is present on the audited line).
- `git merge-base --is-ancestor 38860f9 7f7477e` — exits 0 (audit
  baseline is an ancestor of S'').
- Full DEC-188 precondition grep set (DEC-177/179..183 markers):
  `DEC_179`..`DEC_188` all present as exported constants in
  `src/decisions.ts` at S''.

## Scope

`git diff 38860f9..7f7477e` (58 files changed, 4377 insertions(+), 105
deletions(-)) audited against SPEC.md and docs/ precedence
(clarifications.md overrides all). `docs/verification-log/task-w11-e-spec-audit.md`
(orphan, bound to stale S'=7561cc1, never merged, no ledger section) was
NOT cited as evidence — this is an independent audit performed directly
against the tracked diff and current source.

## (1) Wave-10 fixes DEC-179..183

- **DEC-179 (CSV formula-injection)** — `src/lib/csv.ts` `formatCell`:
  string cells whose first char is `=`, `+`, `-`, `@`, tab, or CR get a
  leading apostrophe before the existing RFC-4180 quoting; number/null
  cells are exempt. `test/csv.test.ts` covers all six trigger chars,
  the quote+escape interaction, and that negative numbers are
  unaffected. Matches DEC-179 exactly. CONFORMS.
- **DEC-180 (fail-only login limiter + success reset)** —
  `src/lib/rate-limit.ts` adds `peekScopedLimit` / `incrementScopedLimit`
  / `resetScopedLimit` alongside the untouched
  `checkAndIncrementScopedLimit` (claim/submit scopes keep the original
  check-and-increment helper — confirmed no diff in
  `src/routes/public/submit.tsx` or `src/lib/submit-core.ts`, so public
  submit's rate-limit scope is untouched). `src/routes/auth.tsx`
  `POST /login`: peeks both `login-user`/`login-ip` budgets read-only
  before verifying credentials (429 if either exhausted), increments
  both only on a failed credential check, and resets the per-email
  window on success. `test/auth.test.ts`'s three new DEC-180 cases
  (20-failures-then-429, success-does-not-consume-budget,
  success-clears-budget-then-19-more-failures-allowed) pass. CONFORMS.
- **DEC-181 (csrfFormOrHeader on /logout + portal token threading)** —
  `src/server/middleware.ts` adds `csrfFormOrHeader` (accepts either the
  `x-chq-csrf: 1` header or the double-submit form-cookie pair);
  `POST /logout` in `src/routes/auth.tsx` is gated by it.
  `src/routes/portal/shared.tsx`'s `PortalLayout` now takes and renders a
  `csrfToken` prop as a hidden `chq_csrf` field on the sign-out form;
  every `/portal/*` page that constructs `PortalLayout`
  (index/edit/profile/tasks/resources) threads a real `csrfToken` from
  `ensureCsrfCookie`, including two GET handlers
  (`GET /portal/submissions/:id`, `GET /portal/tasks/resources`) that
  didn't previously mint one. `test/portal-signout.test.ts` confirms the
  form renders. CONFORMS.
- **DEC-182 (parseBoundedIdArray on all five bulk-ids routes)** —
  `src/server/http.ts` exports `parseBoundedIdArray(value, field, opts?)`
  next to `ApiError`: non-array/empty/oversized/non-string/out-of-range
  (1-64 chars) all throw `ApiError("invalid", ...)`, which
  `errorEnvelope` renders as `{error:{code,message,fields?}}` — no
  silent filtering. All five call sites converted:
  `src/routes/api/submissions.ts` (`ids`), `src/routes/tasks.ts`
  (`contactIds`, optional `taskIds`), `src/routes/api/contacts.ts`
  (`contactIds`, custom `MAX_BULK_EMAIL_RECIPIENTS` cap),
  `src/routes/files.ts` (`fileIds`, custom `MAX_ARCHIVE_FILES` cap).
  CONFORMS.
- **DEC-179..183 wrangler.jsonc vars removal** — `wrangler.jsonc`'s
  `"vars": {"DEV_MODE": "1"}` block is gone (replaced by a `// DEC-183`
  comment); DEV_MODE now lives only in `.dev.vars`
  (untracked)/`.dev.vars.example` (tracked). CONFORMS.

## (2) Operator commit 629d57e

- `git ls-files 7f7477e | grep -i dev.vars` returns no match — `.dev.vars`
  is not tracked at S''.
- `.dev.vars.example` at S'' contains exactly one var line,
  `DEV_MODE=1` (plus an explanatory `#` comment) — no other vars.
- `.gitignore` contains a literal `.dev.vars` line (re-ignored).
- Net note: `.dev.vars` was re-tracked with a real
  `AIRTABLE_TOKEN=...` value at `bdc472b` (within the audited range,
  after 629d57e's untrack) and then removed again before wave-11's
  merges landed; because `git diff 38860f9..7f7477e` is a two-endpoint
  diff, the add+remove nets to no visible file change, matching the
  audit's intended tracked-diff-only method. This is the same residual
  history-exposure risk already flagged by a prior (orphan) audit note
  and explicitly accepted/scheduled for a post-convergence history scrub
  under DEC-187's commit message ("never pushed"); it is not a new
  finding and does not block this gate, since S'' itself (the tree
  under test) never tracks the file. CONFORMS at S''; residual history
  risk already documented, not re-opened here.

## (3) DEC-187 fix

- `scripts/ensure-dev-vars.ts` exports `ensureDevVars(rootDir)`:
  returns `"exists"` untouched when `.dev.vars` is present (never
  reads/prints it), throws loudly when `.dev.vars.example` is missing,
  else copies byte-for-byte and returns `"created"`. Runnable directly
  via the `import.meta.url === file://...` tsx guard.
  `package.json` gains `"predev": "tsx scripts/ensure-dev-vars.ts"`.
  `scripts/render-sweep.ts` calls `ensureDevVars(REPO_ROOT)` before
  spawning wrangler dev. `.github/workflows/ci.yml`'s walkthrough and
  perf-smoke jobs run `npx tsx scripts/ensure-dev-vars.ts` before their
  wrangler-dev steps. `test/wrangler-config.test.ts` retargets its
  DEV_MODE assertion to `.dev.vars.example`, asserts the `.gitignore`
  guard, and unit-tests `ensureDevVars` in a temp dir (create-when-absent
  and never-overwrite cases, plus a throw-when-example-missing case).
  Node-only `node:fs`/`node:path`/`node:url` imports confined to
  `scripts/` — no stage-2 wiring, no secrets required to run (it only
  ever copies a checked-in placeholder). CONFORMS.

## (4) Secrets scan (tracked diff only)

- `git diff 38860f9..7f7477e | grep -iE` over common secret patterns
  (api key/token/password/secret assignments, Airtable) surfaced only
  prose references inside `docs/verification-log.md`/
  `docs/verification-log/*.md` narrating the already-resolved 629d57e
  incident, all already truncated/partial in that prose. No full live
  credential appears in the two-endpoint diff. `.dev.vars` confirmed
  untracked at S'' per (2) above — the local untracked file (which may
  hold a real secret) was never read.

## Build/tests (informational, not the exit gate)

`npm run build` — clean at S''. Targeted vitest run of
`test/csv.test.ts`, `test/rate-limit.test.ts`, `test/auth.test.ts`,
`test/wrangler-config.test.ts`, `test/server-http.test.ts`,
`test/portal-signout.test.ts`, `test/api-submissions.test.ts` — 7 files,
119 tests, all passing.

## Findings

None. All four audited areas conform to SPEC.md/docs and their
governing decisions.

OPEN ITEMS: 0
RESULT: PASS
