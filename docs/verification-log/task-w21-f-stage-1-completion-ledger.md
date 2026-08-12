# task-w21-f — stage-1 completion ledger

LOG-ONLY lane (DEC-447/448/438/453/459/471/472/474). No file under `src/`, `app/src/`,
`scripts/`, `test/`, `migrations/`, `decisions/`, or `package.json` was touched by this task.
This document plus the appended section in `docs/verification-log.md` are the only outputs.

## 0. Sha this ledger is evidence about (DEC-448)

This ledger is evidence about **its own sha only**: `git rev-parse HEAD` in this worktree
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w21-f`, branch
`task-w21-f`, cut fresh from `main`) returns:

```
889dffc13e68d28f0ca72e260524675cd3b12ad9
```

`git log --oneline -15` at this sha:

```
889dffc scribe wave 22
c739cdc merge task-w21-e-v2
7d641a4 task-w21-e: perf smoke + DEC-469 measurability audit (log-only)
27cff15 merge task-w21-b
e4fce2d task-w21-b: DEC-473 list-envelope enumeration artifact @ bf56ba7
a29c52b merge task-w20-f
254be3f task-w20-f: mechanical list-envelope enumeration, stage 1 (DEC-459/466)
2736e9d merge task-w21-c
4d6d756 task-w21-c: build/test evidence at bf56ba7, wave-20 landing correction (DEC-472)
d5e549f merge task-w21-a
9649aed DEC-471: bound submissions/:id/files and files/:fileId/comments reads
bf56ba7 scribe wave 21
3764993 merge task-w20-e
f310111 merge task-w20-b
43e6889 DEC-469: seed pipeline_entry/user rows + perf-smoke checks for pipeline/users
```

Own build/test run at this exact sha, this task's own worktree (not copied from any prior
lane's log — DEC-448):

```
$ npm run build            # exit 0, 155 modules transformed, 701ms
$ npm test --silent
 Test Files  294 passed (294)
      Tests  2677 passed (2677)
