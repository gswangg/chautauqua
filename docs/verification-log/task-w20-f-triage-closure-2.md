# 2026-08-10 task-w20-f — triage-closure @ 6807b67

Full detail for the `## 2026-08-10 task-w20-f — triage-closure @ 6807b67` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-069/DEC-139/DEC-205/DEC-206 gate-of-gates, seventh-generation battery,
frozen-sha lane (DEC-206). Log-only lane. Full detail also in
`docs/verification-log/task-w20-f-triage-closure.md`.

**STEP 1 — DEC-114 sha check.** First-parent walk from `main`
(observed tip `d35cd68`, "merge task-w20-d") back to the newest
code-bearing commit: `d35cd68` (merge task-w20-c/d ledger appends),
`1ff4b3e` (merge task-w20-c), `d1c13d2` (merge task-w20-a), and
`78bb286` ("scribe wave 20") each touch only `docs/verification-log.md`,
`docs/verification-log/*.md`, `decisions/DEC-205.md`,
`decisions/DEC-206.md`, `field-guide/index.md`, `src/decisions.ts`
(two pure-string DEC constant appends) — the full DEC-114 bookkeeping
exclusion set. `git diff --stat 6807b67..HEAD -- . ':!docs/verification-log.md' ':!docs/verification-log'`
confirms zero product-code deltas since `6807b67`. `6807b67` ("merge
task-w18-b") remains the newest code-bearing sha, matching DEC-206's
FROZEN binding exactly. **Sha check: PASS, no drift.**

**STEP 2 — five-gate battery, polled over ~10 minutes (well inside the
45-minute window; all five were already on the ledger/sibling branches
by the first poll, no re-poll needed after the initial pass), full
headings ending `@ 6807b67`, homonym guard applied (excluding the dead
`task-w19-a..e`, `task-w20-a`/`task-w20-b @ 8c7f479`, and all
`@ 1033d45`-and-older sections per DEC-206):**
- `task-w20-a — build+test @ 6807b67` (on `main`) — **RESULT: PASS**.
- `task-w20-b — walkthrough @ 6807b67` (branch `task-w20-b`, unmerged
  sibling lane, content verified via `git show task-w20-b:docs/
  verification-log.md`) — **RESULT: PASS**.
- `task-w20-c — perf-smoke @ 6807b67` (on `main`, port 8952) —
  **RESULT: PASS**.
- `task-w20-d — render-sweep @ 6807b67` (on `main`) — **RESULT: PASS —
  31/31 swept routes green, zero console/page errors**; carries an
  `OPEN ITEMS: 1` note (route manifest doesn't list `/account` or
  `/account/password`, compensated with manual curl evidence of the
  anonymous-302 case) — non-blocking, a recommended follow-up for a
  future wave, not a gate failure.
- `task-w20-e — spec-audit @ 6807b67` (branch `task-w20-e`, unmerged
  sibling lane, content verified via `git show task-w20-e:docs/
  verification-log.md`) — **RESULT: PASS**.

All five gate types present with `RESULT: PASS` at the frozen sha. No
poll cycles beyond the first were required.

**STEP 3 — eval-findings.md sections A–F audit.**
- Sections A, B, E, F: closure evidence was established at
  `task-w4-g @ d8d1cbd`, re-confirmed unbroken through `task-w5-g`,
  `task-w8-g`, `task-w9-g`, `task-w12-g`, `task-w13-f`, and
  `task-w15-e @ 1033d45` (this file, above) — every cited file
  (`test/admin-assets-config.test.ts`,
  `app/src/pages/submissions/Submissions.render.test.tsx`,
  `app/src/lib/dates.ts`,
  `app/src/pages/review/Review.render.test.tsx`,
  `test/events-reviewer-access.test.ts`,
  `test/itinerary-roundtrip.test.ts`, `test/overlap-lanes.test.ts`,
  `test/contact-profile-roundtrip.test.ts`,
  `test/contacts-profile-admin.test.ts`, `test/contacts-import.test.ts`,
  `test/contacts.test.ts`, `test/seed.test.ts`,
  `scripts/render-sweep.ts`, `scripts/render-sweep-lib.ts`,
  `test/render-sweep-lib.test.ts`, and the
  `app/src/**/*.render.test.tsx` component smokes) re-confirmed
  present at `6807b67` via `git cat-file -e 6807b67:<path>` — no miss.
  Section C's w5-c/w5-e-linked items (plan-detail SPA crash,
  speaker task-form 400) were confirmed fixed at `task-w8-e`'s
  render-sweep and remain fixed (`task-w20-d`'s render-sweep above,
  31/31 green). Sections C/D beyond that closed set are pre-existing
  P2/optional backlog items, not stage-1 blockers, and were not
  reopened by any DEC in this campaign.
