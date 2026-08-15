## 2026-08-15 task-w44-f — triage-closure @ 6edb5263

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

STEP 0 receipt (`npx tsx scripts/ref-state.ts`, verbatim): DEC-644
three-sha boundary: HEAD `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`;
newest first-parent product-code-bearing sha
`14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w43-c`, `task-w44-a`,
`task-w44-c`, `task-w44-d`, `task-w44-f`, `task-w68-d`, `task-w71-c`,
`task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git
merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed): `mail-rich-
shape-fallback`, `task-w17-i`, `task-w44-b`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a..j`. `task-w43-c` is the sole
live wave-43 ref and it IS an ancestor of HEAD (`git merge --no-edit
main` reported "Already up to date", zero retries needed); no other
`task-w43-*` ref still exists (merged/deleted per field guide).
MEASURED_SHA = `git rev-parse --short HEAD` = `6edb5263`.

STEP 1 POPULATION (DEC-358 w44, NO SPLIT, NO EXCLUSION CLAUSE): every
`OPEN ITEMS: <n>` line with n>0 in `docs/verification-log/index/`,
sections 0174 through 0216 (highest present at this runtime): 0174 (7),
0175 (3), 0184 (non-numeric, DEC-773 clause), 0188 (1), 0189 (1), 0192
(1), 0193 (4), 0195 (3), 0196 (5), 0197 (1), 0210 (1), 0211 (1), 0213
(2), 0215 (3), 0216 (4). Dedupe rule kept (one underlying defect
reconciled once, citing every section that raises it).

STEP 2/3 per-row reconciliation table (all re-derived at this lane's own
runtime, none inherited from a prior wave's verdict, per DEC-069
wave-17):

