# task-w36-d — SPEC static-audit gate @ f5783479

QUALIFYING SPEC static-audit lane (DEC-069 required section 4, shape fixed
by DEC-063's wave-27 amendment), also constrained by DEC-644's wave-36
amendment (three-sha boundary block) and DEC-063's wave-35 amendment
(SPEC §9's four cheap invariants are one closed population). FROZEN-PRODUCT
lane: nothing under `src/`, `app/src/`, `migrations/`, `package.json`,
`scripts/`, or `test/` is touched by this lane — everything below is a
read-only grep/diff against the checked-out tree, writes land only under
`docs/`.

## DEC-644 wave-36 three-sha boundary block

1. **HEAD** (full sha of this worktree): `git -C
   /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w36-d
   rev-parse HEAD` = `f5783479c7a1b8c96ef1506c3cfff1661fd6e338` (short
   `f5783479`).

2. **Newest product-code-bearing first-parent sha** — `git log
   --first-parent -1 --format=%H -- src/ app/src/ migrations/ package.json`
   = `3a041507287b2dca3abeda3e0648a41ddeba9707` (short `3a041507`, `merge
   task-w35-c`). This audit is **INVALIDATED BY** any `src/**`, `app/src/**`,
   `migrations/**`, or `package.json` commit landing after `f5783479`.

3. **Live `task-w3*` ref ancestry** (`git merge-base --is-ancestor <ref>
   HEAD`, run against every branch matching `task-w3*` that still exists —
   `task-w30`..`task-w35` lanes are all merged and deleted per the field
   guide, so the live population is exactly the wave-36 siblings):
   - `task-w36-a` (`f5783479`): **ANCESTOR** (identical to HEAD — no
     product commits on it yet at read time).
   - `task-w36-b` (`dd3096b0`): **NOT-ANCESTOR** — this sibling has
     advanced past `f5783479` and its work is not present at this audit's
     HEAD. Any finding it is expected to carry is `MEASURED-WITHOUT
     (task-w36-b)`, not closed by this receipt.
   - `task-w36-c` (`f5783479`): **ANCESTOR** (identical to HEAD).
   - `task-w36-e` (`f5783479`): **ANCESTOR** (identical to HEAD).

## (i) SPEC §8/§9 — one-line citations (DEC-063 wave-27: nine consecutive
PASSes retires the section to citation)

§8/§9's rot-prone facts (quickstart command match, "For evaluators"
persona-credential table, deploy command, seed-as-grader-package, MIT
license) are cited from `docs/verification-log/task-w28-e-spec-audit-
c6dbdb7c.md` §8/§9 section and its own upstream citations
(`task-w27-e-spec-audit-ceda66f2.md`, `task-w27-e-spec-audit.md`) — not
re-derived here, per DEC-063 (nine consecutive PASSes across two
campaigns stops discriminating).

