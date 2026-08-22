# Contacts "Pipeline · 390" v12 phone conformance — audit findings

Findings surfaced while implementing w31-c: the frame verdict for
"Pipeline · 390" (docs/design/Chautauqua Contacts.dc.html:447-477).

## DEVIATIONS.md §3's "no phone dock is minted" entry is STALE — superseded by §6 + the round-3 correction

**Frame**: docs/design/Chautauqua Contacts.dc.html:447-477 ("Pipeline ·
390").

**The contradiction**: docs/design/DEVIATIONS.md carries two entries for
this exact frame that directly disagree.

- §3 ("Interpretations where the frames underspecify") rules: "Contacts
  Pipeline keeps its landed head action; no phone dock is minted (DEC-576
  wave-120/124)."
- §6 REVERSES that: "Contacts Pipeline · 390 dock IS minted."

docs/mobile-campaign.md's round-3 correction independently re-verified the
dock live against the tree at 390: `[data-chq-phone-dock]` renders exactly
once (`position: sticky; bottom: 0`), its two controls ("Add someone",
"Filter") floor at 48px, `.chq-tabbar` computes `display: none` once a page
mints a dock, and the head's own "Add to the pipeline" button is hidden at
390 while unchanged at 1440.

**What this task found in the tree**: every one of those four properties
already holds, byte-for-byte, in the currently-landed CSS —

- `app/src/styles.css`'s phone block (`@media (max-width: 700px)`, single
  top-level occurrence in the file) declares `.chq-phone-dock { position:
  sticky; bottom: 0; ... }` and `.chq-phone-dock .chq-btn { min-height:
  48px; ... }`.
- The same block declares `.chq-main:has([data-chq-phone-dock]) ~
  .chq-tabbar { display: none; }`.
- `app/src/pages/contacts/contacts-panels.css`'s single terminal
  `@media (max-width: 700px)` block declares
  `.chq-contacts-pipeline-head > .chq-btn` TWICE: an earlier declaration
  (full-width, 48px, no `display` override, apparently the "keeps its
  landed head action" treatment §3 describes) and a LATER declaration
  (`display: none`) that wins the cascade at equal specificity — the
  file's own comment at that later rule states plainly it "supersedes" the
  earlier one. No top-level (non-media) rule targets this selector at all,
  so above 700px the button keeps its base `.chq-btn` display
  (`inline-flex`) — unchanged at 1440, exactly as the round-3 correction
  describes.
- `app/src/pages/contacts/PipelineBoard.tsx` already renders
  `<div className="chq-phone-dock" data-chq-phone-dock>` with exactly the
  frame's two controls ("Add someone" re-running the same
  `setEnrollStage`/`setShowEnroll` pair the head button runs; "Filter"
  opening the five-stage sheet), gated on `isPhone` only.

**Conclusion**: §3's "no phone dock is minted" line describes an EARLIER
state of the tree (the first, superseded `.chq-contacts-pipeline-head >
.chq-btn` declaration, before the later `display: none` rule landed) and no
longer matches what ships. §6 + the round-3 live re-verification are
correct and current. This task's own render-verdict file
(`app/src/pages/contacts/PipelineBoard.frame390.render.test.tsx`) asserts
all four properties above against the real component and the real CSS
source, and grades the frame against the §6/round-3 reading throughout.

**What this task did NOT do**: edit docs/design/DEVIATIONS.md itself — per
this task's HARD BAN. This finding is the row a later merge-train lane
should fold into DEVIATIONS.md: delete or supersede §3's "no phone dock is
minted" line for Contacts Pipeline, since §6 already carries the correct,
currently-true statement and no code change was needed to reach it.

## Drawn-literal coverage

Of the frame's drawn body (:447-477), the render-verdict file added this
task asserts, in DOM order, against the real mounted component: the back
control's accessible name, the `<h1>Pipeline</h1>` heading, the "N people"
caption (shape-matched, phone-only — the desktop "· drag between columns"
clause is dropped, as PipelineBoard.tsx's own existing comment at :288-292
already documents), the five-stage chip strip in the frame's own
Identified/Contacted/Interested/Confirmed/Declined order (each chip
shape-matched as "`<label>` · `<count>`", never the frame's own sample
counts), each phone card's name/company/fit-chip+note/age fields in the
frame's own structural order (SHAPE-matched — this test's own fixture names
are never asserted against the frame's sample data, per DEC-967), the
"Move ›" control (one per visible card, right-flushed), and the dock band's
two controls in DOM order. A companion test in the same file pins the
"Move ›" control's 44px floor and zero margin as a static CSS-text receipt
against `contacts-panels.css`'s terminal phone block plus `styles.css`'s
shared `.chq-btn` phone floor (jsdom applies no `@media`, so no claim here
is about computed geometry).

No code change was needed in `PipelineBoard.tsx` or `contacts.css` — the
markup and CSS this task's MAY-FIX list named already implement the frame
(and already implement the §6/round-3 dock reading); `contacts.css` itself
carries no pipeline-scoped rules at all (the pipeline's phone CSS lives
entirely in `contacts-panels.css`, this wave's hard-banned file, owned by
task w31-b), so `contacts.css`'s single terminal
`@media (max-width: 700px)` block was read for a possible desktop-rule-
declared-after-the-phone-block hazard (DEC-385's cascade-danger clause in
this task's own brief) and found to contain no pipeline selectors at all —
no divergence to record there.
