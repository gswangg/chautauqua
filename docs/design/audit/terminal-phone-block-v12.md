# Terminal phone block audit (DEC-385 amendment wave 98)

Owner of the rule: `test/phone-terminal-block.scan.test.ts` (task w1-d). That
scan derives, every run, the population of stylesheets under `app/src/*.css`
and every `src/**` module exporting a `*_CSS` template literal, and asserts
for each sheet with at least one `@media (max-width: 700px)` block: exactly
one such block, and that block must be the sheet's last top-level
construct (source order decides an equal-specificity cascade tie, so a
non-terminal phone block can be silently shadowed by a later desktop rule —
see `test/phone-cascade-order.scan.test.ts`).

Task w1-d fixed `src/routes/portal/portal.css.ts` (2 blocks -> 1 terminal
block; the earlier w5-a block's rules were moved into the w8-h block at the
sheet's true end, no selector/declaration/value changed) and retired the
contradictory local pin at `test/portal-phone-frames.test.ts:220-223`.

Task v12m-w3-k (the shell lane, wave 21) fixed `app/src/styles.css` (5
blocks, originally at lines 394, 1189, 2216, 2384, 2530 -> 1 terminal
block): the bodies of the four earlier blocks were forward-merged into the
sheet's last top-level construct, in ascending source order, above its
existing body; no selector, property or value changed. The block's own
header comment (`Do not reorder or delete the block at :381 ...`) predated
DEC-385 wave-100/102's one-terminal-block contract and has been rewritten
to say so explicitly rather than left as a stale prohibition.

Cascade check (`test/phone-cascade-order.scan.test.ts`, DEC-385 wave
103): styles.css carried 12 of the tree's shadowed (selector, property)
pairs before this fix (all twelve named by
`app/src/phone-cascade-terminal.test.ts`'s `SHADOWED_PAIRS`, already
resolved by the pre-existing wave-7 terminal-block restatement, which is
now the tail of the merged block). Measured before/after on this task:
tree-wide shadow count **17 -> 5** (styles.css's own contribution **12 ->
0**); the five remaining shadows are in other sheets, out of this task's
scope. No newly-winning phone declaration in the merged block contradicts
any shell phone frame this sheet cites (`docs/design/Chautauqua
Speakers.dc.html:261-279` for the phone page-scaffold primitives,
`Chautauqua Settings.dc.html:299` / `Chautauqua Submissions.dc.html:173-180`
for the tab bar) — every merged declaration is verbatim from its original
block, and those citations were already correct before the merge. No
declaration was deleted.

Fixing every other sheet below is explicitly OUT OF SCOPE for w1-d — that
task's brief said not to touch them here. This is the honest replacement for
two hand-written pins that used to disagree about this same invariant: the
scan is expected to be RED against main until each row below is fixed. Each
row names the sheet, its cluster (so a later wave can size a follow-up task),
and what the scan measured on this branch. **This list is a snapshot** — the
scan itself, not this file, is the ground truth; re-run it before sizing a
follow-up rather than trusting this table.

20 sheets were non-conformant on the branch this file was last measured
against. Task w3-j fixed `app/src/pages/review/review.css`, task w3-l fixed
the two `app/src/pages/submissions/*.css` rows (all three rows below, kept in
the table and marked FIXED), task w2-t fixed four SSR sheets and task w3-k
fixed `app/src/styles.css` (those five rows removed from the table below) —
so 12 remain non-conformant. That is still more than three, flagged plainly
per task w1-d's own instruction. **This list is a snapshot** (see above) —
re-run `test/phone-terminal-block.scan.test.ts` before sizing further
follow-up rather than trusting this count; it may already read a different
number if another lane's fix has landed since.

Task w2-t (SSR sheet group C) fixed `src/routes/auth.css.ts`,
`src/routes/public/css/agenda.css.ts`, `src/routes/public/css/cards.css.ts`
and `src/routes/public/css/rail.css.ts` — each now carries exactly one
terminal `@media (max-width: 700px)` block, consolidated by concatenating
the earlier block's body into the later (or, for `agenda.css.ts`, into a
new block appended at the true end, since neither surviving block was
already the sheet's last top-level construct) in ascending source order.
No selector/declaration/value was reordered, reworded or deduped; three
byte-identical or property-overlapping duplicate rules were collapsed
explicitly with the discarded declaration named in a comment
(`auth.css.ts`'s `.chq-bare-page:has(.chq-auth-fields)`,
`.chq-auth-fieldstack`, `.chq-auth-actions`, `.chq-auth-actions
button[type=submit]`, `.chq-auth-cancel`; `rail.css.ts`'s
`.chq-pub-surface-title`). These four rows are removed from the table
below.

Task w3-l fixed the two `submissions/*.css` rows below by forward-merge, with
no selector/property/value changed.

| Sheet | Cluster | Measured |
|---|---|---|
| `app/src/components/error-states.css` | shared components | 2 blocks (lines 95, 154) |
| `app/src/components/modal-frame.css` | shared components (ModalFrame) | 4 blocks (lines 104, 150, 176, 192) |
| `app/src/pages/agenda/agenda.css` | agenda | 2 blocks (lines 1100, 1424) |
| `app/src/pages/comms/comms.css` | comms | 3 blocks (lines 1173, 1850, 2065) |
| `app/src/pages/contacts/contacts-panels.css` | contacts | 5 blocks (lines 453, 827, 1253, 1508, 1646) |
| `app/src/pages/contacts/contacts.css` | contacts | **FIXED (task w8-b)** — was 4 blocks (lines 388, 862, 944, 963 -- the row's prior 382/856/938/957 had drifted); now exactly 1 terminal block, all four earlier blocks' bodies forward-merged into the final block in ascending source order (no selector/property/value changed, no in-block reordering; the desktop rules between the former blocks are untouched, byte-unchanged). Two selectors recurred across former blocks (`.chq-contacts-table tbody td[data-label]::before` and `.chq-contacts-company-cell`, former block 1 vs former block 4) — kept as separate rules in original relative order rather than merged, so the later declaration still wins the cascade exactly as before. `phone-cascade-order.scan.test.ts` SHADOWED_CEILING for this file stays 0. |
| `app/src/pages/content/content.css` | content | 2 blocks (lines 925, 1638) |
| `app/src/pages/overview/overview.css` | overview | 3 blocks (lines 447, 557, 585) |
| `app/src/pages/review/review.css` | review-admin | **FIXED (task w3-j)** — was 11 blocks (lines 354, 1084, 1230, 1401, 1571, 1675, 1756, 2114, 2244, 2598, 2614 on the branch this task read); now exactly 1 terminal block, all ten earlier blocks' bodies forward-merged into the final block in ascending source order (no selector/property/value changed, no in-block reordering; the two duplicate declarations already shared by the last two original blocks are kept verbatim). `phone-cascade-order.scan.test.ts` shadowed-pair count for this file fell from 2 to 0 (`.chq-review-reviewer-row grid-template-columns` and `.chq-review-summary-grid grid-template-columns`, previously shadowed by top-level desktop rules at old lines ~1689/1697); tree-wide count fell 17 -> 15. Neither fixed pair is a NEW winner at 390 — both selectors already carried a non-shadowed identical duplicate declaration later in the file (the wave-7/w6-b source-order-fix duplicates), so the value that reaches the browser at 390 is unchanged and no frame contradiction check was triggered. |
| `app/src/pages/speakers/speakers.css` | speakers | 5 blocks (lines 100, 880, 1294, 1474, 1572) |
| `app/src/pages/speakers/task-view.css` | speakers (TaskView) | 2 blocks (lines 253, 280) |
| ~~`app/src/pages/submissions/detail.css`~~ | submissions | **FIXED (task w3-l)**: was 3 blocks (lines 844, 1097, 1171), forward-merged into the single terminal block at 844. Cascade-shadow sweep read 0 shadowed pairs for this file both before and after (no frame contradiction to delete). `detail-css.test.ts:188`'s "a second phone block exists" pin (the same shape as the retired `settings-phone-floor` `>=5` pin) was retired and `dockBlock` re-anchored on the single terminal block via the file's existing `mediaBlockBody` helper. |
| ~~`app/src/pages/submissions/submissions.css`~~ | submissions | **FIXED (task w3-l)**: was 4 blocks (lines 489, 751, 846, 911), forward-merged into the single terminal block. The `.chq-submissions-columnpicker` phone `display:none` (DEC-919 wave-102, DEVIATIONS.md:89 "stands") was carried verbatim into the merged block. Cascade-shadow sweep read 0 shadowed pairs for this file both before and after. |
| ~~`src/routes/public/css/chrome.css.ts`~~ | public chrome (SSR) | **FIXED (task w7-e)**: the sole `.chq-pub-filter-row` phone rule was relocated verbatim to the sheet's true end, after the `.chq-pub-searchform` rule and the `@media (prefers-reduced-motion: reduce)` block that used to follow it; no selector/property/value changed. New >=44px phone-width floors for `.chq-pub-search`, `.chq-pub-search-submit`, `.chq-pub-select` and `.chq-pub-select-active` (DEC-367, task w7-e) were added inside this same relocated block rather than as a second block. |
| `src/views/theme.ts` | shared SSR theme (every SSR surface) | 2 blocks (lines 561, 575) |

`src/views/theme.ts` is the sheet three earlier probes missed by globbing
`src/**/*.css.ts` or rooting at `src/routes` (field guide w96) — it is
loaded by every SSR surface and carries part of the shared 44px tap-floor
rule, so a fix here has the widest blast radius of any row in this table.
