# task-w42-a: triage-closure @ e01f237e

Read-only closure sweep. LOG-ONLY per DEC-069/DEC-453/DEC-358 — nothing
under `src/`, `app/src/`, `migrations/`, `package.json` touched.
`git rev-parse HEAD` at start (after `git merge --no-edit main`, which
reported "Already up to date"): `e01f237e16ac7a7ef85a7b9f87e761041f538783`
(short `e01f237e`).

## STEP 0 receipt (`npm run ref-state`, verbatim)

> DEC-644 three-sha boundary: HEAD `e01f237e16ac7a7ef85a7b9f87e761041f538783`;
> newest first-parent product-code-bearing sha
> `ed5c679e59828c5600cb84b51208056f7e38a445`; every live ref (`main`,
> `manual-qa`, `task-custodian-w68-4`, `task-w40-e`, `task-w40-g`,
> `task-w41-c`, `task-w42-a`, `task-w42-c`, `task-w42-d`, `task-w68-d`,
> `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD
> via `git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via
> `git merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`,
> `task-w41-a`, `task-w41-b`, `task-w41-d`, `task-w41-e`, `task-w41-f`,
> `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`,
> `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`,
> `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.

None of the non-ancestor refs touch anything in this population (they are
downstream/parallel work, not sources my population cites), so no
re-sync was required beyond the no-op merge already performed.

## Population (fixed by DEC-358 wave 42, not re-derived)

Every `OPEN ITEMS: <n>` line with n>0 in `docs/verification-log/index/`
sections 0174..0201 EXCEPT 0195 and 0197:

- 0174 (task-w28-f, triage-closure @ 3564c774) — `OPEN ITEMS: 7`
- 0175 (task-w28-d, render-sweep @ c6dbdb7c) — `OPEN ITEMS: 3`
- 0188 (task-w35-b, render-sweep @ a0b8501b) — `OPEN ITEMS: 1`
- 0189 (task-w35-a, perf-smoke @ a0b8501b) — `OPEN ITEMS: 1`
- 0192 (task-w36-d, spec-audit @ f5783479) — `OPEN ITEMS: 1`
- 0193 (task-w36-c, perf-smoke @ f5783479) — `OPEN ITEMS: 4`
- 0196 (task-w37-a, stage-1 exit ledger @ 494b6c01) — `OPEN ITEMS: 5`

0195 (task-w36-f, AIE scale battery) and 0197 (task-w37-d, walkthrough
preflight) are EXCLUDED-BY-POPULATION-SPLIT, owned this wave by
task-w42-e. This count does not speak for them — not reconciled, not
counted, not graded here.

## Item-by-item grading

### 0174 (7 items)

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| A | `.chq-participation-menu-caret` contrast 1.02, `/admin/speakers` | CLOSED | `app/src/pages/speakers/speakers.css:390-403` — `color: inherit` replaces `var(--chq-muted)` on the caret (commit `add09a9e`, "Fix participation-menu caret contrast... DEC-830 wave-29"). Guarded against regression by `test/caret-inherits-control-ink.scan.test.ts` (new in the same commit), which fails any `*-caret` rule whose color isn't `inherit`/`currentColor` absent a documented exemption. |
| B | `.chq-participation-menu-caret` contrast 1.02, `/admin/speakers/seed_contact_0001` | CLOSED | Same fix/evidence as A (same CSS rule, different route instance). |
| C | `.chq-review-checkbox-label` contrast 3.09, `/admin/review/plans/seed_evaluation_plan_0001` | RULED-NOT-A-DEFECT | `decisions/DEC-426.md` wave-29 amendment: the measured pair is exactly `--chq-disabled` (`#7D7869`) on `--chq-disabled-bg` (`#DDD8C8`), the WCAG-2.1-SC-1.4.3 "inactive user interface component" exemption applies, and RULING classifies it `EXEMPT-BY-RULE` rather than FAIL. Live-confirmed still measuring 3.09 and reporting `EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component)` as of task-w40-e's render-sweep (`docs/verification-log/task-w40-e-render-sweep-14db7b30.md:70-71`), the newest render-sweep reading in-tree, ancestor of HEAD. `app/src/pages/review/review.css:776-786` (the `.chq-review-checkbox-label` rule) is unchanged since `3564c774` — the ruling, not a CSS change, closes this. |
| D | `.chq-cfp-step-next` focus-visible, keyboard-Tab-unreachable | CLOSED | Diagnosed as an instrument defect (not a product defect) by task-w29-c (`docs/verification-log/task-w29-c-render-sweep-6aa4a438.md:16-22,98-107`): the interaction-state matcher scoped only by `path`, running the focus probe against the wrong `personaRole`/viewport pairing so the phone-only `.chq-cfp-step-next` was probed on the wrong layout. Fixed by adding `viewport`/`personaRole` fields to `InteractionStateEntry` and matching on both (`scripts/render-sweep-lib.ts`, same commit). Live run at that lane's tip: `.chq-cfp-step-next  cfp-primary-focus  focus  PASS`; re-confirmed still PASS, unregressed, by task-w35-b (`docs/verification-log/index/0188...md:26-28`, credited claim `CONFIRMED`) and no commit since `6aa4a438` touches `src/routes/public/cfp.css.ts` or the interaction-state matcher (`git log 6aa4a438..HEAD -- src/routes/public/cfp.css.ts scripts/render-sweep-lib.ts` — only the unrelated mobile-consoleErrors and NAMED_CONTRAST_SELECTOR commits, neither touching this probe). |
| E | `.chq-review-field-disabled .chq-review-checkbox-label` selector never resolved | CLOSED | Same task-w29-c lane: diagnosed as the reviewer-role visit sharing the organizer-role route path, so the disabled-state probe (organizer-only DOM) also incorrectly ran against the reviewer's `ReviewerQueue` (which never renders that element) — same `personaRole` scoping fix. Live row: `.chq-review-field-disabled .chq-review-checkbox-label  review-anonymize-disabled  disabled  PASS`, 3/3 not 4/4 (reviewer-role duplicate no longer fires). Re-confirmed via task-w35-b's claim (iii) `CONFIRMED` (`docs/verification-log/index/0188...md:40-45`), citing `scripts/render-sweep-contrast.ts:77-84,112-115`. |
| F | mobile render-sweep pass has no console-error collection | CLOSED | `scripts/render-sweep-lib.ts:294-296,308` — the mobile route evaluator now computes `consoleErrors` via `filterExpectedStatusConsoleNoise` and pushes a `reasons` entry when non-empty, mirroring the desktop path. Commit `19aa0a0c` ("render-sweep: give mobile pass the console/pageerror channel, DEC-253 w30"). |
| G | admin Speakers toolbar missing `[List \| Grid]` view-mode toggle | **OPEN** | `app/src/pages/speakers/GridFilters.tsx` (whole file grepped, no `viewMode`/`ViewMode`/`List \| Grid` match) — still renders only a search input and task-status select. `docs/design/README.md:350` still specifies the toggle. `git log --all -- app/src/pages/speakers/` shows no commit adding view-mode state since `3564c774`. Owner: wave-43 lane (admin Speakers toolbar List/Grid view-mode toggle; nearest prior owner-candidate `task-w27-g` never landed a fix, only diagnosed). |

### 0175 (3 items — same underlying defects as 0174's C/D/E, cited not re-counted)

| Item | Grade | Evidence |
|---|------|----------|
| (iv) `.chq-cfp-step-next` real-Tab-unreachable | CLOSED | Same defect/fix as 0174 item D. |
| (v) `.chq-review-field-disabled .chq-review-checkbox-label` selector never resolved (reviewer visit) | CLOSED | Same defect/fix as 0174 item E. |
| (vi) `.chq-review-checkbox-label` contrast 3.09 | RULED-NOT-A-DEFECT | Same as 0174 item C — `EXEMPT-BY-RULE`. |

### 0188 (1 item)

| Item | Grade | Evidence |
|---|------|----------|
| `.chq-participation-menu-caret` contrast credited PASS but never enumerated by the gate (instrument gap, not the same sub-issue as 0174 A/B's CSS fix) | CLOSED | `decisions/DEC-426.md` wave-36 amendment + commit `76431743` ("task-w36-e: close task-w35-b's render-sweep contrast instrument gap"): extends the contrast pass with `NAMED_CONTRAST_SELECTOR`, publishing a PASS/FAIL row for `.chq-participation-menu-caret` on every route independent of the page global-minimum offender. Commit message quotes the live re-run: `/admin/speakers` and `/admin/speakers/seed_contact_0001` both read `NAMED-PAIR .chq-participation-menu-caret ratio=6.82 PASS`. `git log 76431743..HEAD -- scripts/render-sweep-contrast.ts` empty — unregressed at HEAD. |

### 0189 (1 item)

| Item | Grade | Evidence |
|---|------|----------|
| `plan progress (page 1)` perf unstable (FAIL/PASS/FAIL vs 50ms budget) | CLOSED | `docs/verification-log/index/0201...md` (task-w40-c perf-smoke @ `2e99b272`, QUALIFYING, ancestor of HEAD): "`plan progress (page 1)` (`src/routes/review/plans-progress.ts`) 23.2/27.6/22.2ms adjusted — the wave-37 exit ledger's other 1-of-3 row now 3 of 3 PASS, CLOSED." Same underlying defect as 0193's non-mandate finding and 0196 triage item 2 — cited together, not triple-counted. |

### 0192 (1 item)

| Item | Grade | Evidence |
|---|------|----------|
| `< 300 KB gz` bundle-size row `PENDING-OWNED(task-w36-a)` | CLOSED | `docs/verification-log/index/0200...md` (task-w40-d spec-audit @ `14db7b30`, RESULT PASS, ancestor of HEAD): "run FIRST-HAND this wave... `Entry bundle: index-DRSpxsXW.js + index-DpG2gFFa.css = 69.20 kB gzip (budget 300.00 kB)` / `bundle:check PASSED`. This own-measured figure discharges exit-ledger OPEN ITEM 5's `PENDING-OWNED(task-w36-a)` label." Same underlying item as 0196 triage item 5 — cited together. |

### 0193 (4 items)

| # | Item | Grade | Evidence |
|---|------|------|----------|
| 1 | `reviewer queue` perf, 1 of 3 runs PASS | CLOSED | 0201: "`reviewer queue` (`src/routes/review/reviewer.ts`) 22.9/23.0/24.8ms adjusted — the wave-37 exit ledger's 1-of-3 row now 3 of 3 PASS, CLOSED." Same defect as 0196 triage item 1. |
| 2 | `plan progress (page 1)` perf unstable (non-mandate finding) | CLOSED | Same as 0189's item / 0196 triage item 2 — 0201 as above. |
| 3 | `scripts/perf-seed.ts` never calls `perf-seed-lib.ts`'s `PERF_SPEAKER_*` insert helpers, blocking the documented recipe | CLOSED | Live grep at HEAD: `grep -c PERF_SPEAKER scripts/perf-seed.ts` = 13 (matches 0201's own STEP-0b precondition grep, same count). 0201: "the documented recipe alone reaches every check including the three portal rows" (no measurement-only D1 fixup used, unlike 0193's own workaround). Same defect as 0196 triage item 3. |
| 4 | `portal home`/`portal tasks`/`portal submission detail` reachable only via a measurement-only local-D1 fixup, not the documented recipe (`perfSpeakerAcceptedIndexes` ordering mismatch, seed order vs actual descending page-1 order) | CLOSED | Live at HEAD: `perfSpeakerAcceptedIndexes` present at `scripts/perf-seed-lib.ts:795-803`, referenced at `scripts/perf-smoke.ts:391` with a comment naming the HIGHEST-seq (descending) convention. 0201: "Three portal rows... all 3/3 PASS, reached via the documented recipe alone (no local D1 fixup needed)" — no 404/warmup failure reported. Same defect as 0196 triage item 4. |

### 0196 (5 triage items — dedupe against 0189/0192/0193 as noted)

| # | Item | Grade | Evidence |
|---|------|------|----------|
| 1 | reviewer queue perf unstable | CLOSED | Same as 0193#1 — 0201. |
| 2 | plan progress (page 1) perf unstable | CLOSED | Same as 0189/0193#2 — 0201. |
| 3 | `perf-seed.ts` missing perf-speaker insert loop | CLOSED | Same as 0193#3 — 0201 STEP-0b grep + live grep at HEAD. |
| 4 | `perfSpeakerAcceptedIndexes` doc-comment/actual-order mismatch | CLOSED | Same as 0193#4 — 0201's three portal rows via documented recipe. |
| 5 | bundle-size `PENDING-OWNED(task-w36-a)` label not folded into the SPEC audit section itself | CLOSED | Same as 0192 — 0200 explicitly names discharging "exit-ledger OPEN ITEM 5's `PENDING-OWNED(task-w36-a)` label." |

## Verified starting points (re-confirmed with my own quote, per brief)

- 0196 items 1-2 (reviewer queue, plan progress read budgets) answered by
  0201 (task-w40-c perf-smoke @ `2e99b272`, 3-of-3 PASS, 144/144 rows) —
  CONFIRMED, quoted above.
- 0196 items 3-4 (`scripts/perf-seed.ts` insert loop,
  `perfSpeakerAcceptedIndexes` ordering) answered by that same section's
  STEP-0b grep and its three portal rows via the documented recipe —
  CONFIRMED, quoted above; also independently re-grepped live at my own
  HEAD (`PERF_SPEAKER` count = 13, `perfSpeakerAcceptedIndexes` present).
- 0196 item 5 / 0192's item (`< 300 KB gz` PENDING-OWNED) answered
  first-hand by 0200 (task-w40-d spec-audit) — CONFIRMED, quoted above.
- 0174's seven and 0175/0188's render-sweep rows claimed closed by
  task-w29-a/-c/-d and task-w36-e's `NAMED_CONTRAST_SELECTOR` gate row
  plus DEC-426's `EXEMPT-BY-RULE` path — verified each against the tree
  and the cited section rather than copying the claim: A/B closed by a
  live CSS diff + a named regression-guard test
  (`test/caret-inherits-control-ink.scan.test.ts`); C ruled-not-a-defect
  by DEC-426's ruling text plus the newest render-sweep's still-current
  `EXEMPT-BY-RULE` row; D/E closed by task-w29-c's own live PASS rows,
  re-confirmed unregressed by task-w35-b's independent re-run; the caret
  instrument-gap sub-issue (0188) closed by 76431743's own quoted live
  re-run. G (List\|Grid toggle) is the one claim that does NOT hold —
  no fix was ever found in the tree, confirmed OPEN.

## Count

- CLOSED: 11 distinct underlying defects — caret contrast (A/B + 0188's
  instrument-gap sub-issue), cfp-step-next focus-visible, review-field-
  disabled selector-never-resolved, mobile console-error collection,
  reviewer-queue perf, plan-progress perf, perf-seed insert loop,
  perfSpeakerAcceptedIndexes ordering, bundle-size PENDING-OWNED label
  (9 named defects; caret contrast items A/B/0188 count as one family of
  2 closures — CSS fix plus instrument-gap fix — cited as 2 rows above
  but one defect story).
- RULED-NOT-A-DEFECT: 1 — `.chq-review-checkbox-label` contrast 3.09
  (DEC-426 `EXEMPT-BY-RULE`, WCAG 2.1 SC 1.4.3 inactive-component
  exemption).
- SUPERSEDED (older reading, same defect, folded into a CLOSED/RULED
  verdict above rather than double-counted): 0175's (iv)/(v)/(vi), 0189's
  item, 0193's items 1/2/3/4, 0196's items 1/2/3/4/5, 0188's item.
- OPEN: **1** — admin Speakers toolbar missing `[List \| Grid]` view-mode
  toggle (`app/src/pages/speakers/GridFilters.tsx`, `docs/design/
  README.md:350`). Owner: wave-43 lane (admin Speakers toolbar List/Grid
  view-mode toggle).

OPEN ITEMS: 1