| Underlying item | Raised in | Verdict at 6edb5263 | Evidence |
|---|---|---|---|
| 0174 A/B caret contrast | 0174/0175 | CLOSED | `add09a9e` ancestor of HEAD; `test/caret-inherits-control-ink.scan.test.ts` present |
| 0174 C review-checkbox-label contrast | 0174/0175(vi) | RULED-NOT-A-DEFECT | DEC-426 EXEMPT-BY-RULE, unchanged |
| 0174 D cfp-step-next focus-visible | 0174/0175(iv) | CLOSED | task-w29-c fix, `76431743`/`19aa0a0c` ancestors of HEAD |
| 0174 E review-field-disabled selector | 0174/0175(v) | CLOSED | same task-w29-c fix |
| 0174 F mobile console-error collection | 0174 | CLOSED | `19aa0a0c` ancestor of HEAD |
| 0174 G admin Speakers `[List \| Grid]` toggle | 0174/0210 | **VOID — not a defect at all.** `docs/design/README.md:343` headed "Public filter bar", `:345` names Sessions/Agenda/Speakers as the four PUBLIC surfaces, `:350`'s `Speakers ... [List \| Grid]` row specifies the PUBLIC speakers page, not the admin toolbar. The control exists: `SpeakerViewToggle` (`src/routes/public/speakers.tsx:20`, rendered `:235`/`:314`, `aria-current` `:45`/`:52`). Nothing owed in `app/src/pages/speakers/**`. | verified this run, README.md + speakers.tsx read directly |
| 0184 files-library headshot-join perf | 0184 | MOOT, superseded | file's own MERGE NOTE: product change not taken, w29-b's indexed-FK route (`c50e56f3`) landed instead and measures the same PASS; nothing owed |
| 0188 caret-contrast instrument gap | 0188 | CLOSED | `76431743` ancestor of HEAD |
| 0189/0193#2/0196#2 plan-progress perf unstable | 0189/0193/0196 | CLOSED | `0201`, 3/3 PASS, ancestor of HEAD |
| 0192/0196#5 bundle-size PENDING-OWNED | 0192/0196 | CLOSED | `0200`, 69.20 kB gz first-hand |
| 0193#1/0196#1 reviewer queue perf | 0193/0196 | CLOSED | `0201`, 3/3 PASS |
| 0193#3/0196#3/0195/0213 perf-seed.ts perf-speaker wiring gap | 0193/0195/0196/0213 | **FALSE at this HEAD.** `grep -c PERF_SPEAKER scripts/perf-seed.ts` = 13; perf contact/user/participant inserts at `scripts/perf-seed.ts:608,627,643,659`. 0210 (CLOSED) and 0213 (CONFIRMED-DEFECT) contradicted each other on this row; re-derived directly this run and 0210's CLOSED verdict is the one that holds. | own grep this run |
| 0193#4/0196#4 perfSpeakerAcceptedIndexes / portal-fixup | 0193/0196 | CLOSED | `0201`'s three portal rows via documented recipe |
| 0195 autoSchedule320 / 0213 row 1 window-blind `existing` filter | 0195/0213 | **CLOSED.** `src/server/repo/agenda/auto-schedule.ts:60-68` now shares `isDayWithinEventRange` (imported `:18`) with `payload.ts`, splitting `slotted` into `inRangeSlotted`/`outOfRangeSlotted` so an out-of-window slot can no longer be counted "existing" — exactly 0213's named minimal fix direction. Exercised check: `test/schedule-unplaced-reasons.test.ts` plus `test/agenda-auto-schedule-params.test.ts`/`test/auto-schedule-persistence.test.ts` (all present, would fail if reverted — the shared-window-predicate invariant is the row's whole defect). | wave-43 fix, ancestor of HEAD |
| 0195 plan-progress advisory 0.6ms FAIL | 0195 | ADVISORY, not CONFIRMED-DEFECT, not counted | 0213 itself declined to adjudicate this as a defect ("a fresh measurement... not a code read... before naming a fix owner"); no re-measurement performed by this docs-only lane; carried forward as advisory only, per 0213's own classification |
| 0197/0213 row 2 `resolveBaseUrl` dev-loopback footgun | 0197/0213 | NOT-A-DEFECT (reclassified) | 0213's own read of `src/server/origin.ts:107-136,168-182`, unchanged since; dev-only, stage-2 provisioning resolves it per docs/clarifications.md:33's analogous email framing |
| 0210 sole open row (= 0174 G above) | 0210 | VOID, see above | — |
| 0211/0216#2 mergeContacts multi-id non-atomicity | 0211/0216 | **CLOSED.** `src/server/repo/contacts/merge.ts:702-716` — "DEC-629/DEC-026 wave-43 amendment: set-based, ALL-OR-NOTHING merge" with a whole-operation preflight (comments `:388`,`:410`) so a refusal on any id means ZERO writes. Exercised checks: `test/contacts-merge-integrity.test.ts`, `test/contacts-merge-authz-batch.test.ts` (both present). | wave-43 fix, ancestor of HEAD |
| deleteContact FK-integrity (DEC-979) | field-guide/0211 | CLOSED, confirmed still in force | `src/server/repo/contacts/crud.ts:306-332` NULLs `email_log.contact_id`/`file.uploaded_by_contact_id`/`file_comment.author_contact_id` (never deletes the audit row), deletes `pipeline_entry`/`pipeline_activity`/`task_assignment`/dismissals first. Exercised check: `test/contact-delete-fk-integrity.test.ts`, `test/contact-delete-refusal-rows.test.ts`. | verified this run, ancestor of HEAD |
| 0213 row 2 (= perf-seed row above) | 0213 | FALSE, see above | — |
| 0215 item 1 (absent perf-smoke slot at that lane's older 9f78158b sync boundary) | 0215 | STALE, superseded | perf-smoke (`0201`) has long since landed and is an ancestor of HEAD; the absence was specific to 0215's own earlier, narrower sync boundary |
| 0215 item 2 (duplicate task-w40-d spec-audit index files) | 0215 | STALE, not reproducible | only one `*task-w40-d-spec-audit-14db7b30.md` file exists in `docs/verification-log/index/` at this HEAD (`0200`); no duplicate present |
| 0215 item 3 / instrument crash on unresolvable ancient sha | 0215/0216#1 | **STILL OPEN, CONFIRMED at this HEAD.** `npx tsx scripts/exit-predicate.ts --product-sha 14da2921a5be66408057712be877bc44c19de6c4` crashes uncaught: `Error: Command failed: git merge-base --is-ancestor 14da2921... 6807b67` / `fatal: Not a valid object name 6807b67`, at `isAncestorOfProductSha` (`scripts/exit-predicate.ts:259`), invoked from `gradePredicate` (`:186-208`) via the per-slot `.map` (`:201`). The referenced sha is `docs/verification-log/index/0128`/`0133`'s ancient, unresolvable header — no exit-predicate run at this HEAD produces the five-row table at all (crash, not a graded VOID/MISSING row). Owner: task-w44-g (in-flight this wave, owns `scripts/exit-predicate.ts` per this lane's own hard-scope fence — not touched here). If not merged by wave-44 close: wave-45 lane, `scripts/exit-predicate.ts:259` (treat an unresolvable git object as not-ancestor, or retire the stale `6807b67` section per DEC-099's shrink-only ratchet). | own run this session, verbatim stack trace above |
| 0216 item 1 (0215-over-0210 mechanically-graded grading artifact) | 0216 | **CLOSED by supersession, not by an instrument fix.** This section (`0225`, sha `6edb5263`) carries both a strictly newer measured tree and a higher index sequence than `0215` (sha `2e99b272`) and `0210` (sha `e01f237e`), so under DEC-099 w44's recency rule (newest measured tree wins; append order only among unrelated shas) and the append-order rule alike, `0225` is the section a correctly-functioning `gradePredicate` would now pick for the triage-closure slot — not the content-stale `0215`. The underlying instrument crash (this table's `0215 item 3` row, above) is a SEPARATE, still-open defect that currently prevents `gradePredicate` from running at all, regardless of which triage-closure section it would otherwise pick; task-w44-g's fix (not merged at this HEAD) is what would let a fresh `exit:predicate` run confirm this supersession mechanically. | reasoning per this task's brief (d)/(e); not independently re-verified beyond the crash reproduction above |
| 0216 items 2-4 (mergeContacts / autoSchedule / perf-seed) | 0216 | CLOSED, see rows above | — |

RESULT: FAIL — 1 CONFIRMED-DEFECT item remains open: `scripts/
exit-predicate.ts:259`'s `isAncestorOfProductSha` uncaught-crashes on an
unresolvable ancient header sha (`6807b67`), so no `exit:predicate` run
at this HEAD can produce a five-row table at all. Every other item in
the wave-44 population (0174 through 0216, no exclusion) was
reconciled at this lane's own runtime with a quoted file:line, a named
exercised test, or an explicit VOID/FALSE/MOOT/ADVISORY ruling; the
admin-Speakers-toolbar row is VOID (public-surface spec row, already
shipped there); the perf-seed wiring row is FALSE (13 `PERF_SPEAKER`
refs, wired); the mergeContacts, autoSchedule, and deleteContact-FK
rows are CLOSED by their named wave-43 fixes plus exercised tests, all
confirmed ancestors of this HEAD.

Detail: `docs/verification-log/task-w44-f-triage-closure-6edb5263.md`.

OPEN ITEMS: 1
