# 2026-08-10 task-w9-g — triage-closure @ 38860f9

Full detail for the `## 2026-08-10 task-w9-g — triage-closure @ 38860f9` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

LOG-ONLY wave-9 battery capstone (DEC-069/139/176/177/178). Fresh
worktree of `main` tip `916963e` ("merge task-w9-f"), the branch point
after this task's prerequisite `task-w9-e` (and sibling `task-w9-f`)
had already merged. No code touched; only this file and
`docs/verification-log/task-w9-g-triage-closure.md` appended.

**STEP 1 — sha derivation.** DEC-178 names S as "the `merge task-w9-a`
commit." Two commits literally titled `merge task-w9-a` exist in this
worktree's full history (`8026fad`, `56ddb09`), but both predate
`2dd2f33` (`git merge-base --is-ancestor 2dd2f33 8026fad` and `...
56ddb09` both fail) — first-campaign homonyms per DEC-129, not this
wave's work. All five already-merged wave-9 siblings
(`task-w9-b/c/d/e/f`) independently derived the same resolution and
recorded it in their own sections (cited below): the actual DEC-178
harness-closure lane landed under the reused branch name `task-w8-a`
(commit `52dd2b2`, merged as `38860f9`), a wave-relabeling artifact,
not a functional gap — its content is exactly DEC-178's described
sole code-bearing lane (`scripts/**`-only, DEC-173/174/175). Adopting
`S = 38860f9` for consistency with every sibling. `git merge-base
--is-ancestor 2dd2f33 38860f9` — exit 0 (DEC-139 ancestry holds).

DEC-178 precondition grep set, re-verified directly via `git show
38860f9:<path>` in this worktree (no miss): `DEC-167` in
`src/domain/contacts.ts:165`; `ICS_ORGANIZER_EMAIL` in
`src/mail/ics.ts:15`; `"unknown track id"` in
`src/routes/api/forms.ts:113`; `"anonymized === false"` in
`src/server/repo/files.ts:153`; `openDate` in
`app/src/pages/review/PlanEditor.tsx:107,143`; `FORM_TASK_FIELD_SPECS`
+ `DEC-174` in `scripts/seed.ts:19,909,931,975`; `DEC-173` in
`scripts/walkthrough/public.ts:440` and `speaker.ts:923`; `DEC-175` in
`scripts/walkthrough/producer.ts:773-792`, `speaker.ts:1156-1197`,
`review.ts:312-632`. Precondition gate proceeds.

**STEP 2 — sibling check.** `docs/verification-log.md` contains all
five required wave-9 sections, each citing `S = 38860f9` and each
ending `RESULT: PASS`:
- `task-w9-b — build+test @ 38860f9` (line ~5160): PASS, 151 test
  files / 1332 tests, 0 failures.
- `task-w9-c — walkthrough @ 38860f9` (line ~5306): PASS, 6/6 modules.
- `task-w9-d — perf-smoke @ 38860f9` (line ~5078): PASS, all budgets
  `ok`.
- `task-w9-e — render-sweep @ 38860f9` (line ~5130): PASS, 31/31
  routes.
- `task-w9-f — spec-audit @ 38860f9` (line ~5001): PASS, OPEN ITEMS 0.

No sibling absent, no sibling FAIL — battery complete. Proceeding to
STEP 3.

**STEP 3(a) — supersession of the two long-open FAIL threads.**
- Render-sweep: `task-w4-e — render-sweep @ d8d1cbd` (line 3940) and
  `task-w5-e — render-sweep @ 64ec7de` (line 4324) both recorded
  `RESULT: FAIL` — the identical 2/31 route failures
  (`/admin/review/plans/seed_evaluation_plan_0001` empty-`#root`
  TypeError; `/portal/tasks/seed_task_assignment_0001/form` HTTP 400).
  Both are superseded at `S=38860f9` by `task-w9-e — render-sweep @
  38860f9` (line 5130, 31/31 PASS, explicitly re-confirming both
  previously-failing routes now pass — DEC-171's `openDate` wire fix
  in `PlanEditor.tsx` and DEC-172's `FORM_TASK_FIELD_SPECS` seed fix
  in `scripts/seed.ts`) and independently by `task-w8-e — render-sweep
  @ 38860f9` (line 4795, also 31/31 PASS).
