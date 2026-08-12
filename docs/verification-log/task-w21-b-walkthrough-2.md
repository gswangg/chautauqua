# 2026-08-10 task-w21-b — walkthrough @ 6807b67

Full detail for the `## 2026-08-10 task-w21-b — walkthrough @ 6807b67` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Full detail: `docs/verification-log/task-w21-b-walkthrough.md`.

**STEP 1 — DEC-114 sha check.** First-parent walk from `main` HEAD
(`9b3b875`, "scribe wave 21") down to `6807b67`: `9b3b875` (scribe
wave 21: `decisions/DEC-207.md`, `DEC-208.md`, `DEC-209.md`,
`field-guide/index.md`, `src/decisions.ts` string-constant appends
only), `d413da6` ("merge task-w20-f", touches only
`docs/verification-log.md` + `docs/verification-log/task-w20-f-*.md`),
`8da1d2a` ("merge task-w20-e", verification-log only), `076e0a8`
("merge task-w20-b", verification-log only), `d35cd68` ("merge
task-w20-d", verification-log only), `1ff4b3e` ("merge task-w20-c",
verification-log only), `d1c13d2` ("merge task-w20-a",
verification-log only), `78bb286` ("scribe wave 20",
decisions/field-guide/decisions.ts constants only). Every commit above
`6807b67` touches only `docs/verification-log.md`,
`docs/verification-log/*.md`, `decisions/DEC-*.md`,
`field-guide/index.md`, or pure string-constant appends in
`src/decisions.ts` — all within the DEC-114 bookkeeping-exclusion set.
Newest code-bearing sha is `6807b67` ("merge task-w18-b"), matching
DEC-206's FROZEN binding. No drift.

**STEP 2 — DEC-203 precondition greps**, re-run against the tree:
- `grep -n "toLowerCase" src/routes/api/users.ts` → line 57:
  `record.email === "string" ? record.email.trim().toLowerCase() : ""`.
- `grep -n "lower(" src/server/repo/users.ts` → line 54:
  `.where(sql\`lower(${schema.user.email}) = ${input.email}\`)`.
- `grep -n "accountRoutes" src/index.ts` → line 4 (import), line 41
  (`app.route("/", accountRoutes)`) — mounted.
- Welcome-email body in `src/routes/api/users.ts:79` contains no
  interpolated password value and explicitly mentions
  `/account/password`.
All four preconditions present — no miss.

**STEP 3 — confirm-else-run (DEC-129/206).** `docs/verification-log.md`
already contains a section with the exact full heading `## 2026-08-10
task-w20-b — walkthrough @ 6807b67` (line 7305), ending `RESULT: PASS`,
landed as a late drainer via `merge task-w20-b` (`076e0a8`). This is
not a homonym miss under DEC-129 — the heading text and `@ 6807b67`
binding match this task's requirement exactly (distinct from the dead
`task-w20-a — walkthrough confirm @ 8c7f479` and `task-w19-*` sections
elsewhere in this file, which bind to the abandoned `8c7f479` lineage
and are correctly excluded). Per this task's own instruction, quoting
and confirming this section stands in place of a fresh run.

**Quoted (task-w20-b's own record, verbatim methodology/results):**
worked in worktree `chautauqua-wt/task-w20-b`; confirmed no
`.dev.vars` present pre-run; `npm ci` clean; `npm run build` green;
`rm -rf .wrangler`; `npm run db:migrate` applied all 14 migrations;
`npm run seed` green (D1 rows + 8 R2 objects incl. seed file + 4
headshots); `npx tsx scripts/ensure-dev-vars.ts` materialized
`.dev.vars`; `npx wrangler dev --port 8951` reported `Ready on
http://localhost:8951`; `npm run walkthrough -- --url
http://localhost:8951` — 6/6 modules green (producer, review, speaker,
public, data, scale), all J1-J12 checks passed including the J2
`/dev/mailbox` GET-200 assertion, DEC-175 authz probes, and DEC-108
invite-visibility gates. DEC-200 live check via curl (cookie jar + csrf
form flow, same pattern as `scripts/perf-smoke.ts`, seeded organizer
identity from `docs/fixtures/sample-data.json`): `GET
/account/password` with no cookies returned `302` to `/login`; after
logging in as the seeded organizer, `GET /account/password` returned
`200` with the change-password form (current-password and new-password
fields) in the body. `task-w20-b`'s own result: `OPEN ITEMS: 0`,
`RESULT: PASS`.

**Corroboration only, not evidence in itself:** the tracked file
`docs/verification-log/task-w20-b-walkthrough.md` (present in this
worktree, 3958 bytes) records the same prior green run at this sha;
cited here as corroboration of the confirmed section above, not as a
substitute for the confirmation performed in STEP 3.

No server was started for this lane (confirm-else-run path taken per
task instructions; the underlying walkthrough+DEC-200 live checks were
already executed and recorded by `task-w20-b`).

OPEN ITEMS: 0

RESULT: PASS
