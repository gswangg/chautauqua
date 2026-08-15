## 2026-08-15 task-w42-a — triage-closure @ e01f237e

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

STEP 0 receipt (`npm run ref-state`, verbatim): DEC-644 three-sha boundary:
HEAD `e01f237e16ac7a7ef85a7b9f87e761041f538783`; newest first-parent
product-code-bearing sha `ed5c679e59828c5600cb84b51208056f7e38a445`; every
live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w40-e`,
`task-w40-g`, `task-w41-c`, `task-w42-a`, `task-w42-c`, `task-w42-d`,
`task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an
ancestor of HEAD via `git merge-base --is-ancestor`. NON-ancestor refs (NOT
confirmed via `git merge-base --is-ancestor`): `mail-rich-shape-fallback`,
`task-w17-i`, `task-w41-a`, `task-w41-b`, `task-w41-d`, `task-w41-e`,
`task-w41-f`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`,
`task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`,
`task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.

Population fixed by DEC-358 wave 42: every `OPEN ITEMS: <n>` line with
n>0 in `docs/verification-log/index/` sections 0174..0201 except 0195
and 0197 (excluded-by-population-split, owned by task-w42-e; this
section's count does not speak for them) — 0174 (7), 0175 (3), 0188 (1),
0189 (1), 0192 (1), 0193 (4), 0196 (5). Re-checked every item at this
lane's own runtime (not inherited from any prior wave's verdict), per
DEC-069 wave-17. Dedupe rule applied: distinct underlying defects
reconciled once, citing every section that raises them (0175's
(iv)/(v)/(vi) = 0174's D/E/C; 0189's item = 0193/0196's plan-progress
item; 0192's item = 0196's item 5; 0193's 4 items = 0196's items 1-4).

Result: 0174 A/B (caret contrast) CLOSED (`add09a9e`, DEC-830, guarded by
`test/caret-inherits-control-ink.scan.test.ts`). 0174 C / 0175 (vi)
(review-checkbox-label contrast 3.09) RULED-NOT-A-DEFECT (DEC-426
wave-29 `EXEMPT-BY-RULE`, WCAG 2.1 SC 1.4.3 inactive-component exemption
— still reads `EXEMPT-BY-RULE` at the newest in-tree render-sweep,
task-w40-e @ 14db7b30). 0174 D / 0175 (iv) (cfp-step-next
focus-visible) CLOSED (task-w29-c's `personaRole`/`viewport` scoping fix,
live PASS, unregressed at task-w35-b). 0174 E / 0175 (v)
(review-field-disabled selector-never-resolved) CLOSED (same task-w29-c
fix). 0174 F (mobile console-error collection) CLOSED (`19aa0a0c`). 0188
(caret-contrast instrument gap) CLOSED (`76431743`, `NAMED_CONTRAST_SELECTOR`,
live ratio=6.82 PASS). 0189 / 0193#2 / 0196#2 (plan progress perf
unstable) CLOSED (0201, 3/3 PASS). 0192 / 0196#5 (bundle-size
PENDING-OWNED label) CLOSED (0200, first-hand 69.20 kB gz, explicitly
discharges the label). 0193#1 / 0196#1 (reviewer queue perf) CLOSED
(0201, 3/3 PASS). 0193#3 / 0196#3 (perf-seed.ts missing insert loop)
CLOSED (0201's STEP-0b grep + own live re-grep, `PERF_SPEAKER` count 13).
0193#4 / 0196#4 (perfSpeakerAcceptedIndexes ordering / portal-fixup
reachability) CLOSED (0201's three portal rows via the documented
recipe, no fixup needed). 0174 G (admin Speakers toolbar `[List | Grid]`
view-mode toggle missing) remains **OPEN** — `app/src/pages/speakers/
GridFilters.tsx` still has no `viewMode`/toggle code, `docs/design/
README.md:350` still specifies it, no commit since `3564c774` touches
this. Owner: wave-43 lane (admin Speakers toolbar List/Grid view-mode
toggle).

Full detail, per-item evidence tables, and count reconciliation:
`docs/verification-log/task-w42-a-triage-closure-e01f237e.md`.

RESULT: PASS — every item in the defined population (0174/0175/0188/
0189/0192/0193/0196, excluding 0195/0197 per DEC-358 population split)
was reconciled at this lane's own runtime with a quoted file:line, a
named gate row, or a named exercised test; 1 genuinely OPEN item
remains (admin Speakers List/Grid toggle), all others CLOSED or
RULED-NOT-A-DEFECT.
OPEN ITEMS: 1
