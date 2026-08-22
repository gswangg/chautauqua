# Review hub 390 v12 fidelity audit — `docs/design/Chautauqua Review.dc.html:793` (task w29-i)

`docs/design/Chautauqua Review.dc.html:793` ("Your plans · /review", extent
793-828, the 390 reviewer hub). Before this task, the only test citing this
extent was `app/src/pages/review/ReviewerQueue.hub-390.render.test.tsx`,
and only in the bare `Chautauqua Review.dc.html:<line>` shorthand form
DEC-808's wave-29 amendment already adjudicated as invisible to every frame
ledger. 8 of the frame's 9 drawn strings (:796 wordmark, :797 reviewer
name, :799 lede count, :800 lede plan-count, :807/:808/:810 row template,
:814 action label, :821 dock note) were asserted by nothing. This task adds
`app/src/pages/review/ReviewerQueue.hub390-frame.render.test.tsx`, a
DEC-967 `verbatimLine`-cited render test that mounts the hub through the
real `ReviewerQueue` component with two open plans (the frame's own drawn
state) and measures each string's shape/presence at request level.

MEASUREMENT ONLY per this task's brief: `app/src/pages/review/review.css`
is owned by w29-e and `app/src/pages/review/ReviewerQueue.tsx` is a
product file this lane may not touch. Every row below is a claim about the
CURRENT tree, not a fix.

| Frame element | Verdict | Notes |
| --- | --- | --- |
| :796 wordmark, :797 reviewer name | OUT OF SCOPE (shell-owned) | Both render inside the App shell's head band, not `ReviewerQueue` itself — not asserted here; same shell contract every other 390 hub/queue frame in this cluster relies on. |
| :799/:800 lede ("17 left to score" / "Across two open plans") | MATCHES | `ReviewerQueue.tsx`'s `chq-phone-head-drill` block renders `` `${leftTotal} left to score` `` as an `<h1>` and `` `Across ${spellCount(openCount)} open ${plural(openCount,'plan')}` `` as a sibling `<p className="chq-reviewer-plans-subline">`, in that order. Asserted by SHAPE (`/^\d+ left to score$/`, `/^Across \w+ open plans?$/`) rather than the frame's own illustrative "17"/"two" literals, per this task's brief. |
| :807/:808/:810 row template (name / state pill / meta) | MATCHES | `ReviewerPlanRow` renders one `<li className="chq-reviewer-plan-row">` per plan carrying `.chq-reviewer-plan-row-name` (plan name), `.chq-reviewer-plan-row-pill` ("Open"/"Closed"), and `.chq-review-plan-meta` (assigned/left/closes line) — every plan in the mocked two-plan fixture (one open, one closed) produces exactly this shape. |
| :814 action ("{{ p.btn }}") | MATCHES | Each row renders exactly one action control — a single `<a>` (React Router `Link`) inside the `<li>`, verified via `within(row).getAllByRole('link')` having length 1 for both the open and the closed row. |
| :817 "With one open plan this page is skipped — you land straight in its queue." | **DIVERGES from this task's own brief; MATCHES the frame and the tree's DEC-874/review-v12.md history** — see note below | See discussion below; recorded as MATCHES against the frame, not fixed, because there is nothing to fix. |
| :821 dock note ("Scores stay hidden from other reviewers") | MATCHES | `.chq-reviewer-plans-phone-note.chq-phone-dock`'s `textContent` is exactly `"Scores stay hidden from other reviewers"` (no trailing period, matching the frame's own literal exactly — distinct from the desktop-mirroring `.chq-reviewer-plans-footnote-repeat` span, which carries the same sentence WITH a period for the 1600 frame's `:775` closing line). |
| :822 "Sign out" | MATCHES (shell-owned, not a gap) | `ReviewerQueue` mints no "Sign out" control of its own anywhere in the hub tree — `screen.queryByText('Sign out')` is empty. Per DEC-874's wave-86 ruling (recorded in `review-v12.md`'s own :793 row), this is the shell's single control, correctly absent from the page component. |

## Note on this task's :817 instruction vs. the frame and the tree

This task's brief asked for an assertion that "the :817 single-plan note is
ABSENT in the two-plan state." Measuring the actual frame extent
(`Chautauqua Review.dc.html:793-828`) shows the opposite is what the frame
itself draws: the `<sc-for list="{{ hubPlans }}">` loop (the two-plan row
list) and the static `:817` sentence are BOTH inside the same scrollable
body region (`:803-818`), with `:817` positioned as the loop's own trailing
sibling — i.e. the mockup's illustrative two-plan state (the frame's own
"17 left to score" / "Across two open plans" lede at :799-800) is drawn
WITH the :817 sentence present beneath the row list, not without it. The
sentence is decorative copy explaining a DIFFERENT state's shortcut
behavior to the reviewer currently looking at the two-plan hub, not a
conditional annotation that should vanish once two-or-more plans exist.

`app/src/pages/review/ReviewerQueue.tsx`'s current implementation matches
this: `chq-reviewer-plans-footnote` always renders the :817 sentence for
the 2+-plan branch (byte-identical to the 1600 desktop frame's own `:775`
closing line, which genuinely merges both sentences per
`docs/design/audit/review-v12.md`'s `:793` row, RESOLVED wave 19). This
task's new render test therefore asserts what the frame and the existing,
already-adjudicated history actually call for — the real single-plan
contract is DEC-874's route-level skip (Navigate straight into the scoped
queue when `plans.length === 1`), which the new test asserts directly by
mounting with one plan and confirming no `.chq-reviewer-plan-row` renders
at all — rather than the brief's proposed (and, on inspection, frame-
contradicting) "assert :817 absent" check. Flagging this per the campaign
instruction to take the narrowest reasonable interpretation of a design
gap and note it, rather than writing a test that would fail against both
the frame and `review-v12.md`'s own prior RESOLVED verdict.

## Net result

No DIVERGES rows survive against the frame itself. `review-v12.md`'s own
`:793` row (RESOLVED, wave 19) already covers the row-anatomy and
footnote-merge history this task's new file now also renders and cites at
request level — this file's addition is a citation-format and coverage
fix (8 previously-unasserted drawn strings now measured), not a new
product finding.