- Walkthrough: `task-w5-c — walkthrough @ 64ec7de` (line 4505)
  recorded `RESULT: FAIL` — the speaker "find my own general task"
  round-trip and public `/speakers` alphabetical-ordering check, both
  harness/seed-coupling bugs (not product defects, per that section's
  own root-cause analysis). Superseded at `S=38860f9` by `task-w9-c —
  walkthrough @ 38860f9` (line 5306, 6/6 modules PASS, explicitly
  re-confirming both prior FAIL points now pass: DEC-174's onboarding
  override and DEC-173's anchor-tolerant `/speakers` extractor) and
  independently by `task-w8-c — walkthrough @ 38860f9` (line 4876,
  also 6/6 PASS).

**STEP 3(b) — live `PLANNER:` marker harvest.** `git log
--format='%h %B' 2dd2f33..HEAD | grep -n '^PLANNER:'` — zero hits.
(Note, consistent with prior sibling sections: bolded prose labels
like "**PLANNER flag**" inside `task-w4-g`'s log-entry body are not
literal commit-message `PLANNER:` markers and correctly do not match.)
No live marker to disposition.

**STEP 3(c) — eval-findings.md SWARM ROUND MANDATE closure
(citation only, file not edited).** `docs/eval-findings.md:9` `##
SWARM ROUND MANDATE`. Sections A/B/E/F closure and every Section C
item fixed-or-waived is already recorded in-tree at:
`task-w4-g — triage-closure @ d8d1cbd`, `docs/verification-log.md:4103`
(Section A CLOSED), `:4113` (Section B CLOSED), `:4140` (Section C
CLOSED, by weight), `:4177` (Section D CLOSED), `:4201` (Section E
CLOSED), `:4207` (Section F CLOSED); independently re-confirmed with
file:line source citations by `task-w5-f — spec-audit @ 64ec7de`,
`docs/verification-log.md:4682` (STEP 2b, Sections A-F). Both sections
end `OPEN ITEMS: 0` and both predate `S=38860f9`; no commit touching
any cited file/section landed between their sha and `S` other than the
w6 fix lanes and the w8-a/w9-a harness-closure lane (already covered
by the w9-f delta-scope classification at `docs/verification-log.md:
5027-5040`), so the closure still holds at `S`.

**STEP 3(d) — full-ledger `RESULT: FAIL` sweep.** Enumerated every
`## ... @ <sha>` section from `task-w4-f` (line 3834, this file's
first campaign-3 section) through the end of the file and filtered to
sections whose cited sha descends from `2dd2f33` (`git merge-base
--is-ancestor 2dd2f33 <sha>`). Twenty campaign-3 sections found; three
end `RESULT: FAIL`:
1. `task-w4-e — render-sweep @ d8d1cbd` (line 3940) — superseded, see
   STEP 3(a).
2. `task-w5-e — render-sweep @ 64ec7de` (line 4324) — superseded, see
   STEP 3(a).
3. `task-w5-c — walkthrough @ 64ec7de` (line 4505) — superseded, see
   STEP 3(a).
No other campaign-3 `RESULT: FAIL` found. All non-campaign-3 sections
citing `RESULT: FAIL` in the file (pre-`2dd2f33` shas, e.g. `d12eb25`,
`3b7ed3d`, `3543f09`, `5692a6d`, and the wave-11/12 clusters) are
first-campaign homonyms per DEC-129 and out of scope for this sha's
exit predicate — already dispositioned as such by the earlier
`task-w16-e`/`task-w17-a`/`task-w17-b` triage-closure lineage in this
file (lines 3049-3157) at their own campaign.

**STEP 3(e) — build+test.** `npm ci --prefer-offline --no-audit
--no-fund --silent` clean. `npm run build`: PASS, 0 tsc errors, vite
build clean (131 modules). `npm test --silent`: PASS, **151 test
files / 1332 tests**, 0 failures — matches every wave-9 sibling's
independently-recorded count at the same `S`.

All of (a)-(e) clean.

Full detail: `docs/verification-log/task-w9-g-triage-closure.md`.

OPEN ITEMS: 0

RESULT: PASS