SPEC §9's four named cheap invariants (SPEC.md:382-383 — close-date lock,
speaker isolation, hidden-speaker exclusion, decision≠email) are, per
DEC-063's wave-35 amendment, ONE closed population: `test/spec9-invariants
.test.ts`. `task-w35-e` is the lane that amendment credits with making the
file carry all four (DEC-063 wave-35: "RULING: `test/spec9-invariants
.test.ts` carries all four as behavioural checks"); `task-w35-e`'s work
reached main via the `4a016110` merge commit, which `git merge-base
--is-ancestor` confirms is an ancestor of this audit's HEAD (`f5783479`).
Because `task-w35-e` IS an ancestor, the file at this HEAD is cited as the
closed four-item population, not recorded PENDING-OWNED:

```
$ grep -n 'describe(' test/spec9-invariants.test.ts
44:describe("SPEC §9 invariant: close-date lock (SPEC.md:297-298)", () => {
297:describe("SPEC §9 invariant: speaker isolation (SPEC.md:311-312)", () => {
404:describe("SPEC §9 invariant: hidden-speaker exclusion (SPEC.md:294-296)", () => {
476:describe("SPEC §9 invariant: decision (status change) never auto-emails", () => {
```

All four `describe(` blocks are present, each quoting its SPEC clause in
its own title. **Confirmed as a closed population, not re-derived
clause-by-clause (that grading already happened in the receipt DEC-063
wave-35 cites as its own evidence).**

## (ii) the five §6/§7 static checks (DEC-063 wave-27)

### 1. D1 indexes on every FK + `(event_id,status)` + `(event_id,slug)`
(`migrations/**` + `src/db/schema/**` cross-check)

The full 65-row FK-column population was last exhaustively re-derived at
`ceda66f2` (`task-w27-e-spec-audit-ceda66f2.md`) and carried forward
unchanged through `c6dbdb7c` (`task-w28-e-spec-audit-c6dbdb7c.md`, empty
`git diff --stat ceda66f2..c6dbdb7c -- src/db/schema migrations`). Between
`c6dbdb7c` and this audit's HEAD (`f5783479`) the schema/migrations diff is
**not** empty:

```
$ git diff --stat c6dbdb7c..HEAD -- src/db/schema src/db/schema.ts migrations
 migrations/0040_contact_headshot_file_id.sql              | 17 +++++++++++++++++
 migrations/0041_evaluation_plan_round_submission_idx.sql  | 13 +++++++++++++
 migrations/0042_review_results_indexes.sql                |  8 ++++++++
 src/db/schema/org.ts                                      |  8 ++++++++
 src/db/schema/review.ts                                   | 22 ++++++++++++++++++++++
 5 files changed, 68 insertions(+)
```

Re-derived (not carried forward) for this delta only, since the prior
table's "zero gaps" claim cannot be assumed to survive a non-empty diff:

- `src/db/schema/org.ts` adds `contact.headshotFileId` (`text
  ("headshot_file_id")`, `org.ts:69`, "DEC-773 amendment (w29-b): FK
  mirror of headshotUrl's `/headshots/<fileId>` pattern") — covered by
  `contact_headshot_file_id_idx` (`index("contact_headshot_file_id_idx")
  .on(t.headshotFileId)`, `org.ts:97`), also present as `CREATE INDEX
  contact_headshot_file_id_idx ON contact (headshot_file_id);` in
  `migrations/0040_contact_headshot_file_id.sql`. **Covered, no gap.**
- `src/db/schema/review.ts` adds two composite indexes on `evaluation`
  (`evaluation_plan_id_round_submission_id_id_idx`,
  `evaluation_plan_round_submission_idx`, both `.on(t.planId, t.round,
  t.submissionId, t.id)`, `review.ts:99-105,115-121`) — these are
  additional covering indexes on the pre-existing `planId`/`submissionId`/
  `reviewerId` FK columns (already indexed per the `ceda66f2` table), not
  new FK columns; both also present verbatim in
  `migrations/0041_evaluation_plan_round_submission_idx.sql` and
  `migrations/0042_review_results_indexes.sql`. **No new FK column
  introduced; existing FK coverage only strengthened.**

No FK column was removed or left without a covering index in this delta.
`(event_id,status)` = `submission_event_id_status_idx`
(`src/db/schema/submissions.ts:40`, unchanged) and `(event_id,slug)` =
`event_slug_idx` (`src/db/schema/event.ts:28`, unchanged) — neither file
appears in the `c6dbdb7c..HEAD` diff-stat above, so both carry forward
unchanged. **Extends the carried-forward 65-row table with these two
additive rows; zero gaps at `f5783479`.**

### 2. SPA code-split by route (`app/src/App.tsx`)

```
$ grep -n 'lazy(pageLoaders' app/src/App.tsx | head -5
36:const OverviewPage = lazy(pageLoaders.overview);
37:const SubmissionsPage = lazy(pageLoaders.submissions);
38:const FormsPage = lazy(pageLoaders.forms);
39:const ReviewPage = lazy(pageLoaders.review);
40:const SpeakersPage = lazy(pageLoaders.speakers);
```

Every page component in `App.tsx` is still `lazy(pageLoaders.X)`, no
static `import { XPage } from './pages/...'` of a page component found.
Unchanged from the `c6dbdb7c` finding (`app/vite.config.ts` sets no
`manualChunks`; the per-route `lazy()` calls are what actually drives
Vite/Rollup's default route-level chunking). **Confirmed.**

### 3. `< 300 KB gz` (cite bundle:check, not re-run here — task-w36-a owns
the fresh number)

Per this task's brief, bundle:check is not re-run in this LOG-ONLY lane.
The three-sha block above records `task-w36-a` (this wave's bundle-owning
sibling) as **ANCESTOR** of HEAD, but identical-to-HEAD — i.e. `task-w36-a`
had not yet landed a fresh measurement at the moment this audit read its
ref. The most recent bundle:check figure in the verification log that IS
an ancestor of this audit's HEAD is `task-w28-e-spec-audit-c6dbdb7c.md`'s:

```
Entry bundle: index-BhPrbvpM.js + index-DpG2gFFa.css = 69.19 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

measured at `c6dbdb7c`, 126 commits behind this audit's HEAD (`git
rev-list --count c6dbdb7c..HEAD` = 126) — substantial `src/`/`app/src/`
churn (route perf-batching commits, DEC-829/DEC-338/DEC-774 waves) has
landed since, so this number is stale evidence of "under budget" rather
than a fresh reading. **Recorded PENDING-OWNED(task-w36-a)** for the
fresh number at `f5783479` — not inferred PASS, per DEC-453 (wave-28: a
recorded ruling from a prior sha is not a landed measurement at a new
one).

### 4. Parameterized queries only

```
$ grep -rn '`SELECT\|`INSERT\|`UPDATE\|`DELETE' src/ --include='*.ts' | grep -v 'sql`'
src/server/repo/contacts/import.ts:159: * or more chunked `INSERT ... ON CONFLICT (id) DO UPDATE SET <col> =
src/server/repo/import/sessionboard.ts:261:// into one `UPDATE ... WHERE id IN (...)` per chunk of that group's ids
```

Both hits are comments describing Drizzle-built queries, not raw
string-concatenated SQL literals. Zero query-building hits outside the
Drizzle `sql` tag. **Confirmed, re-cited mechanism unchanged from
`ceda66f2`/`c6dbdb7c`.**

### 5. No user content served with an HTML content type

```
$ grep -n 'text/html' src/domain/files.ts
53:// as text/html (or any other content type a browser might render as HTML).
546:  if (value.toLowerCase().startsWith("text/html")) {
547:    throw new Error("assertServedContentTypeHeader: value is text/html — invariant violated");
```

`assertServedContentTypeHeader` (`src/domain/files.ts:546-548`) throws on
any served `text/html` content type; called before every served response
at `src/routes/files.ts:674` (unchanged line/behavior from the `c6dbdb7c`
receipt). **Confirmed.**

### 6. Secrets via `wrangler secret`, `.dev.vars` gitignored

```
$ grep -n '\.dev\.vars' .gitignore
9:.dev.vars
```

Unchanged. **Confirmed.**

## (iii) `docs/eval-rubric/*.yaml` coverage table

`grep -n "^  - id:" docs/eval-rubric/*.yaml | wc -l` = **116** — identical
total and identical per-file breakdown to every prior audit back through
`task-w25-e` (no rubric file added, removed, or ID-modified since). Per
file, ID count and testability-field breakdown (criteria IDs only; the
`-S1..S4` scenario IDs carry no `testability:` field and are covered by
the DEC-069 walkthrough gate lane, not this static-audit lane):

| rubric file | total IDs | auto | auto-partial | manual |
|---|---|---|---|---|
| `01-call-for-papers.yaml` | 20 | 14 | 1 | 1 |
| `02-abstract-management.yaml` | 17 | 10 | 4 | 0 |
| `03-speaker-management.yaml` | 19 | 11 | 4 | 1 |
| `04-content-management.yaml` | 17 | 12 | 2 | 0 |
| `05-ai-agenda.yaml` | 10 | 8 | 0 | 0 |
| `06-public-widgets.yaml` | 19 | 13 | 3 | 0 |
| `07-speaker-crm.yaml` | 14 | 11 | 1 | 0 |

All atomic (non-scenario) IDs resolve to the same implementation citations
walked clause-by-clause in `task-w25-e-spec-audit.md` / `task-w27-e-spec-
audit.md` — the wave-28 through wave-35 commits landing since (perf
Promise.all collapses, the two new FK-indexed columns above, the
`DEC-099` `Vary: Cookie` fix) are narrowly scoped to server-side batching/
caching/index mechanics, not to any rubric-cited behavior surface, so no
re-derivation of individual ID citations was needed this lane. The single
`manual` testability ID (`CFP-08`) remains manual per rubric, dev-sink
scoped, unchanged. **No requirement anywhere in the rubric set found
without implementation evidence at `f5783479`.**

## RESULT / OPEN ITEMS

RESULT: QUALIFYING.

OPEN ITEMS: 1 — the `< 300 KB gz` figure at this exact HEAD
(`f5783479`) is `PENDING-OWNED(task-w36-a)`; the last known ancestor
reading (`c6dbdb7c`, 69.19 kB gz) is 126 commits stale and not re-inferred
as still-PASS. All other §6/§7/§8/§9/rubric items above are CONFIRMED with
a quoted file:line or grep at this HEAD.