```

Every row below cites either (a) a file:line read directly in this worktree at `889dffc`, or
(b) `git merge-base --is-ancestor <commit> 889dffc` output captured in this task's own session
(all runs below, verbatim). Nothing is graded from `decisions/`, `src/decisions.ts`, a
`void DEC_NNN;` marker, `field-guide/index.md`, or a prior wave's narrative summary, per DEC-472.

Note on this repo's history: `git log --oneline` beyond the last ~20 commits surfaces commits
tagged `task-w22-*` through `task-w27-*` with much older commit timestamps (2026-08-11, vs.
`bf56ba7`'s 2026-08-12 06:40) and unrelated shas/DEC ranges (e.g. `d99cb45`, `e3d558e`,
DEC-227-233) — these belong to an earlier, pre-redesign completion round that reused the same
`wNN` naming convention, not to this wave-21 close. They are not cited anywhere below; the
wave-21/22 lanes this ledger grades are the ones listed in the `-15` log above and confirmed by
ancestor check where cited.

## 1. J1-J12 (SPEC.md:95-183)

Citing `docs/verification-log/task-w21-b-c3-walkthrough-full.md` — the full six-module
`npm run walkthrough` orchestrator run, FROZEN SHA `27c751e8e2b9eb497017c4675150f140890b02bf`,
`OPEN ITEMS: 0`, `RESULT: PASS`.

Ancestry: `git merge-base --is-ancestor 27c751e 889dffc` → **true** (confirmed fresh in this
session).

| Job | SPEC.md line | Covered by module / evidence line |
|---|---|---|
| J1 — launch a CFP | 95 | producer module, `Running J1 (launch a CFP)... ok` (walkthrough log ln 67-68) |
| J2 — submit a talk | 102 | producer module, `Running J2 (public submit + claim)... ok` (ln 69-70) |
| J3 — triage at volume | 108 | producer module, `Running J3 (triage at volume)... ok` (ln 71-72) |
| J4 — run committee review | 114 | review module: queue ordering, anonymization, scorecard, max-evaluations cap, results sort (ln 82-101) |
| J5 — decide & notify | 123 | producer module, `Running J5 (compose...)... ok` (ln 75-76); review-module accept/remind checks |
| J6 — onboarding runs itself | 129 | speaker module: `default onboarding task set was created...`, portal task grid, deliverable panel (ln 108 area) |
| J7 — speakers self-serve | 139 | speaker module: portal login, dashboard, tasks, profile edit, invite accept/decline (ln 108-176) |
| J8 — collect/review/approve content | 146 | speaker module: file upload allowlist/size cap, version chain, comment thread, content-status gate (ln 158-175) |
| J9 — build the agenda | 153 | public module: `ok J9 ...` lines 190-197 (rooms/tracks, unscheduled tray, overlap non-blocking, auto-schedule) |
| J10 — publish continuously | 162 | public module: `ok J10 ...` lines 198-218 (5 public surfaces, embeds, visibility gates) |
| J11 — reuse the network | 171 | data module: `-- J11: ...` lines 226-235 (search, CSV import, merge, segments, bulk-email, dashboard) |
| J12 — data stays theirs | 177 | data module: `-- J12: ...` lines 236-244 (bearer tokens, role-403, exports, showflow.csv, docs) |

All twelve jobs are exercised by name/number in the run's verbatim output; `RESULT: PASS`,
`OPEN ITEMS: 0` at `27c751e`, an ancestor of this sha.

## 2. SPEC.md:353 "Server pagination + filtering on all admin lists"

Graded **only** from `docs/verification-log/task-w21-b-list-envelope-enumeration-stage1.md`
(the re-derived mechanical `rg`-over-`src/routes/**/*.ts` enumeration, DEC-473's artifact),
never from DEC-460's hand list or DEC-466's prose. Sha the enumeration was run at:
`bf56ba715a36bcde8bbdb9e01edf7b573c38b0de` — ancestor of `889dffc` (confirmed above).

Enumeration finding: 30 unique `items`-bearing envelope sites; 27/30 correctly bounded
(SQL `LIMIT`/`OFFSET` + count, or a DEC-461(e)-blessed JS slice, or a named recipient cap on a
mutation echo). 3 were UNBOUNDED at `bf56ba7`:

- `src/routes/files.ts:166` `GET /api/v1/submissions/:id/files` — PENDING-OWNED(task-w21-a) at
  enumeration time.
- `src/routes/files.ts:309` `GET /api/v1/files/:fileId/comments` — PENDING-OWNED(task-w21-a) at
  enumeration time.
- `src/routes/api/forms.ts:259` `POST /api/v1/forms/:formId/fields/reorder` — FAIL-unowned.

**Re-checked directly at this ledger's own sha `889dffc` (fresh reads, not copied):**

```
$ git merge-base --is-ancestor d5e549f 889dffc && echo yes   # merge task-w21-a
yes
$ sed -n '176,178p' src/routes/files.ts
  return c.json({ items: slice, total: items.length, page, perPage });
$ sed -n '323,325p' src/routes/files.ts
  return c.json({ items: slice, total: comments.length, page, perPage });
```

Both `files.ts` sites now emit the full `{items, total, page, perPage}` envelope — task-w21-a
(`d5e549f`, containing content commit `9649aed`) **is** an ancestor of `889dffc` and its fix is
present. This corrects task-w21-b's own PENDING-OWNED classification, which was accurate about
`bf56ba7` but not about this later sha (exactly the DEC-448 "evidence about its own sha only"
distinction) — credited here.

`src/routes/api/forms.ts:259` re-checked at `889dffc`:

```
$ sed -n '256,259p' src/routes/api/forms.ts
  const reordered = await repo.reorderFields(c.var.db, formId, body.orderedIds as string[]);
  return c.json({ items: reordered.map(toPublicField) });
