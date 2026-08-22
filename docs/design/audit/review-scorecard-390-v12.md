# Reviewer scorecard · 390 frame verdict (task w31-i, DEC-976 wave-31)

Frame: `docs/design/Chautauqua Review.dc.html:280-345` ("Reviewer scorecard ·
/review/plans/:id/submissions/:id", caption line `:279` reads
":280-350" — "Reviewers only ever see this"). Before this task the frame's
only citers were `app/src/pages/review/scorecard-phone-frames.test.ts` (a
CSS-TEXT scan pinning `scorecard.css`'s terminal `max-width:700px` block and
`Scorecard.tsx`'s source, per its own header comment) plus product source
itself — 14 of the frame's 21 drawn literals asserted, with no markup-level
render verdict for the frame at all.

`app/src/pages/review/Scorecard.frame390.render.test.tsx` is that first
render verdict. It mounts the REAL `/review/plans/:id/submissions/:id`
route the exact way `Scorecard.render.test.tsx` does (copied verbatim, never
a second mock stack, DEC-663), with a stubbed phone `matchMedia`
(`app/src/pages/contacts/DirectoryRail.phone390.render.test.tsx`'s own
pattern) so `Scorecard.tsx`'s `isPhone`-gated branches are the ones that
mount, and asserts DOM structure/order — jsdom applies no `@media`, so every
claim there is about markup, never computed geometry.

Frame `:934-1138` ("Scorecard · a criterion unscored") is a **different**
frame, owned by `Scorecard.unscored390.render.test.tsx` (v12m-w29-c); this
task does not touch that file and does not re-verdict that frame.

## Verdict: MATCHES

Every drawn element this task's scope names is present, in drawn order, at
its cited class, once `Scorecard.tsx` is mounted phone-width:

- `:283`/`:284` — the back link (`.chq-review-back`, SHAPE `‹ <plan> queue`)
  and the right-flushed counter (`.chq-review-scorecard-phone-progress`,
  SHAPE `N of M done`) are siblings inside the same
  `.chq-review-scorecard-back-row`, never concatenated into one string. The
  counter never also lands in the desktop `#chq-header-slot` portal target
  (`.chq-review-scoped-progress-caption`) at phone width — exactly one
  counter node exists (see the header-slot note below).
- `:286` — the `<plan> · <track> · round <n>` eyebrow (`.chq-section-label`
  inside `.chq-review-scorecard-head`), SHAPE.
- `:287` — the submission title (`.chq-review-scorecard-title`, an `<h1>`),
  SHAPE.
- `:288` — the `ref · format(, duration) · level` meta line
  (`.chq-review-scorecard-meta`), SHAPE.
- `:293`/`:294` — the `Abstract` eyebrow (literal, structural copy — a real
  `<h2>`) and the abstract body (`.chq-review-scorecard-abstract`), SHAPE.
- `:295` — `Read the full submission`, a literal control label (not sample
  data), mounted only at phone via the checkbox+`<label>` disclosure idiom,
  at its 44px floor via `.chq-review-answers-toggle` (the class
  `scorecard.css`'s terminal block raises to `min-height:44px`, per
  `scorecard-phone-frames.test.ts`'s own CSS-text pin — this render test
  asserts the class is present on the actual rendered label rather than
  re-deriving the pixel floor, which is that other file's job).
- `:301`/`:302`/`:304` — each criterion's label / weight caption
  (`.chq-review-criterion-weight-caption`, SHAPE `Weight N · NN%`) / hint
  (`.chq-review-criterion-guidance`) render inside that criterion's own
  `<fieldset>`.
- `:308` — the rating scale's own pill row (`role="radio"` buttons,
  SHAPE numeric values, one per scale step).
- `:315` — the Choice criterion's stacked option rows (`role="radio"`
  inputs, one per `criterion.options` entry, SHAPE labels).
- `:342`/`:343` — the terminal dock (`.chq-review-scorecard-dock`), exactly
  two buttons in drawn order — `Submit and next` (`.chq-btn-primary`) then
  `Save draft` (`.chq-btn-secondary`) — at their 46px floor via
  `.chq-review-scorecard-dock .chq-btn` (scorecard.css terminal block). The
  desktop `.chq-review-editor-actions` pair never co-mounts at phone width.

No fix was needed in `Scorecard.tsx` or `scorecard.css`'s terminal
`max-width:700px` block to reach this verdict — the wave-3/wave-20/wave-72/
wave-85/wave-129/wave-159 amendments already cited inline in both files had
already built every element this task's scope names; this task's
contribution is the first markup-level receipt that those claims actually
hold when the real route renders, not just that the CSS text and source
comments say so.

## Header-slot contract (note, no fix needed)

`Scorecard.tsx` portals the desktop counter into the shell's
`#chq-header-slot` (`createPortal`, gated `!isPhone`) but renders the phone
counter as a plain local `<span className="chq-review-scorecard-phone-progress">`
(gated `isPhone`) — never both at once, and never the same node. The render
test asserts on the phone span specifically (scoped under
`.chq-review-scorecard-back-row`) and separately asserts
`document.querySelectorAll('.chq-review-scoped-progress-caption')` is empty,
so a broken phone stub (matchMedia not taking, `isPhone` staying `false`)
fails loudly instead of the test silently re-matching the desktop portal's
text by accident.

## Literals out of this task's scope (still covered only by CSS text / source)

Per this task's own enumerated scope, the render test above does not assert
the frame's Overall block (`:322-328`, four sub-literals: the `Overall`
eyebrow, the weighted-mean denominator sentence, the plain-average
reconciliation sentence, and the `4.5` value — all already covered by
`scorecard-phone-frames.test.ts`'s CSS-text pins over the wave-159
`.chq-review-overall` grid rules plus `Scorecard.tsx`'s own source), the
`Comment to the committee` eyebrow/textarea, or the `Recuse me — conflict of
interest` phone-label swap (also already CSS/source-covered, per the
wave-20 `hidden`-attribute idiom scorecard.css's terminal block implements).
Those seven remaining literals stay at their prior citation level; closing
that gap is a separate task's scope, not this one's.

## DIVERGES

None found. Every element this task's scope enumerates renders in drawn
order at the frame-cited geometry classes, with no fix required in either
file this task may touch.
