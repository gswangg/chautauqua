# Submissions v12 phone-frame verdict (task w31-e)

Markup-level verdicts for the two 390 frames in `docs/design/Chautauqua
Submissions.dc.html`, mounted from the real routes by
`app/src/pages/submissions/Submissions.frame390.render.test.tsx` (DEC-976
wave-31; jsdom applies no `@media`, so every claim here is about DOM
structure/order, never computed geometry — the phone-only CSS itself is
already pinned by source-text scans: `submissions-phone-frames.test.ts`
for `submissions.css`, `detail-css.test.ts`/`detail-head-390.test.ts`/
`detail-tier2-floor.test.ts` for `detail.css`).

## "Submissions" · 390 (`:137-181`, 13/16 literals previously asserted)

**Verdict: MATCHES**, with two settled, already-adjudicated divergences
recorded below (neither is a live gap; both are prior rulings this task
confirms still hold).

- Head band (`:138-152`) — graded against DEVIATIONS.md's "Submissions 390
  phone head, DEC-919 amendment (wave 7, task w7-e)" entry, not a literal
  read of the frame. **SETTLED DIVERGENCE**: the frame draws the head as
  two bands with no action buttons; the app re-lines a third
  `.chq-submissions-head-actions` row (Forms / Export CSV / New
  submission) beneath the titles row, mirroring the frame's own card
  action triple's `flex:1 / flex:1 / auto` grammar. Kept per DEC-919
  ("re-line, never remove") — the frame's copy has nowhere else to put
  these controls. Confirmed present and re-lined by this task's render
  test.
- `:144` H1 "Submissions", `:145` "N total[· N awaiting triage]" summary
  (SHAPE), `:147` search placeholder "Search title or speaker…" (literal
  match) — all render as drawn.
- `:148-151` three-chip strip — "Needs triage" / "Accepted" / "All N"
  (count graded by SHAPE) — matches; the wave-6/DEC-919-wave-110 CSS
  narrowing (only these two named status pills survive at phone, plus the
  synthetic "All" chip) is a CSS-only concern already pinned by
  `submissions-phone-frames.test.ts`, orthogonal to this markup verdict.
- Per-row stack (`:158-168`) — ref/status baseline, title, then the
  data cells backing the frame's single "speakers · track · format" text
  line (rendered as separate `<td>` cells at markup level; the joined
  line is a phone-only CSS relining already pinned by
  `submissions-phone-frames.test.ts`'s `::before` separator checks), then
  the Accept/Decline/Read action triple — matches, SHAPE-graded on every
  sample datum.
  - **SETTLED DIVERGENCE, honoured per this task's tie-break (1)**: the
    row's third action is `Read` (a plain navigation `<Link>` to the
    detail page, no disabled/pending wiring) per the DEC-610 wave-1
    ruling recorded in `SubmissionsTable.tsx`'s own comment: Waitlist was
    *removed* from this card and made reachable from the detail rail and
    the bulk-action bar instead. The frame's own literal at `:167` is also
    `Read`, so this is a literal match at the copy level — recorded here
    only because a bare `Waitlist`-everywhere reading of this task's own
    tie-break instruction could be mistaken for a call to change this row;
    it is not. It is the *detail dock's* third action (below) that the
    'Waitlist' ruling targets. `SubmissionsTable.tsx` is outside this
    task's MAY-FIX scope in any case.
- Always-mounted bulk bar — the frame draws no bulk bar at all in this
  line range; `.chq-submissions-bulkbar` is a DEC-663-blessed frame-silent
  addition (idle-state hint "Tick rows to change status or email
  speakers.", never unmounted). Recorded as a settled addition, not a
  divergence.
- Tab band — this page's own saved-view strip (`.chq-submissions-viewtabs`,
  ViewTabs.tsx) is asserted as the in-scope "tab band" this component
  tree owns. **OUT OF SCOPE, unchanged from `submissions-phone-frames.
  test.ts`'s own note**: the frame's bottom app tab bar (`:173-180`) is
  shell chrome — it is not part of `<SubmissionsPage>`'s render tree at
  all (it lives in the app shell layout), so it cannot be mounted or
  graded from this page's own render test.

- Select-checkbox cell — the frame draws no counterpart for the row's
  `chq-check`/`aria-label="Select {ref}"` checkbox. **SETTLED, not a live
  gap**: it shares the ref/status baseline line (`submissions.css`'s
  terminal block orders it `nth-child(1)` into the same `order: 2` band as
  the ref and status pill, not a standalone slot), and it exists to drive
  the already-blessed bulk bar above (`.chq-submissions-bulkbar`,
  DEC-663) — the same frame-silent-addition rationale already recorded for
  that bar applies to the control that selects rows for it.

