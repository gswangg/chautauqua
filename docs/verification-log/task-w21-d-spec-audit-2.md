# 2026-08-10 task-w21-d — spec-audit @ 6807b67

Full detail for the `## 2026-08-10 task-w21-d — spec-audit @ 6807b67` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-069 scope-4 spec-audit gate, task-w21-d lane (DEC-208), log-only
(this file plus the detail doc are the only modification). Full
detail: `docs/verification-log/task-w21-d-spec-audit.md`.

**STEP 1 — DEC-114 sha check.** Worktree cut from `main` tip `9b3b875`
("scribe wave 21"). `git diff --stat 6807b67 9b3b875 -- src/ decisions/
field-guide/` touches only `decisions/DEC-205.md`..`DEC-209.md`,
`field-guide/index.md`, and `src/decisions.ts` (pure `export const`
appends `DEC_205`..`DEC_209`, no other lines) — all within DEC-114's
bookkeeping exclusion set. `6807b67` ("merge task-w18-b") remains the
newest code-bearing sha, matching DEC-206's FROZEN binding. **PASS**
(no drift).

**STEP 2 — DEC-203 precondition greps**, re-run against the tree: all
four present (`toLowerCase` in `src/routes/api/users.ts:57`, `lower(`
in `src/server/repo/users.ts:54`, `accountRoutes` mounted at
`src/index.ts:4,41`, and zero `password`-string hits anywhere under
`src/mail/` confirming the welcome email stays password-free per
DEC-200). No miss.

**STEP 3 — homonym guard / confirm-else-run search (DEC-129/DEC-208).**
Searched `docs/verification-log.md` for a full heading ending
`@ 6807b67`: found `## 2026-08-10 task-w20-e — spec-audit @ 6807b67`
(this file, line 7357) — sha match is exact (trivial ancestor case),
scope covers the same SPEC §8/§9 static audit (authz middleware
coverage, csrfForm/csrfJson, existence-hiding 404s, file-access authz,
DEC-180 failures-only rate limits, public-query visibility filtering,
`bundle:check`, `parseBoundedIdArray`), explicitly notes DEC-201/DEC-202
as planner-ACCEPTED waivers, and ends `OPEN ITEMS: 0` / `RESULT: PASS`.
Per DEC-129 this is a genuine confirm source, not a dead homonym — task-
w20-e's branch ref itself may be a zero-commit stale ref (DEC-209), but
its content already landed on `main`'s ledger (via `merge task-w20-f`)
with a full matching heading, which is what the guard checks.

**STEP 4 — independent spot-check** (not a full re-audit, per confirm-
else-run): `npm run build` PASS; `npm run bundle:check` PASS (entry
`index-BcvmMKms.js` + `index-easpJsYc.css` = 58.87 kB gzip, budget
300.00 kB); route-file sweep of `src/routes/**` for
`sessionLoader|requireOrganizer|requireReviewer|requireSpeaker|
csrfForm|csrfJson` finds 4 files with no hit — `root.tsx` (public SSR
landing/ASSETS proxy, DEC-049), `docs.tsx` (public API docs, DEC-056),
`me.ts` (inline `c.var.auth` check on top of the global sessionLoader
mount, any-authenticated-role bootstrap), `api/validators.ts` (not a
route file — pure validators, DEC-002) — all correct by design, no new
gap; `src/routes/auth.tsx` rate-limit scan confirms `peekScopedLimit`/
`incrementScopedLimit`/`resetScopedLimit` (failures-only, DEC-180) on
`login-user`/`login-ip` and `checkAndIncrementScopedLimit` on `claim`.

DEC-201 (global pubcache bump on any mutation) and DEC-202 (KV
read-then-write limiter non-atomicity) reaffirmed as planner-ACCEPTED
stage-1 waivers, not counted as findings.

No new findings beyond the confirmed `task-w20-e` section.

OPEN ITEMS: 0

RESULT: PASS
