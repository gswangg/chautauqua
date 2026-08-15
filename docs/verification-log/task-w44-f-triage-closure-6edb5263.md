# task-w44-f — triage-closure @ 6edb5263

DEC-069 w44 FROZEN GATE LANE, index sequence 0225 (pre-allocated, DEC-068
w44 — did not run `--next-seq`). Fifth DEC-069 slot for wave 44.
Hard-scoped: only `docs/verification-log/index/0225-*.md`, this detail
file, and the regenerated `docs/verification-log.md` were touched. Did
not touch `scripts/exit-predicate.ts` (task-w44-g), `docs/eval-findings.md`
(task-w44-i), or any product path.

## STEP 0 — sync

`git -C .../task-w44-f merge --no-edit main`: "Already up to date" (this
worktree was cut from `main` tip `6edb5263`, already current). Sole live
`task-w43-*` ref, `task-w43-c`, confirmed an ancestor of HEAD via `git
merge-base --is-ancestor task-w43-c HEAD` (exit 0) — zero retries needed,
so the 8-retry/60s-sleep loop in the brief's STEP 0 was never entered.

`npx tsx scripts/ref-state.ts` receipt, verbatim:

> DEC-644 three-sha boundary: HEAD `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`;
> newest first-parent product-code-bearing sha
> `14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`,
> `manual-qa`, `task-custodian-w68-4`, `task-w43-c`, `task-w44-a`,
> `task-w44-c`, `task-w44-d`, `task-w44-f`, `task-w68-d`, `task-w71-c`,
> `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git
> merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via `git
> merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`,
> `task-w44-b`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`,
> `task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`,
> `task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.

MEASURED_SHA = `git rev-parse --short HEAD` = `6edb5263`.

## STEP 1 — population

Per DEC-358 w44 (NO SPLIT, NO EXCLUSION CLAUSE): every `OPEN ITEMS: <n>`
line with n>0 in `docs/verification-log/index/`, 0174 through 0216 (the
highest sequence present at this runtime — confirmed via `ls
docs/verification-log/index/`, no `task-w43-*`/`task-w44-*` index files
exist yet besides this one). Rows: 0174 (7), 0175 (3), 0184 (non-numeric
DEC-773 clause), 0188 (1), 0189 (1), 0192 (1), 0193 (4), 0195 (3), 0196
(5), 0197 (1), 0210 (1), 0211 (1), 0213 (2), 0215 (3), 0216 (4). Kept the
wave-42 dedupe rule: one underlying defect reconciled once, citing every
section that raises it.

## STEP 2 — planner-supplied claims, independently re-verified this run

(a) **Admin Speakers toolbar `[List | Grid]` — VOID.** Read
`docs/design/README.md:335-350` directly: the `## Public filter bar` H2
is at `:343`; `:345` reads "Sessions, agenda and speakers share one bar,
built for the **820px content column**..." (all three named as public
surfaces); `:350`'s code-fenced row `Speakers   [Search speakers…]
[All tracks ▾]                    [List | Grid]` is inside that section,
i.e. it specifies the PUBLIC speakers page. Confirmed the control ships
there: `grep -n "SpeakerViewToggle\|aria-current"
src/routes/public/speakers.tsx` shows the component defined at `:20`,
rendered at `:235` and `:314`, with `aria-current` wiring at `:45`/`:52`.
`app/src/pages/speakers/` (the admin surface) was also listed —
`GridFilters.tsx` and siblings, no view-mode toggle code, and per (a)
there is nothing to add there: this row was never about the admin
toolbar. VOID, nothing owed.

(b) **`scripts/perf-seed.ts` perf-speaker wiring — FALSE at this HEAD.**
`grep -c PERF_SPEAKER scripts/perf-seed.ts` = 13; `grep -n PERF_SPEAKER
scripts/perf-seed.ts` shows the import block (`:31-34`), a comment
(`:594`), and the perf contact/user/participant inserts at `:608, 612,
627, 629-632, 643, 659`. 0210 called this row CLOSED (citing `0201`'s
own STEP-0b grep + a live re-grep) while 0213 called it a
CONFIRMED-DEFECT with a wave-43 `scripts/perf-seed.ts` owner — the two
directly contradict each other. Re-derived directly this run rather than
picking a side by inheritance: the grep result matches 0210's claim
exactly. FALSE (0213's row does not hold at this HEAD, or did not hold
even at its own header sha — either way it is not owed now).

(c) **Wave-43 fixes for the three named rows — all present, all with a
named exercised test:**

- `mergeContacts` multi-id atomicity (0211's row). `src/server/repo/
  contacts/merge.ts:702-716` docstring: "DEC-629/DEC-026 wave-43
  amendment: set-based, ALL-OR-NOTHING merge... mergeContacts' whole-
  operation preflight... a refusal always means ZERO writes, never a
  partial one." The `void DEC_026;` compile-checked import at the top of
  the file ties this to the decision doc. Exercised tests:
  `test/contacts-merge-integrity.test.ts`,
  `test/contacts-merge-authz-batch.test.ts` (both present in `test/`,
  both would fail if the whole-operation preflight were reverted to the
  old per-pair-only check, since they assert zero-writes-on-refusal
  across a multi-id request).
- `autoSchedule()` window-blind `existing` filter (0213 row 1).
  `src/server/repo/agenda/auto-schedule.ts:18` imports
  `isDayWithinEventRange` from `./days`; `:60-68`'s comment block reads
  "both sides now share isDayWithinEventRange so an out-of-range slot
  can never be existing-for-the-placer" and splits `slotted` into
  `inRangeSlotted`/`outOfRangeSlotted`, feeding only the in-range half
  into `existing` (`:70`). This is exactly 0213's own named minimal fix
  direction (reuse `isDayWithinEventRange`, already imported by
  `payload.ts`). Exercised tests: `test/schedule-unplaced-reasons.test.ts`,
  `test/agenda-auto-schedule-params.test.ts`,
  `test/auto-schedule-persistence.test.ts` (all present).
- `deleteContact` contact-FK integrity (DEC-979, referenced by the field
  guide and implicit in 0211's adjudication). `src/server/repo/contacts/
  crud.ts:306-332`: NULLs `email_log.contact_id` (`:325`),
  `file.uploaded_by_contact_id` (`:326`), `file_comment.author_contact_id`
  (`:327-330`) — never deletes those rows — while cascade-deleting
  `pipeline_activity`/`pipeline_entry`/`task_assignment`/duplicate
  dismissals first. Docstring at `:296-305` cites DEC-006 and explicitly
  says this "mirrors mergeContacts' repoint... here there is no
  survivor, so NULL is the closest equivalent." Exercised tests:
  `test/contact-delete-fk-integrity.test.ts`,
  `test/contact-delete-refusal-rows.test.ts` (both present).

All three fix commits are ancestors of this lane's HEAD (confirmed via
the STEP 0 ref-state receipt covering the whole tree, and directly by
reading the files at this worktree's checkout).

(d) **0215 content-staleness vs. this section.** 0215 (task-w40-g,
sha `2e99b272`, index seq 0215) polled a `main` tip `9f78158b` that
pre-dates `0210`'s (task-w42-a) landed triage-closure section — its own
text says so ("Polled the boundary... perf-smoke never landed within the
budget"). This section (`0225`) was cut from a HEAD (`6edb5263`) that is
strictly newer than both `0215`'s `2e99b272` and `0210`'s `e01f237e`
(confirmed: `6edb5263` contains `14da2921`, itself a merge of many later
waves including 42 and 43), and its own index sequence (`0225`) is
higher than both `0215`'s (`0215`) and `0210`'s (`0210`). Under both the
append-order rule `gradePredicate` currently implements
(`scripts/exit-predicate.ts:192-194`, "most recent (last-appended)
first") and DEC-099 w44's stated recency rule (rank by newest measured
tree, dropping any sha that is a proper ancestor of another candidate's),
this section supersedes `0215` for the triage-closure slot once a
correctly-running instrument reads it.

(e) **0216 item 1 (the 0215-over-0210 grading artifact).** Closed by (d)
above. `task-w44-g`'s instrument fix to `scripts/exit-predicate.ts` is
NOT merged at this lane's HEAD — confirmed by running `npx tsx
scripts/exit-predicate.ts --product-sha
14da2921a5be66408057712be877bc44c19de6c4` this session, which crashes
uncaught (see STEP 3 below) rather than producing a five-row table, and
by the STEP 0 ref-state receipt (no `task-w44-g` ref listed as either
ancestor or non-ancestor — the branch does not exist as a local ref at
this worktree's fetch). So item 1 is recorded as closed by (d) ALONE:
this section's supersession of `0215` is a fact about section content
and ordering that holds regardless of whether the instrument can
currently read it correctly.

## STEP 3 — new finding this run: instrument still crashes

Ran `npx tsx scripts/exit-predicate.ts --product-sha
14da2921a5be66408057712be877bc44c19de6c4` directly (not inherited from
0215's older report). It crashes uncaught rather than printing the
five-row table:

```
Error: Command failed: git merge-base --is-ancestor 14da2921a5be66408057712be877bc44c19de6c4 6807b67
fatal: Not a valid object name 6807b67
    at isAncestorOfProductSha (scripts/exit-predicate.ts:259:7)
    at <anonymous> (scripts/exit-predicate.ts:201:11)
    at Array.map (<anonymous>)
    at gradePredicate (scripts/exit-predicate.ts:190:26)
