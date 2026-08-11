# task-w21-d — spec-audit @ 6807b67 (detail)

Confirm-else-run lane (DEC-129/DEC-208). Full method reference: the
established lane pattern at `## 2026-08-10 task-w15-f — spec-audit @
1033d45` (`docs/verification-log.md` line 6622) and the seventh-generation
battery run at `## 2026-08-10 task-w20-e — spec-audit @ 6807b67`
(`docs/verification-log.md` line 7357, detail:
`docs/verification-log/task-w20-e-spec-audit.md`).

## Step 1 — DEC-114 sha check

Worktree cut from `main` tip `9b3b875` ("scribe wave 21"). First-parent
walk: `git diff --stat 6807b67 9b3b875 -- src/ decisions/ field-guide/`
touches only `decisions/DEC-205.md`, `DEC-206.md`, `DEC-207.md`,
`DEC-208.md`, `DEC-209.md`, `field-guide/index.md`, and `src/decisions.ts`
(pure string-constant appends `DEC_205`..`DEC_209`, verified via
`git diff 6807b67 9b3b875 -- src/decisions.ts` — additive `export const`
lines only, no other lines touched). `git log --oneline main -- src/`
confirms no commit after `6807b67` shows up in the src/-path-simplified
history. `6807b67` ("merge task-w18-b") remains the newest code-bearing
sha, matching DEC-206's FROZEN binding exactly.

**Sha check: PASS** (equals `6807b67`, no drift). Proceed.

## Step 2 — DEC-203 precondition greps (re-run fresh, not copied)

- `grep -n "toLowerCase" src/routes/api/users.ts` -> line 57:
  `record.email === "string" ? record.email.trim().toLowerCase() : ""`.
- `grep -n "lower(" src/server/repo/users.ts` -> line 54:
  `.where(sql\`lower(${schema.user.email}) = ${input.email}\`)`.
- `grep -n "accountRoutes" src/index.ts` -> line 4 (import), line 41
  (`app.route("/", accountRoutes)`).
- welcome-email password-free check: `grep -rn -i "password" src/mail/`
  returns zero hits (`src/mail/dev-sink.ts`, `render.ts`, `types.ts`,
  `ics.ts` contain no `password` string at all) — the welcome template
  is fully password-free per DEC-200.

All four preconditions present, matching task-w20-e's findings exactly.

## Step 3 — homonym/confirm-else-run search

`grep -n "^## 2026-08-10 task-w20-e — spec-audit @ 6807b67"
docs/verification-log.md` -> line 7357. Read the full section
(lines 7357-7546 of the pre-edit file): DEC-069 scope-4 spec-audit gate,
seventh-generation battery (DEC-205/206), covers the same SPEC §8/§9
static audit (route-by-route authz middleware coverage, csrfForm/
csrfJson on mutations, existence-hiding 404s, file-access authz,
login/claim/submit rate limits DEC-180 failures-only, server-side
visibility filtering on `/e/*` and `/embed/*`, `npm run bundle:check`,
`parseBoundedIdArray` bounded-input helpers), explicitly notes DEC-201/
DEC-202 as planner-ACCEPTED stage-1 waivers (not findings), and ends
`OPEN ITEMS: 0` / `RESULT: PASS`.

Per DEC-129's full-heading match rule, this section cites sha `6807b67`
exactly (not a prior-campaign sha requiring an ancestor check) — a
trivial ancestor match. This is a genuine confirm source, not a dead
homonym. Per DEC-128/DEC-208 confirm-else-run semantics, a full gate
re-run is not required; this lane performs an independent spot-check
instead of a from-scratch line-by-line audit.

## Step 4 — independent spot-check (this lane's own verification, not copied)

- `npm run build` — PASS (dual `tsc --noEmit` + `vite build`, clean).
- `npm run bundle:check` — PASS: entry bundle `index-BcvmMKms.js` +
  `index-easpJsYc.css` = 58.87 kB gzip (budget 300.00 kB).
- Route inventory sweep: `src/routes/*.tsx`, `src/routes/*.ts`,
  `src/routes/api/*.ts` grepped for
  `sessionLoader|requireOrganizer|requireReviewer|requireSpeaker|
  csrfForm|csrfJson`. Four files have no hit:
  - `src/routes/root.tsx` — SSR landing / `/admin` ASSETS proxy, no
    session-scoped data (DEC-049), public by design.
  - `src/routes/docs.tsx` — hand-maintained public API docs page
    (DEC-056), documents no secrets, public by design.
  - `src/routes/me.ts` — `GET /api/v1/me` checks `c.var.auth` inline
    (relies on the global `sessionLoader` mount in `src/index.ts`
    rather than a per-route middleware guard) and 401s if absent;
    correct for an any-authenticated-role bootstrap endpoint.
  - `src/routes/api/validators.ts` — not a Hono sub-app at all; pure
    validator functions (DEC-002 pure-core), no route registrations.
  No new authz gaps found beyond what task-w20-e already covered.
- Rate-limit spot-check: `src/routes/auth.tsx` uses
  `peekScopedLimit`/`incrementScopedLimit`/`resetScopedLimit` from
  `src/lib/rate-limit.ts` for both `login-user`/`login-ip` scopes
  (failures-only per DEC-180 — peek before checking credentials,
  increment only after a real auth failure, reset on success) and a
  `checkAndIncrementScopedLimit` for the `claim` scope. Matches prior
  findings, no drift.

## DEC-201/DEC-202 waivers

Both re-affirmed as planner-ACCEPTED stage-1 waivers per this task's
own instructions and DEC-201/DEC-202 text; not counted as findings.

## Disposition

No new findings beyond the confirmed `task-w20-e — spec-audit @
6807b67` section. Independent spot-check (build, bundle:check, authz
route inventory, rate-limit scan) corroborates rather than contradicts
that PASS.

**OPEN ITEMS: 0**

**RESULT: PASS — confirms `task-w20-e — spec-audit @ 6807b67`
(DEC-069/DEC-129/DEC-208 confirm-else-run); no re-run of the full
line-by-line audit warranted.**
