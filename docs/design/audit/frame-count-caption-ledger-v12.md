# Frame count-caption ledger (DEC-180 wave-28 amendment)

Built by `test/frame-count-caption-ledger.scan.test.ts` (task v12m-w28-h). Grades the pack's
digit-bearing muted-prose captions -- the population the caption ledger's own header names in
words ("a caption reading '18 more · 23 is under the 100-recipient cap' is a COMPOSED-from-data
render, graded by a different instrument were one to exist") but no instrument previously graded.

## Staleness note (read first)

DEC-180's wave-28 amendment states "Disjointness from the caption ledger is asserted directly --
that ledger's population excludes digits, this one requires one." That premise is stale:
`test/frame-caption-ledger/population.ts`'s own wave-142/w17-f comment records that the caption
ledger's digit discriminator was **retired** before this amendment was authored -- the amendment's
header text quotes the caption ledger's un-updated header *prose*, not its live grammar. Measured
directly on this branch: the caption ledger's live `ALL_CAPTIONS` (378 rows) already includes every
one of this ledger's 145 digit-bearing rows. The two populations are in **full containment**, not
disjoint -- `test/frame-count-caption-ledger.scan.test.ts`'s own "containment" test proves this
directly rather than asserting the ruling's stale premise. This is flagged for the scribe to
reconcile in a future amendment; the ruling's actual *directive* (build a new instrument with a
grader that differs from the caption ledger's by construction) is honoured regardless.

## Population

Same colour/length/no-`@` grammar as the caption ledger's own `ALL_CAPTIONS`, with the digit
discriminator inverted (>= 1 digit required rather than forbidden). Measured on this branch:
**145 rows across 13 files**.

## Exclusions

129 of the 145 rows already carry an established classification in the caption ledger's own
exclusion tables (`EXPLAINER_EXCLUSIONS`, `FIXTURE_EXCLUSIONS`, `EXEMPLAR_ARTICLE_EXCLUSIONS`,
`COMPOSED_EXCLUSIONS`, `SUPERSEDED_EXCLUSIONS`, `UNBACKED_EXCLUSIONS`). This ledger's own two
exclusion classes (EXPLAINER, FIXTURE -- folding EXEMPLAR_ARTICLE into FIXTURE, both being
"invented demo content no real screen owes") cite the SAME rows the caption ledger already
classifies as non-product-copy -- 6 EXPLAINER + 20 FIXTURE = 26 rows structurally excluded here,
never re-derived (DEC-613).

COMPOSED (87), SUPERSEDED (15) and UNBACKED (1) rows are **real product copy** in the caption
ledger's own taxonomy -- they stay IN this ledger's population and are graded by this ledger's own
(narrower) grader, exactly as any other population row.

## The 16 rows with no pre-existing caption-ledger exclusion citation

Every population row not covered by an existing caption-ledger exclusion, named individually, with
this ledger's OWN verdict under its narrower digit-collapse-only grader (MATCHED / UNMATCHED).
**None of these is a real content divergence regardless of this ledger's own verdict** (DEC-099 wave-34 clause (b): this denial's own word choice is a population artifact of the open-divergence ledger's widened "divergence" vocabulary catching this ledger's denial prose, adjudicated in place rather than hand-excluded) -- the
caption ledger's own `FRAME_CAPTION_UNMATCHED_CEILING = 0` means every one of them already resolves
under that ledger's stronger grader (verbatim join plus digit-skeleton second pass with
`${...}`/`{...}` merge-placeholder collapse). Listed here for completeness, not as open findings:

| Frame:line | Text | This ledger's verdict |
| --- | --- | --- |
| `Chautauqua Agenda.dc.html:131` | "6 unplaced · 2 clash" | UNMATCHED |
| `Chautauqua Comms.dc.html:110` | "3 of 23 have no slot yet — those get no invite" | UNMATCHED |
| `Chautauqua Comms.dc.html:404` | "Nothing sends until step 4" | MATCHED |
| `Chautauqua Comms.dc.html:531` | "All 21 are in History, each with the address it went to" | UNMATCHED |
| `Chautauqua Comms.dc.html:666` | "17 more · sent means the provider accepted it — whether it landed in an inbox is not something we hear back about" | UNMATCHED |
| `Chautauqua Comms.dc.html:757` | "Comms · Compose · step 3" | UNMATCHED |
| `Chautauqua Content.dc.html:56` | "5 need a decision · 2 re-uploaded" | UNMATCHED |
| `Chautauqua Content.dc.html:206` | "5 need a decision · 2 re-uploaded" | UNMATCHED |
| `Chautauqua Overview.dc.html:271` | "6 unplaced · 2 clash" | UNMATCHED |
| `Chautauqua Public and Portal.dc.html:162` | "9 sessions · 4 rooms" | MATCHED |
| `Chautauqua Public and Portal.dc.html:280` | "9 sessions · 4 rooms" | MATCHED |
| `Chautauqua Public and Portal.dc.html:801` | "4 saved · 2 overlaps" | MATCHED |
| `Chautauqua Review.dc.html:532` | "3 of about 7 · more than that and reviewers rush the last ones" | UNMATCHED |
| `Chautauqua Review.dc.html:738` | "Three to start with — two scored 1–5 and one recorded as a spread. Rename them, change the type or the weights, or remove any you don't want." | MATCHED |
| `Chautauqua Review.dc.html:779` | "3 of about 7 · more than that and reviewers rush the last ones" | UNMATCHED |
| `Chautauqua Submissions.dc.html:93` | "Kept across pages · sent in batches of 100" | MATCHED |

