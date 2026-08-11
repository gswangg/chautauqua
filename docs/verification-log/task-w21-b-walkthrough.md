# task-w21-b — walkthrough gate @ 6807b67 (confirm-else-run: confirmed)

Task: walkthrough gate at FROZEN `6807b67`, port 8951, per DEC-208
(wave 21 plan), constrained by DEC-208, DEC-206, DEC-203, DEC-187,
DEC-129, DEC-200.

## Step 1 — DEC-114 sha check

First-parent walk from `main` HEAD down to `6807b67`:

| sha | subject | files touched |
|---|---|---|
| `9b3b875` | scribe wave 21 | decisions/DEC-207/208/209.md, field-guide/index.md, src/decisions.ts (const appends) |
| `d413da6` | merge task-w20-f | docs/verification-log.md, docs/verification-log/task-w20-f-triage-closure.md |
| `8da1d2a` | merge task-w20-e | docs/verification-log.md, docs/verification-log/task-w20-e-spec-audit.md |
| `076e0a8` | merge task-w20-b | docs/verification-log.md, docs/verification-log/task-w20-b-walkthrough.md |
| `d35cd68` | merge task-w20-d | docs/verification-log.md |
| `1ff4b3e` | merge task-w20-c | docs/verification-log.md, docs/verification-log/task-w20-c-perf-smoke.md |
| `d1c13d2` | merge task-w20-a | docs/verification-log.md, docs/verification-log/task-w20-a-build-test.md |
| `78bb286` | scribe wave 20 | decisions/DEC-205/206.md, field-guide/index.md, src/decisions.ts (const appends) |
| `6807b67` | merge task-w18-b | **FROZEN binding — newest code-bearing sha** |

Every commit strictly above `6807b67` touches only
`docs/verification-log.md`, `docs/verification-log/*.md`,
`decisions/DEC-*.md`, `field-guide/index.md`, or pure string-constant
appends to `src/decisions.ts` — all inside the DEC-114
bookkeeping-exclusion set. No code-bearing commit above `6807b67`.
**Sha check: PASS, no drift.**

## Step 2 — DEC-203 precondition greps

Run against the worktree tree (cut from `main`, which includes
`6807b67`'s code):

```
$ grep -n "toLowerCase" src/routes/api/users.ts
57:  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";

$ grep -n "lower(" src/server/repo/users.ts
54:    .where(sql`lower(${schema.user.email}) = ${input.email}`)

$ grep -n "accountRoutes" src/index.ts
4:import { accountRoutes } from "./routes/account";
41:app.route("/", accountRoutes);

$ grep -n "account/password" src/routes/api/users.ts
79:    const text = `An account has been created for you.\n\nEmail: ${created.email}\n\nSign in at /login with the temporary password your organizer will share with you; you can change it at /account/password after signing in.`;
```

All four present. The welcome-email text at line 79 contains no
interpolated password value (only `${created.email}`) and mentions
`/account/password`. **Precondition check: PASS.**

## Step 3 — confirm-else-run (DEC-129 full-heading match)

Searched `docs/verification-log.md` for the exact full heading
`task-w20-b — walkthrough @ 6807b67`. Found at (pre-append) line 7305:
`## 2026-08-10 task-w20-b — walkthrough @ 6807b67`, landed on `main`
via `merge task-w20-b` (`076e0a8`) as a late drainer during the
wave-20/21 planning window. The section ends with `OPEN ITEMS: 0` /
`RESULT: PASS`.

This is a full-heading match per DEC-129 — text and `@ 6807b67`
binding both match exactly. It is distinct from the dead homonym
`## 2026-08-10 task-w20-a — walkthrough confirm @ 8c7f479` (different
heading text, and bound to the abandoned `8c7f479` lineage, not
`6807b67`) and from the first-campaign `task-w19-*` sections (also
bound to `8c7f479`). Those are correctly excluded per DEC-129/206.

Per this task's instructions, quoting and confirming this section
stands in place of a fresh walkthrough run. The full quoted content is
reproduced in the top-level `docs/verification-log.md` entry for this
task (`## 2026-08-10 task-w21-b — walkthrough @ 6807b67`).

Summary of the confirmed run's findings (task-w20-b's own record):
- `npm run build` green.
- `rm -rf .wrangler`; `npm run db:migrate` — all 14 migrations
  applied; `npm run seed` green (D1 rows + 8 R2 objects incl. seed
  file + 4 headshots).
- `npx tsx scripts/ensure-dev-vars.ts` materialized `.dev.vars`
  (never read/printed, per DEC-187).
- `npx wrangler dev --port 8951` — `Ready on http://localhost:8951`.
- `npm run walkthrough -- --url http://localhost:8951` — 6/6 modules
  PASS: producer, review, speaker, public, data, scale. J1-J12 checks
  passed incl. J2 `/dev/mailbox` GET-200, DEC-175 authz probes
  (existence-hiding 404 vs authz-denial 403), DEC-108
  invite-visibility gates.
- DEC-200 live checks via curl (cookie jar + csrf form flow, same
  pattern as `scripts/perf-smoke.ts`, seeded organizer identity from
  `docs/fixtures/sample-data.json`):
  - `GET /account/password` with no cookies → `302` to `/login`.
  - After login as the seeded organizer, `GET /account/password` →
    `200` with the change-password form (current-password,
    new-password fields) in the body.
- Server killed after the run (per task-w20-b's own record).

## Corroboration (not substitute evidence)

The tracked file `docs/verification-log/task-w20-b-walkthrough.md`
(present in this worktree, 3958 bytes, mirrors the same green run) is
cited here purely as corroboration that the confirmed section's
detail record exists and is consistent — it was not used as a
replacement for the confirm-else-run check performed in Step 3.

## Result

OPEN ITEMS: 0

RESULT: PASS
