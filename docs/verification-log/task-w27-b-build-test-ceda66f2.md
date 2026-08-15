# task-w27-b — build+test+bundle @ ceda66f2 (2026-08-15)

## STEP 1 — ref truth (read from `.git` at runtime)

`git rev-parse main` = `ceda66f20989684f702384e60a574a4e9c4fa68a` (S, short
`ceda66f2`).

`git log --first-parent --oneline -25 main` shows the wave-27 scribe commit
at tip, preceded by six wave-26 lane merges (`task-w26-a` through
`task-w26-f`) plus a merge-repair commit
(`6643402d Merge repair: carry --chq-disabled #7D7869 through palette doc
and sweep expectations`), then the wave-25 scribe commit and its five
lane merges. All six wave-26 lanes (`task-w26-a`..`task-w26-f`) are
ancestors of `main` — confirmed merged.

`git for-each-ref refs/heads` + `git merge-base --is-ancestor <ref> main`
for every `task-w*` ref present at read time:

- `task-w17-i` — NOT an ancestor of main (stale/abandoned branch, unrelated
  to this wave).
- `task-w26-a` .. `task-w26-f` — all ancestors of main (merged, confirmed
  above).
- `task-w27-a`, `task-w27-b`, `task-w27-c`, `task-w27-d` — **all four equal
  `main`'s tip exactly** at read time. Per DEC-069's wave-17 amendment, a
  branch whose ref equals its base PRODUCED NOTHING — at the moment this
  lane's worktree was cut, none of the sibling wave-27 lanes (including
  this one, before its own commit) had landed any commits yet. (Note:
  `task-w27-a` was observed to have advanced to `900f8326` by the time this
  lane finished its own work, i.e. mid-wave — expected, per FINDINGS w27's
  own observation that a lane can be mid-edit in the shared set of
  worktrees while a sibling reads.)
- `task-w68-*`, `task-w71-*`, `task-w72-*` — a large family of refs from
  what appears to be an unrelated/future or differently-numbered campaign;
  none relevant to wave 27. `task-w68-d` is an ancestor of main (already
  folded in via some earlier wave's merge); the rest of the `w68`/`w71`/
  `w72` family is NOT an ancestor of main.
- `manual-qa`, `mail-rich-shape-fallback`, `task-custodian-w68-4` — long-
  lived side branches, not evaluated for ancestry (out of scope: task only
  asks for `task-w*` refs).

**S = `ceda66f20989684f702384e60a574a4e9c4fa68a`** (short `ceda66f2`), the
sha this entire report measures.

## STEP 2 — detached worktree at S

Worktree cut via `git worktree add --detach <path> ceda66f2...` (removed
at the end of this run).

### `npm ci --prefer-offline --no-audit --no-fund`
Green. `added 366 packages in 2s`.

### `npm run build` (tsc x2 + vite)
Green. Both `tsc --noEmit` passes (root + `app/tsconfig.json`) succeeded
with no output (no errors), `vite build` produced 276 modules transformed,
entry `index-DPsL0T9G.js` (201.78 kB / gzip 65.46 kB) + `index-DpG2gFFa.css`
(26.59 kB / gzip 5.39 kB). Built in 969ms.

### `sh scripts/with-test-lock.sh npx vitest run` (sole full-suite runner, DEC-119)
**FAIL.** `Test Files  11 failed | 1049 passed (1060)`; `Tests  37 failed |
11703 passed (11740)`. Duration 236.15s.

Failing test files (11), each named once with its failing case count folded
in:

1. `test/auth-login-lockout.test.ts` — 3 failing cases (DEC-072 wave-54
   identity-keyed login budget).
2. `test/count-grammar.test.ts` — 1 failing case (DEC-957 raw `(s)` scan).
3. `test/cross-org-reviewer-probe.test.ts` — 5 failing cases (DEC-459/
   DEC-039/DEC-727 cross-org review route enumeration + refusal probe).
4. `test/file-put-compensation.scan.test.ts` — 2 failing cases (DEC-005
   put-compensation ledger scan).
5. `test/forgot-response-path-parity.test.ts` — 3 failing cases (DEC-004
   wave-44 response-path parity).
6. `test/login-account-budget.test.ts` — 4 failing cases (DEC-072 wave-66
   per-account login budget).
7. `test/password-reset-flow.test.ts` — 6 failing cases (round trip +
   validate-then-consume + byte-identical response).
8. `test/plural-scan.test.ts` — 1 failing case (DEC-987 pluralization scan).
9. `test/reaccept-onboarding.test.ts` — 1 failing case (DEC-278 wave-58
   re-accept onboarding).
10. `test/review-plan-scope-real-rows-probe.test.ts` — 9 failing cases
    (DEC-459 wave-42 plan-scope real-row probe).
11. `test/users-name-persistence.test.ts` — 2 failing cases (DEC-757 name
    persistence).

Two distinct root causes are visible directly in the transcript (not
diagnosed further, not fixed — this is a log-only lane):

- **`test/review-plan-scope-real-rows-probe.test.ts`** (and the auth/login/
  password-reset/reaccept/cross-org files fail with the identical shape,
  strongly suggesting a shared cause): every failing `seedBaseFixture`-style
  insert into the `user` table throws `Error: table user has no column
  named name` — `SqliteError { code: 'ERR_SQLITE_ERROR', errcode: 1 }` —
  even though `src/db/schema/org.ts`'s `user` table definition already
  declares `name: text("name")` (landed by `task-w26-c`, commit
  `279c1313 Fix DEC-757 gap: user.name persists so teammates aren't always
  emails`) and `migrations/0039_user_name.sql` (`ALTER TABLE "user" ADD
  COLUMN "name" TEXT;`) is present and applies clean in STEP 2's separate
  `db:migrate` run below. This means the in-process vitest SQLite fixture
  these test files build (not the D1/wrangler migration path) is stale
  relative to schema.ts — its bootstrap does not include the `name` column,
  even though the file/directory it lives in was NOT touched by this
  lane. This looks like a genuine harness/fixture-bootstrap gap the wave-26
  DEC-757 lane left behind, not a wave-27 regression, but exact
  attribution is out of scope for a log-only lane.
- **`test/users-name-persistence.test.ts`** fails with `expected 500 to be
  201` on both mutating cases. The stderr transcript shows the real
  handler-side cause: `TypeError: db.select is not a function` thrown from
  `getAnchorEventForOrg` (`src/server/repo/events.ts:96:6`), called from
  `src/routes/api/users.ts:100:29` while handling `POST /api/v1/users`.
  This is a genuine 500 in the route handler when this test's own `db`
  object reaches `getAnchorEventForOrg`, independent of the `name`-column
  fixture issue above (this test's other two cases — the over-cap
  `firstName` validation case and the `GET /api/v1/users returns name`
  passthrough case — both pass, so the route itself is reachable; only the
  two cases that exercise a real `repo.createUser` write hit the 500).

**`test/spa-mutation-contract.scan.test.ts` — GREEN.** All 6 tests passed
(`✓ test/spa-mutation-contract.scan.test.ts (6 tests) 6ms`), confirming the
red-since-wave-16 `expect(gaps).toEqual([])` assertion at line 560 is
satisfied at S. Read the file directly to confirm the assertion is still
present and unchanged in shape:
`expect(gaps, ...).toEqual([]);` at
`test/spa-mutation-contract.scan.test.ts:560`, inside `it("every extracted
key appears as a token in its resolved route module's source", ...)`. This
is a direct readout that wave-26 lane c's fix (`POST /api/v1/users`
now reading `firstName`/`lastName`) landed and holds at S.

