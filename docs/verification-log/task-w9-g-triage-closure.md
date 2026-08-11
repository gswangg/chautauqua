# task-w9-g — triage-closure @ 38860f9

Wave-9 exit-gate battery capstone (DEC-069/139/176/177/178 rebinding).
LOG-ONLY: appends only to `docs/verification-log.md` and this file;
`docs/eval-findings.md`, `decisions/`, `src/decisions.ts`,
`field-guide/` untouched.

## STEP 1 — sha derivation

DEC-178 names S "the `merge task-w9-a` commit." Two commits with that
literal message exist in this worktree's full history (`8026fad`,
`56ddb09`), but `git merge-base --is-ancestor 2dd2f33 8026fad` and the
same check against `56ddb09` both fail — both predate `2dd2f33` and
are first-campaign homonyms per DEC-129, not this campaign's work.

All five already-merged wave-9 siblings independently reached the same
conclusion and recorded it in `docs/verification-log.md`: the actual
DEC-178 harness-closure code lane (scripts/**-only, DEC-173/174/175)
landed under the reused/stale branch name `task-w8-a` (commit
`52dd2b2`, merged as `38860f9` "merge task-w8-a") — a
wave-relabeling naming artifact, not a functional gap. This section
adopts `S = 38860f9` for consistency with every sibling.

`git merge-base --is-ancestor 2dd2f33 38860f9` — exit 0. Ancestry
holds.

## Precondition grep set (DEC-177/178)

Re-verified directly against `S` via `git show 38860f9:<path>` in this
worktree (all present, no miss):

| anchor | path |
|---|---|
| DEC-167 | `src/domain/contacts.ts:165` |
| ICS_ORGANIZER_EMAIL | `src/mail/ics.ts:15` |
| "unknown track id" | `src/routes/api/forms.ts:113` |
| "anonymized === false" | `src/server/repo/files.ts:153` |
| openDate | `app/src/pages/review/PlanEditor.tsx:107,143` |
| FORM_TASK_FIELD_SPECS / DEC-174 | `scripts/seed.ts:19,909,931,975` |
| DEC-173 | `scripts/walkthrough/public.ts:440`, `speaker.ts:923` |
| DEC-175 | `scripts/walkthrough/producer.ts:773-792`, `speaker.ts:1156-1197`, `review.ts:312-632` |

## STEP 2 — sibling check

`docs/verification-log.md` contains all five required wave-9 sections,
every one citing `S = 38860f9` and every one ending `RESULT: PASS`:

- `task-w9-b — build+test @ 38860f9` — PASS, 151 test files / 1332
  tests, 0 failures.
- `task-w9-c — walkthrough @ 38860f9` — PASS, 6/6 modules, DEC-174/
  DEC-173/DEC-175 all re-confirmed live.
- `task-w9-d — perf-smoke @ 38860f9` — PASS, all budget rows `ok`
  across two runs.
- `task-w9-e — render-sweep @ 38860f9` — PASS, 31/31 routes,
  explicitly re-confirming the two previously-failing routes now pass.
- `task-w9-f — spec-audit @ 38860f9` — PASS, OPEN ITEMS 0, full
  DEC-167..172 regression-coverage audit + README/CI/SPEC §9 audit.

No sibling absent, no sibling FAIL. Battery complete — proceeding to
STEP 3.

## STEP 3(a) — supersession of the two long-open FAIL threads

**Render-sweep.** `task-w4-e — render-sweep @ d8d1cbd` and
`task-w5-e — render-sweep @ 64ec7de` both recorded `RESULT: FAIL` for
the identical 2-of-31 route set:
1. `/admin/review/plans/seed_evaluation_plan_0001` (organizer SPA) —
   empty `#root`, `TypeError: Cannot read properties of undefined
   (reading 'includes')`.
2. `/portal/tasks/seed_task_assignment_0001/form` (speaker SSR) — HTTP
   400 instead of 200.

Both superseded at `S=38860f9` by `task-w9-e — render-sweep @
38860f9` (31/31 PASS, explicitly calling out both routes now clean —
DEC-171's `openDate` wire-name fix in `PlanEditor.tsx` and DEC-172's
`FORM_TASK_FIELD_SPECS`-backed seed fix in `scripts/seed.ts`) and
independently reproduced by `task-w8-e — render-sweep @ 38860f9`
(also 31/31 PASS at the same `S`).

**Walkthrough.** `task-w5-c — walkthrough @ 64ec7de` recorded
`RESULT: FAIL` for two harness/seed-coupling bugs (not product
defects, per that section's own root-cause analysis): the speaker
"find my own general task" round-trip, and the public `/speakers`
alphabetical-ordering check whose extractor regex didn't tolerate an
`<a>` nested inside `<strong>`. Superseded at `S=38860f9` by
`task-w9-c — walkthrough @ 38860f9` (6/6 modules PASS, explicitly
re-confirming both prior FAIL points now pass — DEC-174's onboarding
override, DEC-173's anchor-tolerant extractor) and independently
reproduced by `task-w8-c — walkthrough @ 38860f9` (also 6/6 PASS).

## STEP 3(b) — live PLANNER: marker harvest

`git log --format='%h %B' 2dd2f33..HEAD | grep -n '^PLANNER:'` — zero
hits. (Bolded prose labels such as "**PLANNER flag**" inside a log
entry's body, e.g. in `task-w4-g`, are not literal commit-message
`PLANNER:` markers and correctly do not match this grep.) No live
marker to disposition.

## STEP 3(c) — eval-findings.md SWARM ROUND MANDATE closure (citation only)

`docs/eval-findings.md:9` `## SWARM ROUND MANDATE`. In-tree closure
evidence already recorded:

- `task-w4-g — triage-closure @ d8d1cbd`, `docs/verification-log.md`:
  Section A CLOSED (~line 4103), Section B CLOSED (~line 4113),
  Section C CLOSED by weight (~line 4140), Section D CLOSED
  (~line 4177), Section E CLOSED (~line 4201), Section F CLOSED
  (~line 4207). `OPEN ITEMS: 0`.
- `task-w5-f — spec-audit @ 64ec7de`, `docs/verification-log.md`
  STEP 2b (~line 4682): independent file:line re-citation of the same
  Sections A-F, all closed. `OPEN ITEMS: 0`, `RESULT: PASS`.

Both predate `S=38860f9`; the only code-bearing commits between them
and `S` are the six wave-6 fix lanes (DEC-167..172) and the w8-a/w9-a
harness-closure lane (DEC-173/174/175) — already classified by
`task-w9-f`'s delta-scope audit (`docs/verification-log.md:5027-5040`)
as not touching any eval-findings-cited file outside that known set.
Closure holds at `S`.

## STEP 3(d) — full-ledger RESULT: FAIL sweep

Enumerated every `## ... @ <sha>` section in `docs/verification-log.md`
from `task-w4-f` (first campaign-3 section) onward, filtered to
sections whose cited sha is a descendant of `2dd2f33`. Twenty
campaign-3 sections found; exactly three end `RESULT: FAIL`, all three
already dispositioned in STEP 3(a):

1. `task-w4-e — render-sweep @ d8d1cbd`
2. `task-w5-e — render-sweep @ 64ec7de`
3. `task-w5-c — walkthrough @ 64ec7de`

No other campaign-3 `RESULT: FAIL` found. All remaining `RESULT: FAIL`
hits in the file cite pre-`2dd2f33` shas (first-campaign homonyms per
DEC-129: `d12eb25`, `3b7ed3d`, `3543f09`, `5692a6d`, the wave-11/12
clusters, etc.) and are out of scope for this sha's exit predicate —
already swept and dispositioned by the earlier
`task-w16-e`/`task-w17-a`/`task-w17-b` triage-closure lineage within
that campaign.

## STEP 3(e) — build + test

`npm ci --prefer-offline --no-audit --no-fund --silent`: clean.
`npm run build`: PASS — dual `tsc --noEmit` + `vite build`, 131
modules, 0 errors.
`npm test --silent`: PASS — **151 test files / 1332 tests**, 0
failures — matches every wave-9 sibling's independently-recorded count
at the same `S`.

## Result

All of (a)-(e) clean. Six PASS sections at one S (`task-w9-b/c/d/e/f`
+ this triage-closure section), both long-open FAIL threads
superseded, no live PLANNER: marker, eval-findings mandate closure
re-confirmed by citation, no other unresolved FAIL in the ledger,
build+test green.

**OPEN ITEMS: 0**

**RESULT: PASS**