No code changes were needed on this frame; nothing in `submissions.css`'s
terminal block required a fix. (DEC-976 wave-12: retired
`Submissions.frame-verdicts.render.test.tsx`'s stale `closest('table')`
assertion, which measured the desktop DOM cascade under jsdom's no-`@media`
read and reported a false "desktop `<table>`, not a card" divergence; the
terminal block's `thead{display:none}` + per-cell `order` bands already
re-line the row into this frame's own ref → title → speakers → actions
card sequence, matching this section's verdict above.)

## "Submission detail" · 390 (`:355-393`, 10/15 literals previously asserted)

**Verdict: MATCHES**, with one settled divergence (the dock's third
action) and one out-of-scope note (the co-presenter caption).

- Head band: back link (`:358`, short label "Triage" via
  `.chq-detail-back-short`, DEC-919 wave-98), position counter (`:359`,
  SHAPE "N of M"), eyebrow (`:361`, ref + format, SHAPE), title (`:362`,
  one `<h1>`), byline (`:363`, "name · company", SHAPE) — all render as
  drawn once `useIsPhone` reports phone width (`FakeMediaQueryList`
  stubbed true, same harness as `SubmissionDetailPage.phone-dock.render.
  test.tsx`).
- Body (`:366-386`): abstract paragraph (SHAPE), the `{{ answers }}`
  row stack (`.chq-answers-list`/`Form answers` section, SHAPE), the
  Reviews section title (`:375`, SHAPE "Reviews · N of M in", never the
  frame's own "3 of 3"), and the `{{ reviews }}` row stack
  (`.chq-review-entry`, reviewer/score/comment, SHAPE) — all render as
  drawn.
- Three-action dock (`:388-391`) — **SETTLED DIVERGENCE, honoured per this
  task's tie-break (1)**: the frame draws `Accept` / `Decline` / `Wait`;
  the app's dock (`.chq-phone-dock`) renders `Accept` / `Decline` /
  **`Waitlist`** as the accessible name (DEC-878 wave-129 amendment) —
  never the frame's `Wait`, and never `Read` (that word belongs to the
  *other*, landing frame's row action, not this dock — this task's own
  instructions call this distinction out explicitly to prevent the two
  frames' third actions being conflated). The dock's third button does
  still render the frame's literal `Wait` string in the DOM, inside
  `.chq-detail-back-short`, purely as the phone-width visual label — the
  accessible name stays `Waitlist` regardless
  (`SubmissionDetailPage.phone-dock.render.test.tsx` already pins both
  halves of this; this task's render test re-confirms it from the frame
  side). Exactly one Accept, one Decline, one Waitlist — confirmed.
  `.chq-detail-aside`'s decision rail is confirmed absent at phone width
  (no duplicate rail).
- **OUT OF SCOPE**: `Chautauqua Submissions.dc.html:298`'s co-presenter
  caption ("A new co-presenter is emailed a portal link…") sits outside
  both of this task's line ranges (`:137-181`, `:355-393`). It is already
  adjudicated in DEVIATIONS.md ("Co-presenter add row keeps its no-email
  truth over the frame's caption", DEC-909 wave-134, confirmed by DEC-380
  wave-139): the app keeps its truthful sentence
  (`SubmissionDetailPage.tsx:1855`) because the submissions routes never
  import a mailer. Not graded by this task's frame-verdict test since it
  is not a literal drawn within either frame this task owns.

No code changes were needed on this frame either; nothing in
`SubmissionDetailPage.tsx` or `detail.css`'s terminal block required a
fix — every literal and every already-ruled divergence was already
correctly implemented prior to this task, just previously unclaimed by a
real-route render test. (DEC-976 wave-12: `Submissions.frame-verdicts.
render.test.tsx`'s clause (a) had drifted false — it asserted the back
link "never" renders the frame's bare `‹ Triage` text, when `detail.css`'s
terminal block hides `.chq-detail-back-full` and shows only
`.chq-detail-back-short` ("Triage") at phone width, so the screen reads
exactly that bare text. Retired to a MATCHES clause with the CSS-text
receipt inline, agreeing with this section's verdict above.)

## Summary

| Frame | Literals | Verdict | Live gaps |
| --- | --- | --- | --- |
| Submissions · 390 (`:137-181`) | 13/16 → now render-verified | MATCHES | none |
| Submission detail · 390 (`:355-393`) | 10/15 → now render-verified | MATCHES | none |

Both frames' remaining un-cited literals are either sample-data literals
graded by SHAPE (never pinned verbatim, per DEC-967) or the two
out-of-scope items above (bottom app tab bar, co-presenter caption at
`:298`) that this task's file ownership does not reach.