### `npm run bundle:check`
**PASS.** Entry bundle `index-DPsL0T9G.js + index-DpG2gFFa.css` = 69.19 kB
gzip, budget 300.00 kB (SPEC §7).

### `rm -rf .wrangler && npm run db:migrate`
**PASS.** All 40 migration files listed 0000-0039 (0011 is a pre-existing
numbering gap, not a missing file) applied with `✅`, including
`0039_user_name.sql` — the D1/wrangler local migration path is clean and
up to date with `schema.ts`, in contrast to the stale in-process vitest
SQLite fixture bootstrap noted above under the failing test files.

### `npm run seed`
**PASS.** Seed script completed; D1 rows seeded and 35 R2 objects (deck
PDFs, resource PDF, headshots) uploaded to the local `chautauqua-files`
bucket with no errors.

Worktree removed via `git worktree remove --force` at the end of this run.

## Summary

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npm run build` (tsc x2 + vite) | PASS |
| `npx vitest run` (full suite) | **FAIL** — 37/11740 tests failed across 11 files |
| `test/spa-mutation-contract.scan.test.ts` (DEC-069 wave-16 red test) | PASS (6/6) |
| `npm run bundle:check` | PASS (69.19 kB / 300 kB) |
| `npm run db:migrate` (40 migrations incl. 0039) | PASS |
| `npm run seed` | PASS |

RESULT: FAIL — full suite has 37 failing tests across 11 files at S; two
distinct root causes identified in transcript (stale in-process SQLite
fixture bootstrap missing `user.name` column vs. `schema.ts`/migrations,
and a `db.select is not a function` 500 in `POST /api/v1/users` via
`getAnchorEventForOrg`), neither diagnosed to a fix or touched by this
log-only lane. Build, bundle, migrations, and seed are all green; the
long-standing `spa-mutation-contract.scan.test.ts` red-since-wave-16 test
is confirmed GREEN at S.
