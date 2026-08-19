# Terminal phone block audit (DEC-385 amendment wave 98)

Owner of the rule: `test/phone-terminal-block.scan.test.ts` (task w1-d). That
scan derives, every run, the population of stylesheets under `app/src/*.css`
and every `src/**` module exporting a `*_CSS` template literal, and asserts
for each sheet with at least one `@media (max-width: 700px)` block: exactly
one such block, and that block must be the sheet's last top-level
construct (source order decides an equal-specificity cascade tie, so a
non-terminal phone block can be silently shadowed by a later desktop rule —
see `app/src/phone-cascade-order.scan.test.ts`).

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

Cascade check (`app/src/phone-cascade-order.scan.test.ts`, DEC-385 wave
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

19 sheets were non-conformant on this branch as of v12m-w3-j; v12m-w3-k's
fix to `app/src/styles.css` (below) brings that to 18 (more than three —
flagged per task w1-d's own instruction to say so plainly if that
threshold is crossed). **This list is a snapshot, re-run the scan** —
`test/phone-terminal-block.scan.test.ts` may already read a different
count if another lane's fix landed since.

| Sheet | Cluster | Measured |
|---|---|---|
| `app/src/components/error-states.css` | shared components | 2 blocks (lines 95, 154) |
| `app/src/components/modal-frame.css` | shared components (ModalFrame) | 4 blocks (lines 104, 150, 176, 192) |
| `app/src/pages/agenda/agenda.css` | agenda | 2 blocks (lines 1100, 1424) |
| `app/src/pages/comms/comms.css` | comms | 3 blocks (lines 1173, 1850, 2065) |
| `app/src/pages/contacts/contacts-panels.css` | contacts | 5 blocks (lines 453, 827, 1253, 1508, 1646) |
| `app/src/pages/contacts/contacts.css` | contacts | 4 blocks (lines 382, 856, 938, 957) |
| `app/src/pages/content/content.css` | content | 2 blocks (lines 925, 1638) |
| `app/src/pages/overview/overview.css` | overview | 3 blocks (lines 447, 557, 585) |
| `app/src/pages/review/review.css` | review-admin | 11 blocks (lines 333, 1062, 1208, 1379, 1549, 1653, 1734, 2092, 2222, 2573, 2589) |
| `app/src/pages/speakers/speakers.css` | speakers | 5 blocks (lines 100, 880, 1294, 1474, 1572) |
| `app/src/pages/speakers/task-view.css` | speakers (TaskView) | 2 blocks (lines 253, 280) |
| `app/src/pages/submissions/detail.css` | submissions | 3 blocks (lines 844, 1097, 1171) |
| `app/src/pages/submissions/submissions.css` | submissions | 4 blocks (lines 477, 739, 834, 889) |
| `src/routes/auth.css.ts` | auth (SSR) | 2 blocks (lines 281, 456) |
| `src/routes/public/css/agenda.css.ts` | public agenda (SSR) | 2 blocks (lines 373, 443) |
| `src/routes/public/css/cards.css.ts` | public cards (SSR) | 2 blocks (lines 218, 244) |
| `src/routes/public/css/chrome.css.ts` | public chrome (SSR) | 1 block, NOT terminal — trailing `.chq-pub-searchform` rule follows its close |
| `src/routes/public/css/rail.css.ts` | public rail / schedule (SSR) | 2 blocks (lines 348, 387) |
| `src/views/theme.ts` | shared SSR theme (every SSR surface) | 2 blocks (lines 561, 575) |

Note on `src/routes/public/css/chrome.css.ts`: unlike every other row, this
one already has exactly one block — its defect is purely non-terminality (a
top-level `.chq-pub-searchform` rule sits after the block's closing brace),
so its fix is a pure relocation of one rule, not a merge of N blocks.

`src/views/theme.ts` is the sheet three earlier probes missed by globbing
`src/**/*.css.ts` or rooting at `src/routes` (field guide w96) — it is
loaded by every SSR surface and carries part of the shared 44px tap-floor
rule, so a fix here has the widest blast radius of any row in this table.
