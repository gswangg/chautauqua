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

Fixing every other sheet below is explicitly OUT OF SCOPE for w1-d — that
task's brief said not to touch them here. This is the honest replacement for
two hand-written pins that used to disagree about this same invariant: the
scan is expected to be RED against main until each row below is fixed. Each
row names the sheet, its cluster (so a later wave can size a follow-up task),
and what the scan measured on this branch. **This list is a snapshot** — the
scan itself, not this file, is the ground truth; re-run it before sizing a
follow-up rather than trusting this table.

20 sheets were non-conformant on the branch this file was last measured
against; task w3-j fixed `app/src/pages/review/review.css` (row below), so 19
remain non-conformant. **This list is a snapshot** (see above) — re-run the
scan before sizing further follow-up rather than trusting this count.

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
| `app/src/pages/review/review.css` | review-admin | **FIXED (task w3-j)** — was 11 blocks (lines 354, 1084, 1230, 1401, 1571, 1675, 1756, 2114, 2244, 2598, 2614 on the branch this task read); now exactly 1 terminal block, all ten earlier blocks' bodies forward-merged into the final block in ascending source order (no selector/property/value changed, no in-block reordering; the two duplicate declarations already shared by the last two original blocks are kept verbatim). `phone-cascade-order.scan.test.ts` shadowed-pair count for this file fell from 2 to 0 (`.chq-review-reviewer-row grid-template-columns` and `.chq-review-summary-grid grid-template-columns`, previously shadowed by top-level desktop rules at old lines ~1689/1697); tree-wide count fell 17 -> 15. Neither fixed pair is a NEW winner at 390 — both selectors already carried a non-shadowed identical duplicate declaration later in the file (the wave-7/w6-b source-order-fix duplicates), so the value that reaches the browser at 390 is unchanged and no frame contradiction check was triggered. |
| `app/src/pages/speakers/speakers.css` | speakers | 5 blocks (lines 100, 880, 1294, 1474, 1572) |
| `app/src/pages/speakers/task-view.css` | speakers (TaskView) | 2 blocks (lines 253, 280) |
| `app/src/pages/submissions/detail.css` | submissions | 3 blocks (lines 844, 1097, 1171) |
| `app/src/pages/submissions/submissions.css` | submissions | 4 blocks (lines 477, 739, 834, 889) |
| `app/src/styles.css` | shell / global | 5 blocks (lines 381, 1127, 2048, 2214, 2360) |
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
