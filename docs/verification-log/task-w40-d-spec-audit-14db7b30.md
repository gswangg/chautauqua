# task-w40-d — SPEC static-audit gate @ 14db7b30

QUALIFYING SPEC static-audit lane (DEC-069 required section 4, shape fixed
by DEC-063's wave-27 amendment), also constrained by DEC-644's wave-40
amendment (three-sha boundary block) and DEC-063's wave-35 amendment
(SPEC §9's four cheap invariants are one closed population). FROZEN WAVE:
nothing under `src/`, `app/src/`, `migrations/`, or `package.json` is
touched by this lane — everything below is a read-only grep/diff/build
against the checked-out tree, writes land only under `docs/`.

## DEC-644 wave-40 three-sha boundary block

1. **HEAD** (full sha of this worktree): `git -C
   /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w40-d
   rev-parse HEAD` = `14db7b30fb424954f9a3604563ff6a95ae5d1127` (short
   `14db7b30`) — this is `main`'s tip at the moment this lane's worktree was
   cut (`git merge --no-edit main` reported "Already up to date").

2. **Newest product-code-bearing first-parent sha** — `git log
   --first-parent -1 --format=%H -- src/ app/src/ migrations/ package.json`
   = `ed5c679e59828c5600cb84b51208056f7e38a445` (short `ed5c679e`, `merge
   task-w39-e`). This audit is **INVALIDATED BY** any `src/**`, `app/src/**`,
   `migrations/**`, or `package.json` commit landing after `14db7b30`.

3. **`npm run ref-state` receipt** (verbatim): HEAD `14db7b30`; newest
   first-parent product-code-bearing sha `ed5c679e`; every live ref
   (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w40-a`, `task-w40-b`,
   `task-w40-c`, `task-w40-d`, `task-w68-d`, `task-w71-c`, `task-w71-d`,
   `task-w71-e`) confirmed an **ANCESTOR** of HEAD via `git merge-base
   --is-ancestor`. NON-ancestor refs (not confirmed ancestors of HEAD):
   `mail-rich-shape-fallback`, `task-w17-i`, `task-w68-b`, `task-w68-c`,
   `task-w68-e`, `task-w71-a`, `task-w72-a..j` — none of these match
   `task-w39-*`, so the STEP 0 "ancestry-check every live `task-w39-*`
   ref" requirement is vacuously satisfied: **no `task-w39-*` ref exists
   any longer** (`git branch -a | grep task-w39` — empty output); the
   wave-39 lanes are all merged and deleted per the field guide. No
   re-sync poll was needed.

## (i) SPEC §8/§9 — one-line citations (DEC-063 wave-27: nine consecutive
PASSes retires the section to citation)

Unchanged from every prior audit back through `task-w28-e-spec-audit-
c6dbdb7c.md` (quickstart command match, "For evaluators" persona-credential
table, deploy command, seed-as-grader-package, MIT license) — cited, not
re-derived, per DEC-063.

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

All four `describe(` blocks are present verbatim, unchanged in line number
from the `f5783479` reading. **Confirmed as a closed population, not
re-derived clause-by-clause.**

## (ii) the five §6/§7 static checks (DEC-063 wave-27)

### 1. D1 indexes on every FK + `(event_id,status)` + `(event_id,slug)`
(`migrations/**` + `src/db/schema/**` cross-check since `f5783479`, the
last audit boundary — waves 38-39 landed product code in between)

```
$ git diff --stat f5783479..HEAD -- src/db/schema src/db/schema.ts migrations
$
```

Empty diff-stat. **Zero schema/migrations churn between `f5783479` and
this audit's HEAD (`14db7b30`)** — the previously-derived 65+2-row FK-index
table (last exhaustively re-derived at `ceda66f2`, extended by two
additive rows at `f5783479`) carries forward unchanged. `(event_id,status)`
= `submission_event_id_status_idx` and `(event_id,slug)` = `event_slug_idx`
both unchanged. **Confirmed, zero gaps at `14db7b30`.**

### 2. SPA code-split by route (`app/src/App.tsx`)

```
$ grep -n 'lazy(pageLoaders' app/src/App.tsx
36:const OverviewPage = lazy(pageLoaders.overview);
37:const SubmissionsPage = lazy(pageLoaders.submissions);
38:const FormsPage = lazy(pageLoaders.forms);
39:const ReviewPage = lazy(pageLoaders.review);
40:const SpeakersPage = lazy(pageLoaders.speakers);
41:const ContentPage = lazy(pageLoaders.content);
42:const AgendaPage = lazy(pageLoaders.agenda);
43:const CommsPage = lazy(pageLoaders.comms);
44:const ContactsPage = lazy(pageLoaders.contacts);
45:const ContactsMergePage = lazy(pageLoaders.contactsMerge);
46:const SettingsPage = lazy(pageLoaders.settings);
47:const SubmissionDetailPage = lazy(pageLoaders.submissionDetail);
48:const SpeakerDetailPage = lazy(pageLoaders.speakerDetail);
49:const DeleteSubmissionsPage = lazy(pageLoaders.submissionsDelete);
50:const NotFoundPage = lazy(pageLoaders.notFound);
```

Every page component in `App.tsx` is still `lazy(pageLoaders.X)`, no
static page-component import found. `app/vite.config.ts` sets no
`manualChunks`. **Confirmed.**

### 3. `< 300 KB gz` — run first-hand this wave, discharging exit-ledger
OPEN ITEM 5 (`PENDING-OWNED(task-w36-a)`)

Per DEC-644 w40 (one machine, one heavy gate) this was run inside a
single lock acquisition, vite build immediately preceding bundle:check:

```
$ sh scripts/with-test-lock.sh sh -c 'npm run build && npm run bundle:check'
...
Entry bundle: index-DRSpxsXW.js + index-DpG2gFFa.css = 69.20 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

**This is a first-hand figure measured by this lane at this HEAD
(`14db7b30`), not cited from a sibling.** It discharges exit-ledger OPEN
ITEM 5's `PENDING-OWNED(task-w36-a)` label per DEC-069's wave-39 amendment
(c): the entry bundle is 69.20 kB gzip against a 300.00 kB budget,
essentially unchanged from the `f5783479`-boundary sibling reading
(`task-w36-a-build-test-f5783479.md`'s own 69.20 kB gz) despite two more
waves of product-code churn (38-39) landing since. **Confirmed, well under
budget.**

### 4. Parameterized queries only

```
$ grep -rn '`SELECT\|`INSERT\|`UPDATE\|`DELETE' src/ --include='*.ts' | grep -v 'sql`'
src/server/repo/contacts/import.ts:159: * or more chunked `INSERT ... ON CONFLICT (id) DO UPDATE SET <col> =
src/server/repo/import/sessionboard.ts:261:// into one `UPDATE ... WHERE id IN (...)` per chunk of that group's ids
```

Both hits are comments describing Drizzle-built queries, not raw
string-concatenated SQL literals. Zero query-building hits outside the
Drizzle `sql` tag, unchanged from every prior audit. **Confirmed.**

### 5. No user content served with an HTML content type

```
$ grep -n 'text/html' src/domain/files.ts
53:// as text/html (or any other content type a browser might render as HTML).
546:  if (value.toLowerCase().startsWith("text/html")) {
547:    throw new Error("assertServedContentTypeHeader: value is text/html — invariant violated");

$ grep -n 'assertServedContentTypeHeader' src/routes/files.ts
34:  assertServedContentTypeHeader,
695:  const contentType = assertServedContentTypeHeader(scope.contentType);
```

`assertServedContentTypeHeader` (`src/domain/files.ts:546-548`) throws on
any served `text/html` content type; called before every served response
at `src/routes/files.ts:695` (unchanged mechanism, line renumbered from
`674` at `f5783479` — no behavior change, confirmed by re-reading the
surrounding function). **Confirmed.**

### 6. Secrets via `wrangler secret`, `.dev.vars` gitignored

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

No rubric file was added, removed, or had an ID modified since the
`f5783479` reading. Testability breakdown (auto/auto-partial/manual)
unchanged per file, cited from `task-w36-d-spec-audit-f5783479.md`, not
re-derived — no product-code commit since `f5783479` touches any
rubric-cited behavior surface (schema/migrations diff above is empty;
`git diff --stat f5783479..HEAD -- app/src/App.tsx` — checked below —
confirms the route table is unchanged). **No requirement anywhere in the
rubric set found without implementation evidence at `14db7b30`.**

## RESULT / OPEN ITEMS

RESULT: PASS.

OPEN ITEMS: 0 — all five §6/§7 static checks are CONFIRMED at this HEAD
with a quoted file:line or grep, including a first-hand `< 300 KB gz`
bundle:check reading (69.20 kB gz) that discharges exit-ledger OPEN ITEM 5
(`PENDING-OWNED(task-w36-a)`, per DEC-069's wave-39 amendment (c)). §8/§9
and rubric-coverage sections are unchanged citations. Full receipt pointer:
`docs/verification-log/index/0198-2026-08-15-task-w40-d-spec-audit-14db7b30.md`.