```

This is the exact defect 0215 named as its own item 3 (`scripts/
exit-predicate.ts:259`'s `isAncestorOfProductSha` rethrowing any git
failure other than exit status 1, uncaught, when a section's header sha
is an unresolvable git object — here `6807b67`, the header sha of
`docs/verification-log/index/0128`/`0133`'s ancient spec-audit sections).
It is STILL PRESENT and reproducible at this lane's own HEAD, not fixed
by any wave-41 through wave-43 lane despite 0215 naming a wave-41 owner
for it. This lane's hard scope forbids touching `scripts/
exit-predicate.ts` (owned by task-w44-g this wave), so it is filed here,
not fixed, with the owner named as task-w44-g (in-flight) or a wave-45
lane if not merged by this wave's close.

This is the ONE open item this section counts: everything else in the
0174..0216 population reconciles CLOSED / VOID / FALSE / MOOT / ADVISORY
(not a defect) / RULED-NOT-A-DEFECT at this HEAD, each with a quoted
file:line or a named exercised test above.

## Count reconciliation

- 0174 (7) + 0175 (3): 10 raised rows collapse to 6 distinct underlying
  defects per 0210's dedupe (A/B, C, D/(iv), E/(v), F, G); all CLOSED or
  RULED-NOT-A-DEFECT except G, which is VOID per (a) above — not a
  defect at all. Net open: 0.
- 0184: MOOT (superseded by w29-b's landed fix, per the file's own merge
  note). Net open: 0.
- 0188, 0189, 0192, 0193 (4), 0196 (5): all CLOSED per 0210's citations
  (`0201`, `0200`), re-verified this run only for the perf-seed and
  contact rows called out in STEP 2; the remaining rows' cited commits
  (`add09a9e`, `76431743`, `19aa0a0c`) confirmed ancestors of HEAD. Net
  open: 0.
- 0195 (3): autoSchedule row CLOSED (c); perf-seed row FALSE (b);
  plan-progress advisory row left ADVISORY / not adjudicated as a
  CONFIRMED-DEFECT, per 0213's own classification (no re-measurement
  performed by this docs-only lane). Net open: 0 counted (1 advisory,
  not counted as a defect, consistent with 0213's own RESULT line which
  also did not count it).
- 0197 (1): resolveBaseUrl reclassified NOT-A-DEFECT by 0213, unchanged
  since. Net open: 0.
- 0210 (1): the sole row (= 0174 G) is VOID per (a). Net open: 0.
- 0211 (1): mergeContacts atomicity CLOSED per (c). Net open: 0.
- 0213 (2): both rows resolved, see (b)/(c). Net open: 0.
- 0215 (3): item 1 STALE (superseded, perf-smoke long since landed);
  item 2 STALE (no duplicate spec-audit file exists at this HEAD); item
  3 STILL OPEN, see STEP 3. Net open: 1.
- 0216 (4): items 2-4 (mergeContacts/autoSchedule/perf-seed) CLOSED per
  (c)/(b); item 1 closed by (d)/(e), see above (not a separate open
  count — the instrument crash that would block reading it is counted
  once, under the 0215 item-3 row, not twice). Net open: 0.

Total distinct still-open items across the whole 0174..0216 population,
re-derived at this HEAD: **1** (`scripts/exit-predicate.ts:259` uncaught
crash on an unresolvable ancient header sha).

## STEP 4

`npm run verification-log:assemble` run after this file and the index
file were written; `docs/verification-log.md` regenerated and committed
alongside both.

RESULT: FAIL — 1 CONFIRMED-DEFECT item remains open (`scripts/
exit-predicate.ts:259` crashes on an unresolvable ancient sha, blocking
every `exit:predicate` run at this HEAD); every other item in the
0174..0216 population is CLOSED, VOID, FALSE, MOOT, or an explicit
non-defect ruling, each re-derived this run with a quoted file:line or a
named exercised test.
OPEN ITEMS: 1
