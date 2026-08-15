# task-w44-d — SPEC static-audit gate @ 6edb5263

QUALIFYING SPEC static-audit lane (DEC-069 required section 4, shape fixed
by DEC-063's wave-27 amendment), also constrained by DEC-644's wave-40
amendment (three-sha boundary block) and DEC-063's wave-35 amendment (SPEC
§9's four cheap invariants are one closed population). FROZEN WAVE: nothing
under `src/`, `app/src/`, `migrations/`, or `package.json` is touched by
this lane — everything below is a read-only grep/diff/build against the
checked-out tree, writes land only under `docs/`.

## DEC-644 wave-44 three-sha boundary block

1. **HEAD** (full sha of this worktree): `git -C
   /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w44-d
   rev-parse HEAD` = `6edb526323f8ce3af8f8e71d791a722a7b1a69ad` (short
   `6edb5263`) — this is `main`'s tip at the moment this lane's worktree was
   cut (`git merge --no-edit main` reported "Already up to date"). No
   `task-w43-*` ref failed the ancestry check (only `task-w43-c` still
   exists live, and it confirmed as an ancestor of HEAD on the first try),
   so retry count = 0.

2. **Newest product-code-bearing first-parent sha** — `git log
   --first-parent -1 --format=%H -- src/ app/src/ migrations/ package.json`
   = `14da2921a5be66408057712be877bc44c19de6c4` (short `14da2921`). This
   audit is **INVALIDATED BY** any `src/**`, `app/src/**`, `migrations/**`,
   or `package.json` commit landing after `6edb5263`.

3. **`npx tsx scripts/ref-state.ts` receipt** (verbatim):

   > DEC-644 three-sha boundary: HEAD `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`;
   > newest first-parent product-code-bearing sha `14da2921a5be66408057712be877bc44c19de6c4`;
   > every live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w43-c`,
   > `task-w44-a`, `task-w44-b`, `task-w44-d`, `task-w68-d`, `task-w71-c`,
   > `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git
   > merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via `git
   > merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`,
   > `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a..j`.

   None of the NON-ancestor refs match `task-w43-*`, and the one live
   `task-w43-*` ref (`task-w43-c`) is confirmed an ancestor — STEP 0's
   per-ref ancestry requirement is satisfied on the first sync, no retry
   loop entered.

## (i) SPEC §8/§9 — one-line citations (DEC-063 wave-27: nine consecutive
PASSes retires the section to citation), re-derived from source this wave
per the task brief's explicit instruction (§8's local-setup recipe
re-derived from `package.json`, not trusted from prose)

**§8 local-setup recipe** (SPEC.md:361 — `npm i && npm run db:migrate &&
npm run seed && npm run dev`) checked against `package.json`'s scripts
block directly (not cited from a prior audit):

```
$ sed -n '6,31p' package.json
"scripts": {
  "predev": "tsx scripts/ensure-dev-vars.ts && vite build --config app/vite.config.ts",
  "dev": "wrangler dev",
  "dev:app": "vite build --watch --config app/vite.config.ts",
  "build": "tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts",
  "db:migrate": "wrangler d1 migrations apply chautauqua --local",
  "seed": "tsx scripts/seed.ts && wrangler d1 execute chautauqua --local --file=.seed.sql && tsx scripts/seed-r2.ts",
  ...
  "deploy": "wrangler d1 migrations apply chautauqua --remote && wrangler deploy",
  ...
}
```

All three named scripts (`db:migrate`, `seed`, `dev`) exist verbatim in
`package.json:6-31`; `dev` runs `predev` (via npm's pre-hook convention)
which builds the app bundle before `wrangler dev` serves it, matching the
SPEC.md:361 recipe's implied "populated demo + working local app" outcome.
`npm run deploy` (SPEC.md:363, `package.json:26`) = `wrangler d1 migrations
apply chautauqua --remote && wrangler deploy` — matches "migrations +
`wrangler deploy`, one command" verbatim. **Confirmed, re-derived from
`package.json`, not cited.**

SPEC §9's four named cheap invariants (SPEC.md:382-383 — close-date lock,
speaker isolation, hidden-speaker exclusion, decision≠email) remain the one
closed population `test/spec9-invariants.test.ts` (DEC-063 wave-35
amendment). Re-grepped at this HEAD:

```
$ grep -n 'describe(' test/spec9-invariants.test.ts
44:describe("SPEC §9 invariant: close-date lock (SPEC.md:297-298)", () => {
297:describe("SPEC §9 invariant: speaker isolation (SPEC.md:311-312)", () => {
404:describe("SPEC §9 invariant: hidden-speaker exclusion (SPEC.md:294-296)", () => {
476:describe("SPEC §9 invariant: decision (status change) never auto-emails", () => {
```