- Two new defects surfaced after `1033d45` (DEC-198's review-lens,
  not eval-findings.md items) are now closed and were re-verified
  directly on the tree at `6807b67`, both required by this task's
  instructions to cite tests:
  - **DEC-199** (case-insensitive org-user emails): `src/routes/api/
    users.ts:57` (`record.email.trim().toLowerCase()`),
    `src/server/repo/users.ts:50-54` (fail-loudly lowercase assert +
    `lower(email) = ${input.email}` dup check). Regression test:
    `test/users-api.test.ts`, `describe("DEC-199 email case
    normalization + login regression", ...)`.
  - **DEC-200** (password-free welcome email + self-service
    `/account/password`): `src/routes/account.tsx` (GET/POST,
    `csrfForm`, `verifyPassword`, deletes all `auth_session` rows,
    reissues session), mounted `src/index.ts:4,41`
    (`accountRoutes`); welcome copy `src/routes/api/users.ts:79` —
    grepped, contains no `password` variable interpolation, points to
    `/account/password`. Regression test: `test/account-password.test.ts`.
  - **DEC-201/DEC-202**: explicit stage-2 acceptances (global public-
    cache purge scope; non-atomic KV rate-limit counters) — closed by
    DEC citation, no code/test obligation for stage-1.

  All items across sections A–F are closed: fixed-with-cited-
  regression-test or explicitly accepted/deferred by DEC. No open
  eval-findings item blocks exit.

**STEP 4 — hygiene.**
- Conflict markers: `git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' --
  .` on the `task-w20-f` tree returns zero hits.
- Branch refs (`git branch -a`): `main`, `task-w20-b`, `task-w20-e`
  (this wave's unmerged sibling lanes — expected while the battery is
  still draining; their content is independently verified above),
  `task-w20-f` (this lane), and `tmp-main-check` (exempt per
  DEC-204(4), points at dead-campaign `472dc3a`, no unique commits
  relative to that dead tip). No stray non-exempt refs.

**STEP 5 — DEC-203 fix preconditions, final re-confirmation on the
tree at `6807b67`:**
- `grep -n "toLowerCase" src/routes/api/users.ts` → line 57 hit.
- `grep -n "lower(" src/server/repo/users.ts` → line 54 hit.
- `grep -n "accountRoutes" src/index.ts` → line 4 (import), line 41
  (`app.route("/", accountRoutes)`) hit.
- `grep -n "password" src/routes/api/users.ts` → welcome-email
  template literal (line 79) contains no interpolated `password`
  variable; the only `password` reference outside declarations is the
  201 JSON response (line 92), the sole one-time cleartext exposure
  per DEC-043/DEC-200.
All four preconditions present — no miss.

**STEP 6 — own build+test at `6807b67`-equivalent tree (task-w20-f
worktree, fresh from `main`).** `npm run build` — PASS (dual `tsc
--noEmit` + `vite build`, clean, no errors). `npx vitest run
test/auth.test.ts` run solo — **PASS, 21/21**, satisfying DEC-206's
tightened auth-flake disposition (counts as non-blocking only if green
solo).

**OPEN ITEMS: 0** (the `task-w20-d` render-sweep manifest-coverage
note is carried forward as a non-blocking follow-up recommendation,
not a live open item for this gate).

**RESULT: PASS — DEC-069/DEC-139 exit predicate satisfied at 6807b67;
wave 21 may declare stage-1 complete with zero tasks.**
