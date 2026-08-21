# Starved flex-track ratchet at 390 (task v12m-w5-bf, wave-149, DEC-919/DEC-991)

> A row recorded here is a claim about the tree, not a permanent record. It
> is re-derived against current code before it is scheduled: forcing
> `STARVED_FLEX_TRACK_CEILING` (`app/src/phone-overflow-scan/
> starved-track-ceiling.ts`) to `-1` and re-running
> `app/src/phone-horizontal-overflow.scan.test.ts` prints the live offender
> list. Once a row stops reproducing (its stylesheet re-lines to a single
> column, or gains a real `display: flex`/`display: none` phone override),
> it should be dropped from the table below and the ceiling lowered in the
> same commit (DEC-989's two-sided-ratchet shape).

## What this instrument grades

Two DEC-919/DEC-991 wave-149 amendments landed together in this commit
because the second is unmeasurable without the first (a false-positive/
false-negative source, not just an incomplete count):

1. **Candidacy repair (DEC-991).** `app/src/phone-overflow-scan/rules.ts`'s
   `isPhoneCondition` recognises only `max-width: <=700px` — the sheet's own
   DEC-385 terminal phone block. A rule inside `@media (max-width: 900px)`
   is neither phone-scoped nor top-level under the old predicate and was
   dropped from the overflow scan's population outright, even though that
   block genuinely applies at the v12 390px frame. The new exported
   `appliesAt390(condition)` (true when the condition declares a
   `max-width: X` with `X >= 390` and no `min-width: Y` with `Y > 390`) now
   drives `mediaSpans`' `isPhone` flag, and through it both
   `isCandidateRule` and `effectiveBodyFor`'s cascade merge in
   `./cascade.ts`. `isPhoneCondition` is unchanged and stays a separate,
   narrower predicate — DEC-385's "where may a phone override be authored"
   question is not the same question as "what does a browser apply at
   390px", and the two must never share one predicate.

2. **New check, shape (E) — starved flex track (DEC-919).** A grid rule
   effective at 390 whose flexible track(s) receive less room than the
   grid's own widest fixed track has not "re-lined" in DEC-919's sense — the
   yielding column becomes unusable while every overflow-only ratchet
   (shapes A–D, all of which ask only whether FIXED content exceeds the
   budget) stays silently green, because the row *fits* by construction; it
   is simply crushed. `checkStarvedFlexTrack` (`./checks.ts`) flags this as
   its own shape, graded by its own ratchet
   (`STARVED_FLEX_TRACK_CEILING`), never folded into
   `OVERFLOW_OFFENDERS_CEILING`.

## Part A: the ten `@media (max-width: 900px)` blocks this widening brings into the population

Measured via `grep -rn "@media" --include='*.css' app/src | grep -oP
"max-width:\s*\d+px"` (and the equivalent over `src/**/*.ts` CSS-in-TS
literals): **10** blocks declare `max-width: 900px` — 7 in `app/src/**/*.css`,
3 in `src/**/*.ts` CSS-in-TS modules. Every one of these now participates in
`isCandidateRule`/`effectiveBodyFor` as a real phone-scoped override; none
did before this commit. The widening was measured to surface **zero** new
(A)/(B)/(C) offenders on this tree — `OVERFLOW_OFFENDERS_CEILING` stays `0`
and is asserted never-raised by
`phone-horizontal-overflow.scan.test.ts`'s own test for it.

The motivating case for the *false-positive* half of this repair:
`app/src/pages/agenda/agenda.css`'s top-level `.chq-agenda-layout` declares
`grid-template-columns: 1fr 268px` (a 268px fixed track, under the 358px
budget on its own, so it was never actually flagged as an (A)/(B) offender
either way). Its `@media (max-width: 900px)` override collapsing that same
selector to `grid-template-columns: 1fr` was invisible to the old
cascade-merge predicate; under the repaired one, the merge correctly reads
the collapsed single-track value. This selector is not itself a
starved-flex-track offender (a single `1fr` track has no fixed neighbour to
starve against, so `checkStarvedFlexTrack`'s "≥2 tracks, at least one fixed
and one flexible" grammar gate excludes it) — it demonstrates the mechanism,
not a listed offender below.

## Part B: the two starved-flex-track offenders, repaired and drained (DEC-808)

At landing, forcing `STARVED_FLEX_TRACK_CEILING` to `-1` and reading the
printed offender list back against the tree measured exactly two offenders:

| File | Selector | `grid-template-columns` | Arithmetic | Repairing lane |
|---|---|---|---|---|
| `app/src/pages/settings/settings.css` | `.chq-settings-track-edit-row` | `minmax(0, 1fr) 150px 200px` | budget 358px − fixed (150+200=350px) − gaps 0px = 8px ÷ 1 flexible track = **8.0px** per flexible track, against a 200px widest fixed track | v12m-w5-bg |
| `app/src/pages/forms/forms.css` | `.chq-forms-rule-row` | `1fr 120px 1fr` | budget 358px − fixed (120px) − gaps (2 × 10px = 20px) = 218px ÷ 2 flexible tracks = **109.0px** per flexible track, against a 120px fixed middle track | v12m-w5-bg |

Both figures matched the wave-149 meta-fidelity probe's own hand-measurement
verbatim (DEC-919's own amendment text). `.chq-settings-track-edit-row`'s
sibling `.chq-settings-room-edit-row` (same co-classed base, a fourth,
wider fixed track) was already re-lined to a single column at
`settings.css:2314` in an earlier wave — this row was the missed twin.

**Both offenders are repaired and the ledger is drained.** Each row was
re-lined into its own sheet's terminal `<=700px` phone block (DEC-919), and
the instrument that names them landed in the same batch. The ceiling was
seeded at the then-measured `2`, per DEC-069 wave-141/143's "a new ceiling
lands with its exit-predicate row and fixture in the same commit". The
integrated tree was then re-measured with the ceiling forced to `-1`
(DEC-808), confirming zero starved-track offenders remain, and
`STARVED_FLEX_TRACK_CEILING` was lowered from `2` to `0` per DEC-989
wave-146's standing rule. The two rows above are therefore a record of what
was fixed, not of work owed.

## The gap-attribution conservatism

`checkStarvedFlexTrack` reads `gap`/`column-gap` only from the rule's own
(possibly cascade-merged) effective body — never from a co-classed BASE
selector's own `gap` declaration. `.chq-settings-track-edit-row`'s real
on-screen row is `.chq-settings-edit-row.chq-settings-track-edit-row`
together; `.chq-settings-edit-row` alone declares `gap: 16px`, which this
check does not attribute to `.chq-settings-track-edit-row`'s own measured
arithmetic above. Counting it would push the row's real consumption to
150+200+2×16=382px of the 358px budget (an even worse starve than the
8.0px this check reports) — the check therefore **under-reports the
deficit and never over-reports it**, by design (documented in
`checkStarvedFlexTrack`'s own header and exercised by a dedicated test in
`phone-horizontal-overflow.scan.test.ts`).

## The display gate

`checkStarvedFlexTrack` only fires when the rule's EFFECTIVE `display` is
`grid`/`inline-grid` (or undeclared — see below); a `grid-template-columns`
declaration under an effective `display: flex`/`display: none` is inert at
390 and must never be flagged. Four selectors were measured to require this
gate to stay clean: `.chq-settings-row`, `.chq-settings-saved-embed-row`,
`.chq-review-queue-row` and `.chq-contacts-merge-compare-head` — each
declares `display: grid` at top level, and each carries a SAME-selector
`<=700px`/`<=900px` phone override collapsing it to `display: flex` or
`display: none`; the cascade merge already used by shapes (A)–(D) surfaces
that collapse to this check for free.

One asymmetry, deliberate: `.chq-settings-track-edit-row` never declares
`display` in its own rule at all (its `display: grid` comes from being
co-classed in markup with `.chq-settings-edit-row`, a different CSS
selector this per-selector scan never joins). The gate therefore excludes a
rule only when some override EXPLICITLY turns its effective display into
something other than grid — "no override says otherwise" stays a candidate,
rather than the gate silently swallowing every base-class-styled modifier
selector in the codebase.