All four `describe(` blocks present verbatim, unchanged in line number
from the `14db7b30` reading. **Confirmed as a closed population, not
re-derived clause-by-clause.**

SPEC §9's other named elements (SPEC.md:370-388): persona-walkthrough
governance (SPEC.md:374-377) and sbek eval-as-regression-harness
(SPEC.md:378-388) are process/manual-verification requirements, not
file:line-checkable code facts — unchanged citation per DEC-063, consistent
with every audit back through `task-w28-e`.

## (ii) the six §6/§7 static checks (DEC-063 wave-27, extended to six per
DEC-644's secrets-gitignore row already tracked in prior audits)

### 1. D1 indexes on every FK + `(event_id,status)` + `(event_id,slug)`
(SPEC.md:352) — `migrations/**` + `src/db/schema/**` cross-check since
`14db7b30`, the last audit boundary (wave-40's `task-w40-d`)

```
$ git diff --stat 14db7b30..HEAD -- src/db/schema src/db/schema.ts migrations
$
```

Empty diff-stat. **Zero schema/migrations churn between `14db7b30` and
this audit's HEAD (`6edb5263`)** across waves 41-44 — the previously
exhaustively-derived FK-index table carries forward unchanged.
`(event_id,status)` = `submission_event_id_status_idx` and
`(event_id,slug)` = `event_slug_idx` both unchanged. **Confirmed, zero
gaps at `6edb5263`.**

### 2. SPA code-split by route (SPEC.md:355, `app/src/App.tsx`)

```
$ git diff --stat 14db7b30..HEAD -- app/src/App.tsx
$
$ grep -n 'lazy(pageLoaders' app/src/App.tsx
36:const OverviewPage = lazy(pageLoaders.overview);
37:const SubmissionsPage = lazy(pageLoaders.submissions);
... (15 total, all lazy(pageLoaders.X))
$ grep -n 'manualChunks' app/vite.config.ts
(no match)
```

`App.tsx` unchanged since `14db7b30`; every page component still
`lazy(pageLoaders.X)`, no static page-component import found; no
`manualChunks` override. **Confirmed.**

### 3. `< 300 KB gz` (SPEC.md:355) — run first-hand this wave

Per DEC-644 (one machine, one heavy gate) this was run inside a single
lock acquisition, vite build immediately preceding bundle:check:

```
$ sh scripts/with-test-lock.sh sh -c 'npm run build && npm run bundle:check'
...
Entry bundle: index-DLJqKX_u.js + index-DpG2gFFa.css = 69.20 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

**This is a first-hand figure measured by this lane at this HEAD
(`6edb5263`), not cited from a sibling.** 69.20 kB gzip against 300.00 kB
budget — unchanged from the `14db7b30` reading (also 69.20 kB gz), i.e.
zero bundle-size drift across waves 41-44 despite the contacts-merge and
auto-schedule product-code changes landing in that window (both are
server-side `src/server/repo/**` modules, not client bundle inputs). This
wave's own bundle-check result is PASS; no `PENDING-OWNED` label applies to
this figure at this HEAD (the historic exit-ledger OPEN ITEM 5 bundle
figure was already discharged at `task-w40-d`/`0198`-`0200`, per DEC-069's
wave-39 amendment (c); re-confirmed, not re-discharged). **Confirmed, well
under budget.**

### 4. Parameterized queries only (SPEC.md:317)

```
$ grep -rn '`SELECT\|`INSERT\|`UPDATE\|`DELETE' src/ --include='*.ts' | grep -v 'sql`'
src/server/repo/contacts/import.ts:159: * or more chunked `INSERT ... ON CONFLICT (id) DO UPDATE SET <col> =
src/server/repo/import/sessionboard.ts:261:// into one `UPDATE ... WHERE id IN (...)` per chunk of that group's ids
```

Both hits are comments describing Drizzle-built queries, not raw
string-concatenated SQL literals. Zero query-building hits outside the
Drizzle `sql` tag, unchanged from every prior audit including across the
wave-43 `contacts/merge.ts`/`contacts/crud.ts` rewrite. **Confirmed.**

### 5. No user content served with an HTML content type (SPEC.md:316)

```
$ grep -n 'text/html' src/domain/files.ts
546:  if (value.toLowerCase().startsWith("text/html")) {
547:    throw new Error("assertServedContentTypeHeader: value is text/html — invariant violated");

$ grep -n 'assertServedContentTypeHeader' src/routes/files.ts
34:  assertServedContentTypeHeader,
695:  const contentType = assertServedContentTypeHeader(scope.contentType);
```

`assertServedContentTypeHeader` (`src/domain/files.ts:546-548`) throws on
any served `text/html` content type; called before every served response
at `src/routes/files.ts:695`, unchanged line numbers and mechanism from the
`14db7b30` reading. **Confirmed.**

### 6. Secrets via `wrangler secret`, `.dev.vars` gitignored (SPEC.md:317-318)

```
$ grep -n '\.dev\.vars' .gitignore
9:.dev.vars
```

Unchanged. **Confirmed.**

## (iii) `docs/eval-rubric/*.yaml` coverage table

`grep -n "^  - id:" docs/eval-rubric/*.yaml | wc -l` = **116** — identical
total and identical per-file breakdown to every prior audit back through
`task-w25-e` (no rubric file added, removed, or ID-modified since):

| rubric file | total IDs |
|---|---|
| `01-call-for-papers.yaml` | 20 |
| `02-abstract-management.yaml` | 17 |
| `03-speaker-management.yaml` | 19 |
| `04-content-management.yaml` | 17 |
| `05-ai-agenda.yaml` | 10 |
| `06-public-widgets.yaml` | 19 |
| `07-speaker-crm.yaml` | 14 |

No rubric file added, removed, or ID-modified since `14db7b30`. No
requirement anywhere in the rubric set found without implementation
evidence at `6edb5263`.

## (iv) exit-ledger open-items cross-check (informational, not a fix — DEC-453)

The wave-42 exit ledger (`docs/verification-log/index/0216-...md`) filed
four blocking OPEN ITEMS. This static audit does not adjudicate them (that
is a triage-closure lane's job, not spec-audit's), but records what is
directly observable at `6edb5263` for the wave-45 owners named there:

1. Mechanically-graded triage-closure FAIL (stale `0215` supersedes `0210`
   by append order) — still unresolved at this HEAD; no `docs/
   verification-log/index/021[7-9]*` or `022[0-2]*` triage-closure file
   exists yet (`ls docs/verification-log/index/ | sort | tail` checked).
   Owner unchanged: wave-43/44 triage-closure lane.
2. `mergeContacts` multi-id merge non-atomicity — the cited function
   (`src/server/repo/contacts/merge.ts:703-714` at the ledger's boundary)
   now carries a wave-43 amendment doc-comment (`src/server/repo/contacts/
   merge.ts` ~line 700, "DEC-629/DEC-026 wave-43 amendment: set-based,
   ALL-OR-NOTHING merge") describing a whole-operation preflight before any
   write. This audit does not re-run the merge non-atomicity test suite
   (out of static-audit scope) — flagged for the owning triage lane to
   confirm CONFIRMED-DEFECT retirement, not asserted fixed here.
3. `autoSchedule()` window-blind `existing` filter — `src/server/repo/
   agenda/auto-schedule.ts` now has an `existing`/`existingIds` block
   (around line 60-119) with an inline comment referencing
   "getAgendaPayload would also count" and an out-of-range slot guard,
   consistent with a fix landing in the wave-41-44 window. Same caveat as
   item 2: flagged for the owning lane's confirmation, not adjudicated
   here.
4. `scripts/perf-seed.ts` perf-speaker wiring — `grep -c PERF_SPEAKER
   scripts/perf-seed.ts` = 13, matching the field guide's w44 finding that
   `0213`'s perf-seed CONFIRMED-DEFECT claim was FALSE on re-derivation
   (inserts present at lines 608/627/643/659). Consistent with the field
   guide; not re-litigated here (`scripts/` is out of this lane's write
   scope and this audit's remit is SPEC.md §6-9, not the exit-ledger
   itself).

None of the above changes this audit's own RESULT — SPEC.md §6, §7, §8,
and §9 are all CONFIRMED at `6edb5263` with a file:line or first-hand
command output. Item adjudication remains a separate lane's job per
DEC-069/DEC-453.

## RESULT / OPEN ITEMS

RESULT: PASS.

OPEN ITEMS: 0 — all six §6/§7 static checks are CONFIRMED at this HEAD with
a quoted file:line or first-hand command output, including a first-hand
`< 300 KB gz` bundle:check reading (69.20 kB gz) matching the prior
boundary reading with zero drift. §8's local-setup recipe was re-derived
directly from `package.json`'s scripts block (not cited from prose) and
matches SPEC.md:361 verbatim. §9's four cheap invariants remain the closed
`test/spec9-invariants.test.ts` population, unchanged. Full receipt
pointer: `docs/verification-log/index/0223-2026-08-15-task-w44-d-spec-audit-6edb5263.md`.
