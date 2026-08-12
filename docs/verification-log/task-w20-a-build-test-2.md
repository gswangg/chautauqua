# 2026-08-10 task-w20-a — build+test @ 6807b67

Full detail for the `## 2026-08-10 task-w20-a — build+test @ 6807b67` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Verification-only lane per DEC-206/DEC-205/DEC-197 (details in
`docs/verification-log/task-w20-a-build-test.md`).

Step 1 — DEC-114 newest-code-bearing-sha derivation: `git log
--first-parent --oneline` from `main` (HEAD `78bb286`) gives
`78bb286 scribe wave 20` -> `6807b67 merge task-w18-b` -> ... .
`git diff --name-only 6807b67 78bb286` = `decisions/DEC-205.md`,
`decisions/DEC-206.md`, `field-guide/index.md`, `src/decisions.ts`
only, and the `src/decisions.ts` diff is two appended `export const
DEC_205` / `DEC_206` string lines with no other code touched — all
excluded categories per DEC-114. Confirmed newest code-bearing sha =
`6807b67`, matching the FROZEN binding. No drift.

Step 2 — DEC-203 precondition greps at `6807b67` (via `git show
6807b67:<path>`):
- `src/routes/api/users.ts` line 57: `record.email.trim().toLowerCase()`
  — present.
- `src/server/repo/users.ts` line 54: `` .where(sql`lower(${schema.user.email}) = ${input.email}`) `` — present.
- `src/index.ts`: `import { accountRoutes } from "./routes/account";`
  and `app.route("/", accountRoutes);` — present.
- `src/routes/api/users.ts` welcome-email text (line 79): `An account
  has been created for you...Sign in at /login with the temporary
  password your organizer will share with you; you can change it at
  /account/password after signing in.` — no password value
  interpolated into the email body (the plaintext `password` only
  appears in the JSON response, not the email `text`), and
  `/account/password` is mentioned. All four preconditions met.

Step 3 — build+test, run in a detached worktree
(`chautauqua-wt/task-w20-a-verify`) checked out at `6807b67` (this
ledger-only lane touches nothing else in its own worktree):
- `node_modules` present (181 top-level entries; no `npm ci` needed).
- `npm run build` (root `tsc --noEmit` + `app/tsconfig.json` `tsc
  --noEmit` + `vite build`) — clean, no errors, bundle emitted.
- `npm test --silent` (full vitest suite) — **155 test files passed
  (155), 1390 tests passed (1390)**, 0 failed, including
  `test/account-password.test.ts` and the `DEC-199 email case
  normalization + login regression` describe block inside
  `test/users-api.test.ts`, and `test/auth.test.ts` (21 tests,
  including all three `POST /login rate limiting (DEC-180)` cases)
  passed green on the full-suite run itself — the known
  auth.test.ts flake did not manifest this run, so the DEC-197/206
  auth-flake re-run protocol was not needed.
- `npm run bundle:check` — PASSED (entry bundle 58.87 kB gzip, budget
  300.00 kB).

Homonym guard: dead sections `task-w20-a` / `task-w20-b — build+test @
8c7f479` and `task-w19-* — ... @ 8c7f479` elsewhere in this file are
distinct headings (different sha suffix) from this section's `@
6807b67` and were not matched or referenced as prior results for this
task.

OPEN ITEMS: 0

RESULT: PASS
