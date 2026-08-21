# Review v12 fidelity audit — 390 (task w3-g)

Numbered findings the task window could not resolve within scope.

> A finding recorded here is a claim about the tree, not a permanent record.
> It is re-derived against current code before it is scheduled, and once it
> stops reproducing it is rewritten as RESOLVED with a file:line citation of
> where the behaviour now lives (DEC-976 wave-106).

## 1. RESOLVED (wave 106, app/src/pages/review/Scorecard.tsx:538,548, app/src/styles.css:2302, app/src/App.tsx:474) — Neither reviewer-scorecard 390 frame draws a tab bar

`docs/design/Chautauqua Review.dc.html:280-350` ("Reviewer scorecard ·
/review/plans/:id/submissions/:id") and `:934-1138` ("Scorecard · a
criterion unscored") both draw the phone device box edge-to-edge with no
tab bar row. Re-derived against main: the shell-level decision this
finding correctly deferred has since been made. `App.tsx`'s `PhoneTabBar`
mounts unconditionally in the shell (`app/src/App.tsx` — `<PhoneTabBar />`), but
`styles.css:2302` gives the shell a general attribute contract — any
page root that sets `data-chq-phone-dock` suppresses the tab bar via
`.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar { display: none }`.
`app/src/pages/review/Scorecard.tsx` builds `phoneRegionDeclarations` (`{...(isPhone ?
{ 'data-chq-phone-dock': true, 'data-chq-phone-head': true } : {})}`),
spread onto the page root at `Scorecard.tsx:548`, opting the reviewer
scorecard into that contract,
matching both frames' edge-to-edge, no-tab-bar rendering. The contract
itself is now enforced app-wide by
`app/src/phone-dock-declares.scan.test.ts` (DEC-576 wave-98). Closed.

---

## task rh (DEC-976 wave-157): per-frame verdict, all five 390 frames — the "citation is not conformance" gap

Before this task, none of Review's five `width:390px` frames had ever been
rendered against the tree — the phone `CLAIMED_FLOOR` row read 53/53 and
proved only that some test cites the frame, the same gap wave-157's Field
Guide entry named for Settings (eight of nine frames diverged there despite
a clean citation count). This task rendered all five through
`app/src/pages/Review.tsx`'s real routing (`<MemoryRouter
initialEntries={[...]}><ReviewPage /></MemoryRouter>`, never a
sub-component mounted directly) and recorded a verdict per frame below.
Render receipts:
app/src/pages/Review.frame-verdicts.render.test.tsx (5 passing tests, one
per frame, each opening with a DEC-967 `verbatimLine` citation of the
frame's own caption line).

**Two of five diverge on real content/structure gaps, two diverge on
element-collapsing (same facts, fewer elements — not a missing fact), and
one matches.** None of the five is a phone-CSS or markup-ORDER fix
(DEC-385) — every divergence below is either a deliberate v4-shell
restructure (Plan editor, DEC-745) already covered by DEVIATIONS.md, or a
genuine content-anatomy gap. No divergence found here is fixed in this
task, per the task's design-gap instruction.

| Frame | Verdict | What diverges |
| --- | --- | --- |
| `docs/design/Chautauqua Review.dc.html:280` Reviewer scorecard | DIVERGES (narrowed) | The frame's Overall block draws THREE stacked pieces — a denominator sentence and a separate plain-average reconciliation sentence beside a 34px value (`:322-328`). `app/src/pages/review/Scorecard.tsx` prints the value on the SAME line as the "Overall" eyebrow and merges both sentences into ONE caption paragraph beneath it (`app/src/pages/review/Scorecard.tsx` — `<p className="chq-review-overall-caption">`) — the same two facts, fewer elements. The frame's own phone-sighted recuse label (`:336`, "Recuse me — conflict of interest") exists verbatim in the DOM (`app/src/pages/review/Scorecard.tsx` — `Recuse me — conflict of interest`) but sits behind a native `hidden` attribute that only scorecard.css's max-width:700px block clears — jsdom applies no stylesheet, so this render harness can confirm the node's presence and exact copy but not its sighted state. Everything else (back-link+counter row, eyebrow, title+meta, abstract+"Read the full submission", per-criterion fieldsets, comment field, docked Submit/Save pair) renders in the frame's own order. |
| `docs/design/Chautauqua Review.dc.html:934` Scorecard, a criterion unscored | MATCHES | The frame's ink-outlined unscored banner (`:941-943`) is read verbatim off `unscoredBannerCopy` (`app/src/pages/review/scorecardLogic.ts` — `still ${plural(n, 'needs', 'need')} a score`), reached only at phone via `useIsPhone`. With one of two rating criteria unscored the banner reads "One criterion still needs a score" / "The weighted total cannot be worked out until all two are scored." — the frame's own spelled-count grammar exactly, differing only in the illustrative fixture's own criterion count (two here vs. the frame's illustrative three). The scored criterion's radio pill and the unscored one's empty group both render as the frame draws them, and the phone-only "Not yet" Overall value (`:969`) is present in the DOM behind the same native-`hidden` idiom as the recuse label above. |
| `docs/design/Chautauqua Review.dc.html:413` Reviewer queue (Subscreen) | DIVERGES | The frame's own head band (`:413-425`) draws NO back control at all — only the wordmark, the reviewer's name, then the eyebrow/H1/subtitle/progress-bar stack. `app/src/pages/review/ReviewerQueue.tsx` instead renders its own "‹ Your plans" back link (`app/src/pages/review/ReviewerQueue.tsx` — `&lsaquo; Your plans`) above the head band on every visit to this route, single-plan or not — DEC-874's own single-plan-skip ruling means a reviewer with one plan lands here directly with no "Your plans" hub to go back TO, yet the link still renders. Everything downstream of the head band (row anatomy's ref→title→meta→action order, the standing dock's reassurance+Sign-out pair) matches the frame. |
| `docs/design/Chautauqua Review.dc.html:594` Plan editor · 390 | DIVERGES | DEC-745's v4 title-row shell replaces the frame's separate H1(`:597`)+footer-Save/Cancel(`:665-668`) anatomy with an editable plan-NAME input and Duplicate/Save on the SAME row as the back link — no heading role for the name, no separate footer band at all. The "Criteria" eyebrow (`:601`) becomes "Scoring criteria" (`app/src/pages/review/PlanEditor.tsx` — `Scoring criteria`), with the frame's bare count moved into a phone-only hidden-at-desktop span. The frame's per-reviewer-row "Swap" action (`:652`) reads "Remove" instead — a pre-existing, DEVIATIONS-blessed deviation (`docs/design/DEVIATIONS.md` — `Plan editor reviewer-row "Swap"`), not a new finding: there is no reassign-in-place capability in the domain layer. The frame's "Cap each" label (`:657`) reads "Cap per reviewer" instead (`app/src/pages/review/PlanEditor.tsx` — `Cap per reviewer`); "Distribute the unassigned" (`:661`) matches verbatim. |
| `docs/design/Chautauqua Review.dc.html:793` Your plans (rendered at its actual multi-plan state; DESIGN-RULINGS B4/DEC-874: a single open plan SKIPS this hub entirely) | DIVERGES | The frame's own row pairs plan-name with its state pill on ONE baseline row (`:806`), with the assigned/left/closes meta on a SEPARATE line beneath (`:810`). `app/src/pages/review/ReviewerQueue.tsx`'s `ReviewerPlanRow` instead groups name+meta together as the row's FIRST child (`app/src/pages/review/ReviewerQueue.tsx` — `chq-reviewer-plan-row-name-line`), with the state pill as a later, separate sibling — the desktop 1600 frame's own four-column grid child order (`:852-864`: name+meta / state / bar / action) reused verbatim rather than the 390 frame's own row anatomy. The frame also states "With one open plan this page is skipped" as its own body sentence (`:817`) and "Scores stay hidden from other reviewers" as a separate standing-dock sentence (`:821`); the app merges both into ONE footnote paragraph (`app/src/pages/review/ReviewerQueue.tsx` — `chq-reviewer-plans-footnote`) in addition to a second, phone-only node repeating the second sentence alone. The head band's own H1("N left to score")+subline order matches the frame. |

**Nothing in this list is a phone-block-CSS or markup-order fix** — the
scorecard divergences are element-collapsing (verified identical facts,
fewer DOM nodes) plus one jsdom-observability caveat (a `hidden`-gated
phone label CSS alone would reveal); the queue divergence is an added
control the frame's own subscreen never draws; the plan-editor divergences
are the DEC-745 v4-shell restructure, already tracked by DEVIATIONS.md
where blessed; the hub divergence is a row-grouping/DOM-order difference
inherited from the shared desktop grid class. Left as findings for whoever
owns the next architectural pass on this cluster, per this task's
design-gap instruction.