All 16 are ADJUDICATED by citation to the caption ledger's own zero-ceiling: they are real product
copy the app renders correctly, verified by a stronger, already-landed instrument
(`test/frame-caption-ledger.scan.test.ts`, `FRAME_CAPTION_UNMATCHED_CEILING = 0`) -- not a divergence
this lane leaves open. The 10 UNMATCHED rows above are an instrument-completeness fact about THIS
ledger's own narrower join (no merge-placeholder collapse), not new evidence of a copy gap.

## Grader and ratchet

The grader reuses `test/frame-source-corpus.ts`'s `enumerateSourceFiles` / `stripComments` /
`normalizeSource` verbatim (DEC-613), then collapses every digit run on both sides to one
placeholder token before a substring join -- deliberately **not** the caption ledger's own further
`${...}`/`{...}` merge-placeholder collapse, which lives in `test/frame-caption-ledger/match.ts` and
is that ledger's own private technique. Because this grader is strictly narrower, it resolves far
fewer composed rows than the caption ledger does -- that is the expected, by-construction shape of a
different, weaker instrument, not a product defect.

Measured on this branch (forced to -1, offender list read back): of 119 population rows after
exclusion, this narrower join resolves 6 (rows whose literal digit run and surrounding words appear
verbatim outside a `${...}`/`{...}` merge expression) and leaves **113 rows the weak grader alone
cannot verify** -- printed, non-ratcheted, as `WEAK_GRADER_UNMATCHED`.

**Three verdicts (DEC-180 wave-55 amendment).** The wave-42 amendment ran the caption ledger's own
stronger, merge-placeholder-aware grader (imported from `test/frame-caption-ledger/match.ts`) over
those 113 rows and found it resolved all of them -- but recorded that fact as a SECOND ratcheted
constant, `COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING`, over the same 113-row population
`FRAME_COUNT_CAPTION_UNMATCHED_CEILING` graded: two constants over one fact, a duplicate-vocabulary
trap that meant the parked 113-row ceiling could never clear DEC-069 promotion clause (a). Wave-55
resolves this by giving the ledger an explicit third verdict instead of a second ratchet:

1. **CAPTION-LEDGER-RESOLVED** (`CAPTION_LEDGER_RESOLVED`, printed roster, not ratcheted) -- rows
   the weak grader misses but the caption ledger's stronger grader resolves. Derived structurally
   from `resolvesUnderCaptionLedger`, never hand-listed. Measured on this branch: **113 rows** --
   all of `WEAK_GRADER_UNMATCHED`, matching the wave-42 finding that the stronger grader resolves
   every row the weak one misses.
2. **UNMATCHED** (`UNMATCHED`, ratcheted by `FRAME_COUNT_CAPTION_UNMATCHED_CEILING`) -- rows
   NEITHER grader resolves. Byte-identical in meaning to the now-deleted
   `COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING`. Measured on this branch: **0 rows**.
3. **WEAK_GRADER_UNMATCHED** (printed diagnostic, not ratcheted) -- the original weak-grader-only
   113-row count, kept so no measurement made by this ledger's own technique is lost. Every row in
   it is now either CAPTION-LEDGER-RESOLVED or (ratcheted-)UNMATCHED, exactly partitioned.

`FRAME_COUNT_CAPTION_UNMATCHED_CEILING` now reads **0** and is **promoted**: removed from
`scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE` / `PARKED_FIDELITY_PROMISES` and added to
`CAMPAIGN_CONSTANT_NAMES` / `TIER2_CEILING_NAMES` as a graded, green conformance row -- the same
promotion `SSR_CLASSLESS_CONTROL_CEILING` received in wave 45.

This lane MEASURES AND RATCHETS ONLY -- it moves no product byte.
