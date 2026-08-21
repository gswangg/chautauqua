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

**Reconciled wave 17 (task w17-e, DEC-976): all four original DIVERGES rows
report at least partial work that has since landed.** Two (`:280`, `:413`)
are now fully RESOLVED; two (`:594`, `:793`) are narrowed to exactly one
surviving gap each. One frame already MATCHED. Two resolutions
(`:280`, `:793`) are markup-ORDER fixes achieved via DEC-385-legal
`display: contents` grid unwraps scoped to the terminal max-width:700px
block — the DOM order itself is unchanged, so their own render-test DOM
assertions no longer measure the frame's SCREEN; see those rows for why.
`:413` is a guard-expression fix (the back link is now conditioned on
`plans.length > 1`). `:594`'s "Criteria"/"Cap each" copy is resolved via an
existing `isPhone` ternary, narrowing that row to DEC-745's v4 title-row
shell (a deliberate restructure not yet recorded in DEVIATIONS.md — see
that row for what a later wave still owes it). `:793`'s row anatomy is
resolved the same screen-vs-DOM way as `:280`, narrowing that row to its
own surviving footnote sentence-merge (a genuine, unchanged content gap —
see that row).

| Frame | Verdict | What diverges |
| --- | --- | --- |
| `docs/design/Chautauqua Review.dc.html:280` Reviewer scorecard | RESOLVED (wave 17, task w17-e) | The frame's Overall block draws THREE stacked pieces beside a 34px value (`:322-328`): the "Overall" eyebrow, a denominator sentence, and a separate plain-average reconciliation sentence. `app/src/pages/review/Scorecard.tsx` — the DEC-889 wave-159 comment block above `<p className="chq-review-overall-caption">` — now renders that caption and a separate sibling `<p className="chq-review-overall-reconciliation">` (the two sentences are two elements again, not one merged string). The DOM itself still pairs the eyebrow+value on one `<p className="chq-review-overall-line">` ahead of both caption paragraphs as later siblings, but `app/src/pages/review/scorecard.css`'s terminal max-width:700px block — `.chq-review-overall { display: grid; grid-template-columns: 1fr auto; }` with `.chq-review-overall-line { display: contents; }` — unwraps that grouping so the eyebrow, denominator paragraph and reconciliation paragraph auto-place into the frame's own left column while the value spans every row as the right-hand column; jsdom applies no stylesheet, so a DOM-order assertion no longer measures this frame's SCREEN, which the CSS rule (not the DOM) now draws correctly. The frame's own phone-sighted recuse label (`:336`, "Recuse me — conflict of interest") exists verbatim in the DOM (`app/src/pages/review/Scorecard.tsx` — the `chq-review-recusal-label-phone` node) but stays behind a native `hidden` attribute that only that same max-width:700px block clears — this harness can confirm the node's presence and exact copy but not its sighted state; that caveat is not a divergence, just an unverifiable-in-jsdom limit, and stays noted. Everything else (back-link+counter row, title+meta, abstract+"Read the full submission", per-criterion fieldsets, comment field, docked Submit/Save pair) renders in the frame's own order. |
| `docs/design/Chautauqua Review.dc.html:934` Scorecard, a criterion unscored | MATCHES | The frame's ink-outlined unscored banner (`:941-943`) is read verbatim off `unscoredBannerCopy` (`app/src/pages/review/scorecardLogic.ts` — `still ${plural(n, 'needs', 'need')} a score`), reached only at phone via `useIsPhone`. With one of two rating criteria unscored the banner reads "One criterion still needs a score" / "The weighted total cannot be worked out until all two are scored." — the frame's own spelled-count grammar exactly, differing only in the illustrative fixture's own criterion count (two here vs. the frame's illustrative three). The scored criterion's radio pill and the unscored one's empty group both render as the frame draws them, and the phone-only "Not yet" Overall value (`:969`) is present in the DOM behind the same native-`hidden` idiom as the recuse label above. |
| `docs/design/Chautauqua Review.dc.html:413` Reviewer queue (Subscreen) | RESOLVED (wave 17, task w17-e) | The frame's own head band (`:413-425`) draws NO back control at all — only the wordmark, the reviewer's name, then the eyebrow/H1/subtitle/progress-bar stack. `app/src/pages/review/ReviewerQueue.tsx`'s "‹ Your plans" back link (`app/src/pages/review/ReviewerQueue.tsx` — the `&lsaquo; Your plans` `<Link>`) is now gated on `{plans && plans.length > 1 && (...)}`, citing DEC-874's own single-plan-skip ruling in the surrounding comment: with exactly one plan there is no "Your plans" hub to go back TO (`plans` comes from state already held by the component, populated by the `/review` fetch that precedes the same-instance `Navigate`, no second fetch added), so the link renders only when a hub genuinely exists — matching the frame's own no-back-control anatomy whenever a reviewer lands here with one plan or arrives via a direct deep link. Everything downstream of the head band (row anatomy's ref→title→meta→action order, the standing dock's reassurance+Sign-out pair) matches the frame. |
| `docs/design/Chautauqua Review.dc.html:594` Plan editor · 390 | RESOLVED (wave 19, task w19-e) | The row's three former divergences are all RESOLVED. The "Criteria" eyebrow (`:601`) and "Cap each" label (`:657`) render verbatim at phone through the existing `isPhone` ternaries in `app/src/pages/review/PlanEditor.tsx`, pinned by `app/src/pages/review/PlanEditor.copy-390.render.test.tsx`. The per-reviewer-row "Swap"→"Remove" substitution (`:652`) stays a pre-existing, DEVIATIONS-blessed deviation (`docs/design/DEVIATIONS.md` — `Plan editor reviewer-row "Swap"`). The last surviving clause — DEC-745's v4 title-row shell (`app/src/pages/review/PlanEditor.tsx`'s `chq-review-editor-title-row`: an editable plan-name `<input aria-label="Plan name">` with Duplicate/Save on the SAME row as the back link, replacing the frame's separate H1(`:597`)+footer-Save/Cancel(`:665-668`) anatomy) — is now RECORDED and blessed in `docs/design/DEVIATIONS.md` ("Plan editor's v4 title-row shell") per DEC-745's wave-19 amendment, AND the screen gains the level-1 heading the frame's anatomy called for: `PlanEditor.tsx` renders one visually-hidden `<h1 className="chq-review-editor-title-h1">` naming the current plan (styled by a top-level, non-media rule in `app/src/pages/review/review.css` since it carries the same string the input already shows and is not a desktop geometry change, DEC-385), pinned by `app/src/pages/review/PlanEditor.heading-390.render.test.tsx`. The input keeps its `aria-label` and stays the one rename affordance (DEC-613). |
| `docs/design/Chautauqua Review.dc.html:793` Your plans (rendered at its actual multi-plan state; DESIGN-RULINGS B4/DEC-874: a single open plan SKIPS this hub entirely) | RESOLVED (wave 19, task w19-e) | The frame's own row pairs plan-name with its state pill on ONE baseline row (`:806`), with the assigned/left/closes meta on a SEPARATE line beneath (`:810`) — already resolved via `review.css`'s terminal `.chq-reviewer-plan-row-name-line { display: contents; }` rule, unchanged by this task. The remaining surviving divergence is now RESOLVED: the frame states "With one open plan this page is skipped — you land straight in its queue." as its own body sentence (`:817`) and "Scores stay hidden from other reviewers" as a separate standing-dock sentence (`:821`). `app/src/pages/review/ReviewerQueue.tsx`'s `chq-reviewer-plans-footnote` paragraph now carries both sentences as two sibling `<span>`s (desktop byte-identical, matching the 1600 frame `:775` which genuinely carries both sentences in one closing line), and `app/src/pages/review/review.css`'s terminal `max-width: 700px` block hides only the second span (`.chq-reviewer-plans-footnote-repeat { display: none; }`) with a `/* phone-hidden: ... */` receipt naming `.chq-reviewer-plans-phone-note` as the same-surface substitution already stating that sentence in the dock at 390 — one sentence, one place, at each width. Pinned by `app/src/pages/review/ReviewerQueue.footnote-390.render.test.tsx`. The head band's own H1("N left to score")+subline order matches the frame. |

**Wave 19 (task w19-e, DEC-976): the two rows still reading DIVERGES after
wave 17 are now both RESOLVED.** `:594`'s surviving DEC-745 v4-shell clause
is recorded in `docs/design/DEVIATIONS.md` and the screen gains the level-1
heading the frame's own anatomy called for. `:793`'s surviving
footnote-sentence-merge is fixed by splitting the paragraph into two
sibling spans and hiding only the repeat span at 390 with a DEC-919
receipt. All five 390 frames in this ledger now read RESOLVED or MATCHES —
zero open rows remain in this table.

**None of the wave-17 fixes were a phone-block-CSS or markup-order fix**
(the wave-19 fixes above are the first in this ledger that are) — the
scorecard divergences are element-collapsing (verified identical facts,
fewer DOM nodes) plus one jsdom-observability caveat (a `hidden`-gated
phone label CSS alone would reveal); the queue divergence is an added
control the frame's own subscreen never draws; the plan-editor divergences
were the DEC-745 v4-shell restructure, now tracked and blessed by
DEVIATIONS.md; the hub divergence was a row-grouping/DOM-order difference
inherited from the shared desktop grid class, now resolved. Left as
findings for whoever owns the next architectural pass on this cluster, per
this task's
design-gap instruction.