$ grep -n "MAX_FIELDS" src/routes/api/forms.ts src/server/repo/forms.ts
(no output — no cap exists)
```

Still bare `{items}`, no `total`/`page`/`perPage`, no field-count ceiling anywhere in the
create/reorder path. **Still FAIL-unowned at `889dffc`.**

## 3. SPEC.md:325-335 perf budgets (§ "Server budgets")

From `docs/verification-log/task-w21-e-perf-smoke-stage1.md` — measured sha `bf56ba7`
(ancestor of `889dffc`, confirmed above). All 23 `perf:smoke` checks PASS (exit 0), including
the two DEC-469 checks for `/api/v1/pipeline` (measured `total=803`) and `/api/v1/users`
(measured `total=104`), both confirmed by direct `sqlite3` query against the seeded D1 file, not
assumed from code presence (DEC-453/459). One row in that log is marked
`UNMEASURABLE-BY-CONSTRUCTION at this sha` (line 103 of the source file) — per this task's own
instruction that row is an **open item, not a PASS**, and is carried forward as such below.

## 4. SPEC.md:355 bundle bar + build/test gates

From `docs/verification-log/task-w21-c-build-test-stage1.md`, sha `bf56ba7` (ancestor of
`889dffc`): `npm run build` exit 0; `npm test` 293 files / 2669 tests passed; `npm run
bundle:check` PASSED (entry `index-C47BAmZI.js` bundle, well under the 300 KB gz budget);
`gate:render-sweep` green; 42/42 WCAG AA contrast checks passed. `OPEN ITEMS: 1`,
`RESULT: PASS` (the file's own one open item is a documentation-precision note, not a build/test
defect — see its own file for detail).

This ledger's own re-run at `889dffc` (§0 above) reconfirms green at the current tip: `npm run
build` exit 0, `npm test` 294 files / 2677 tests passed (8 tests newer than `bf56ba7`'s count,
consistent with `task-w21-a`'s and `task-w21-b`'s intervening merges adding coverage, no
regression).

## 5. SPEC.md:361-366 (§8, "Deployment & operations") quickstart / evaluator-package fidelity

The task instruction pointed at "task-w21-d's fresh-start section"; direct inspection of
`docs/verification-log/task-w21-d-spec-audit.md` and `-spec-audit-2.md` at this sha shows
task-w21-d is in fact a confirm-else-run **spec-audit** lane (DEC-069/129/208) with no
fresh-checkout/quickstart section — the task instruction's premise does not hold at `889dffc`
(exactly the class of stale narration DEC-472 exists to catch). The most recent actual
fresh-checkout/quickstart evidence, checked for ancestry rather than assumed:

```
$ git merge-base --is-ancestor c2352a5 889dffc && echo yes   # w23-f: gate 6/6 fresh-clone
yes
```

`docs/verification-log/task-w23-f-c3-fresh-clone.md`: literal README quickstart (`npm i`/`npm
ci`, `npm run db:migrate`, `npm run seed`, `npm run dev`) from a clean checkout, zero secrets,
non-default-port procedure followed exactly as documented (README.md lines 41-45, DEC-296).
`OPEN ITEMS: 0`, `RESULT: PASS`. An older but consistent PASS also exists at
`docs/verification-log/task-w16-e-quickstart-stage1.md` (bare-`npm run dev`/default-port path,
also `PASS`), also confirmed an ancestor.

## 6. Six DEC-472 landing checks (re-verified directly at `889dffc`, not from any prior log)

| Check | Verdict at `889dffc` | Evidence |
|---|---|---|
| DEC-465: `src/lib/pagination.ts` exports `listPerPage`; pipeline/users/segments read it | **TRUE** | `src/lib/pagination.ts:32` exports `listPerPage`. `src/routes/api/pipeline.ts:67`, `src/routes/api/users.ts:54`, `src/routes/api/contacts/segments.ts:98` all call `listPerPage(...)`, not `clampPerPage(q ?? 200)` — the task's assumed old call shape is gone (an improvement on the assumed check, not a regression: `clampPerPage` remains as a legitimately distinct 50-default helper used by genuinely-paginated UI lists — `files.ts`, `dev/mailbox.tsx`, `api/email-log.ts` — not a leftover duplicate). |
| DEC-466: `src/routes/review/reviewer.ts:136`, `plans.ts:310`, `contacts/crud.ts:114` still emit `perPage: items.length \|\| 1` | **FALSE (fixed)** | `grep -n "perPage" ` across all three files: zero hits of `items.length \|\| 1`. `reviewer.ts`'s reviewer-queue route now computes `total = items.length` separately from the actual clamp-derived `perPage`, per its own DEC-466/461(e) comment. |
| DEC-467: `user.email` obeys the canonical email rule | **TRUE (landed)** | `src/routes/api/users.ts:15,68` imports and calls `normalizeEmail` from `src/domain/email.ts`; `src/server/repo/users.ts:61` asserts (fail-loudly) `createUser` is never called with a non-lowercased email. |
| DEC-468: `app/src/pages/contacts/PipelineBoard.tsx` still renders `{entries.length}` | **FALSE (fixed)** | Line 89 renders `{total}` with an explicit DEC-468 comment (lines 23-25); `total` is set from `res.total` (lines 42, 57), never from `entries.length`. |
| DEC-469: perf seed carries pipeline rows and org users at scale | **TRUE** | `docs/verification-log/task-w21-e-perf-smoke-stage1.md` §1-2: direct `sqlite3` query against the seeded D1 file shows 803 `pipeline_entry` rows and 104 `user` rows for the perf org; live authenticated API probes match those counts exactly (`total=803`, `total=104`). |
| DEC-471: `src/routes/files.ts:166` and `:309` now emit the full envelope | **TRUE** | Re-verified directly above (§2): both sites now return `{items, total, page, perPage}` (current line numbers 177 and 324 respectively — the file grew a few lines since DEC-471 was written; content, not line number, is what was checked). |

## 7. Stage-2 scope — explicitly OUT, not graded

The following are stage-2 concerns per SPEC.md/decisions and are **not** graded by this ledger;
their absence is not a stage-1 gap: Cloudflare provisioning, `wrangler deploy` to a live
account, real Resend email delivery, Airtable sync, domains/DNS, CI deploy pipelines, production
edge-cache validation. Stage 1 runs entirely on local `wrangler dev` + local D1/R2 + the
dev-mail-sink, with zero external accounts/secrets required (confirmed again in §5 above).

## Open items

1. One perf-budget row in `task-w21-e-perf-smoke-stage1.md` is marked
   `UNMEASURABLE-BY-CONSTRUCTION at this sha` — an open item per this task's own instruction,
   not a PASS. See that file for which specific budget row and why.
2. `src/routes/api/forms.ts:259` (`POST /api/v1/forms/:formId/fields/reorder`) still returns a
   bare `{items}` envelope with no `total`/`page`/`perPage` and no `MAX_FIELDS`-style cap
   anywhere in the field-create/reorder path — confirmed still present at `889dffc` (§2).

FAIL-unowned: `src/routes/api/forms.ts:259` (`POST /api/v1/forms/:formId/fields/reorder` —
unbounded echo, no cap, no owning branch); the one `UNMEASURABLE-BY-CONSTRUCTION` perf-budget
row carried from `task-w21-e-perf-smoke-stage1.md` (open item, not owned by any branch).

PENDING-OWNED: (none — the two items that were PENDING-OWNED(task-w21-a) at `task-w21-b`'s
enumeration sha `bf56ba7` are confirmed merged and fixed at this ledger's own sha `889dffc`, per
§2/§6 above; nothing else found in this pass is attributed to an unmerged branch).

RESULT: **NOT PASS** — J1-J12 (§1), the DEC-473 list-envelope enumeration modulo two now-landed
items (§2), perf budgets modulo one unmeasurable row (§3), build/test/bundle gates (§4), and
quickstart/evaluator fidelity (§5) all check out at `889dffc`. But SPEC.md:353's "all admin
lists" is a universal-quantifier claim (DEC-459), and one enumerated site
(`src/routes/api/forms.ts:259`) is still unbounded and unowned by any branch. Per DEC-438/459 a
single unowned universal-quantifier miss is enough to withhold PASS: this run is **NOT PASS**,
scoped narrowly to that one route plus the one unmeasurable perf row, both listed above with
file:line so a follow-up fix wave can close them directly.
