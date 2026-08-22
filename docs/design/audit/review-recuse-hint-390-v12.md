# Review 390 "a criterion unscored" — per-criterion recuse hint (w32-a)

Findings surfaced while implementing w32-a (DEC-889 wave-32 amendment):
the frame's per-criterion recuse hint, the pack's one confirmed unowned
content gap per v12m-w29-c's audit for :934-979 and this wave's own
verification (`grep -rn "recuse yourself" app/ src/` on main matched only
`src/routes/docs-content/reviewing-start-to-finish.ts`).

## RESOLVED — the per-criterion recuse hint (:964)

**Frame**: `docs/design/Chautauqua Review.dc.html:964`, under the unscored
criterion's score row inside frame "Scorecard · a criterion unscored"
(:934-1138):

```
<span style="font-size:13px; font-weight:600; line-height:1.5; color:#1B1D17">Pick a score, or recuse yourself if you cannot judge this one.</span>
```

**Drawn value**: `Pick a score, or recuse yourself if you cannot judge this
one.` at 13px/600/line-height 1.5/#1B1D17.

**Shipped value**: identical sentence, returned verbatim by the new
`unscoredCriterionHint()` in `app/src/pages/review/scorecardLogic.ts`
(beside the existing `unscoredBannerCopy`), rendered in
`app/src/pages/review/Scorecard.tsx` as
`<span hidden className="chq-review-criterion-hint-phone">` inside each
criterion's own `<fieldset>`, keyed on
`incomplete.some((c) => c.id === criterion.id)` alone — never on
`attempted`, per DEC-889 wave-32's own ruling that this state is LIVE and
"never gated behind an attempted submit," matching
`scorecardLogic.ts`'s existing comment for the sibling
`unscoredBannerCopy` banner. Revealed phone-only by one appended rule
inside `scorecard.css`'s existing terminal `@media (max-width: 700px)`
block (`display:block; font-size:13px; font-weight:600; line-height:1.5;
color:var(--chq-ink)` — `--chq-ink` is `#1b1d17` in `app/src/styles.css`),
the same `hidden`-attribute + terminal-block idiom the file already
documents for `.chq-review-overall-value-phone`. No top-level rule added;
no desktop byte moved; no `matchMedia`/`useIsPhone` read (DEC-385
single-direction).

**Owning file**: `app/src/pages/review/Scorecard.tsx`,
`app/src/pages/review/scorecardLogic.ts`,
`app/src/pages/review/scorecard.css`.

**Test**: `app/src/pages/review/Scorecard.recuseHint390.render.test.tsx`
(render, DOM-scoped per criterion via `within`, DEC-874) +
`app/src/pages/review/scorecardLogic.test.ts` (pure copy pin).

## RESOLVED — the pre-existing verdict test that asserted the opposite of the built copy

**File**: `app/src/pages/Review.frame-verdicts.render.test.tsx`
(read-only to w32-a; outside that task's owned-files list, so w32-a
recorded the gap here rather than reaching into it).

That test's own comment read the :957-964 gap exactly as the earlier audit
(DEC-976) did — "the frame's own caption ... does not exist as separate
copy on this scorecard" — and asserted
`expect(screen.queryByText(/Pick a score, or recuse yourself/)).not.toBeInTheDocument()`.
Its fixture (two criteria, one unscored) finds the hint this task ships
(`@testing-library`'s `queryByText` does not filter on the native `hidden`
attribute the way `*ByRole` queries do), so the assertion was stale
against the newly-built product.

Closed at megabatch integration, exactly as predicted above: the
`.not.toBeInTheDocument()` clause is now a `within`-scoped presence check
inside the unscored criterion's own fieldset, mirroring this task's own
test. `app/src/pages/review/Scorecard.unscored390.render.test.tsx` carried
the identical stale receipt and moved the same way. Neither product byte
changed — the divergence was closed by DEC-889 wave-32 building the hint,
and only the two receipts were stale.
