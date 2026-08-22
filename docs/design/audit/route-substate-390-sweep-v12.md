# Route sub-state 390 sweep — the three widened rows re-measured live (DEC-144 wave-23 amendment)

Task w23-f (DEC-144 wave-23 amendment) widened `app/src/routeManifest.ts`
with the three closed-set query sub-states
`docs/design/audit/route-substate-coverage-v12.md` had rostered as
unvisited: `/admin/settings?section=your-data&edit=1&intent=new`,
`/admin/contacts?import=1`, and
`/admin/submissions/seed_submission_0001?history=0`. Widening the manifest
widens the population the live 390 render sweep
(`npm run gate:render-sweep`, `scripts/render-sweep-lib.ts`'s
`ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING`) walks, so this doc records
the re-measurement task w23-f itself performed and the classification of
every new sighting against
`docs/design/audit/admin-390-interactive-offenders-w27.md`'s four
exemption idioms.

## How this was measured

- Command: `npm run gate:render-sweep` (`tsx scripts/render-sweep.ts`), run
  to completion once in this task's worktree, after the manifest widening
  landed. Self-boots a migrated + seeded `wrangler dev` on an OS-ephemeral
  local port, killed by its own PID on exit — no `--remote`, no fixed
  port, no deploy.
- Sha measured: this task's own worktree HEAD (branch `v12m-w23-f`), after
  the `app/src/routeManifest.ts` widening.
- Before this task's widening, `ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING`
  was 77 (`docs/design/audit/admin-390-interactive-offenders-w27.md`).
- Verbatim tail of the `admin mobile interactive offenders` block,
  post-widening (unchanged existing rows omitted for brevity — only the
  routes touched by the widening are shown; the full roster is
  `docs/design/audit/admin-390-interactive-offenders-w27.md`'s 13-row
  table plus the two new routes below):

```
render-sweep: admin mobile interactive offenders (DEC-253/DEC-367/DEC-808)...
  /admin/submissions/seed_submission_0001?history=0: 1 offender(s): input.chq-check w=18px h=18px
  /admin/contacts?import=1: 25 offender(s): input.chq-check w=18px h=18px (x25)
render-sweep: admin mobile total interactive offenders: 103 (ceiling 77)
```

- Exit code: non-zero, as expected — `ADMIN_MOBILE_PASS_BLOCKING` is
  `true` and the printed total (103) exceeded the pre-widening ceiling
  (77) until this task's ceiling update landed in the same commit as the
  manifest widening.

## New sightings and their classification

Three widened rows were re-measured. Two produced new interactive
offenders; one produced zero.

### `/admin/settings?section=your-data&edit=1&intent=new` — 0 offenders

The ApiTokensPanel "New token" intent drill contributed no new interactive
offenders at all. Not listed in the offender block; no classification
needed.

### `/admin/contacts?import=1` — 25 offenders, `input.chq-check` w=18×18

Same selector, same box, same count as the already-EXEMPT bare
`/admin/contacts` row (roster row 2 in
`docs/design/audit/admin-390-interactive-offenders-w27.md`). The importer
overlay (`showImport = true`) renders on top of the same `ContactsTable`,
so its `input.chq-check` row-select checkboxes are the identical DOM
population, still wrapped in `<label className="chq-check-hit">`
(`app/src/check-hit-receipt.scan.test.ts`'s receipted population;
`min-height:44px; min-width:44px; padding:13px; margin:-13px;` in
`app/src/styles.css`'s terminal `@media (max-width:700px)` block).

**Classification: EXEMPT — idiom 2** (wrapping `.chq-check-hit` label).
The raw `<input>` box is unchanged (18×18); this is not a new defect, it
is the same already-exempted population becoming reachable at a second
URL.

### `/admin/submissions/seed_submission_0001?history=0` — 1 offender, `input.chq-check` w=18×18

Same selector, same box, same count as the sibling
`/admin/submissions/seed_submission_0001` and
`/admin/submissions/seed_submission_0001?edit=1` rows (roster rows 4-5 in
`docs/design/audit/admin-390-interactive-offenders-w27.md`) — the
`SubmissionDetailPage.tsx` row-select checkbox is unaffected by
`historyOpen`'s collapsed/expanded state; it is the same `.chq-check-hit`
population as the other sub-states of this same base route.

**Classification: EXEMPT — idiom 2** (wrapping `.chq-check-hit` label).
The raw `<input>` box is unchanged (18×18); same route, third query
sub-state, identical DOM structure.

## Ceiling update

`ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING` (`scripts/render-sweep-lib.ts`)
moved 77 → **103** in the same commit as the manifest widening and this
doc. 103 = 77 (prior measured total) + 25 (`/admin/contacts?import=1`) + 1
(`/admin/submissions/seed_submission_0001?history=0`) + 0
(`?section=your-data&edit=1&intent=new`). Both non-zero additions are
EXEMPT — idiom 2, matching their sibling routes' already-established
classification; this is the population growing at fixed density, not a
new class of defect. No CSS changed under DEC-385's terminal
`@media (max-width: 700px)` blocks in this task; desktop and the
previously-measured 77 rows are byte-for-byte unchanged.
