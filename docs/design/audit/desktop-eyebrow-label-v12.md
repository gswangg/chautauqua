# Frame drawn-eyebrow ledger, desktop (non-390) — DEC-986 wave-41

Instrument: `test/desktop-eyebrow-label.scan.test.ts`. This ledger is the
DESKTOP half of the population `test/frame-eyebrow-label.scan.test.ts`
named, in writing, as its own "Next population, deliberately not built
here": the desktop (non-390) card frames, graded by the same uppercase /
control-face / input-box disjointness rules the phone ledger applies. It
PORTS that file's extraction grammar (never imports — `test/frame-eyebrow
-label.scan.test.ts` is held by in-flight `v12m-w40-c`). DESKTOP IS FROZEN:
this instrument MEASURES AND ADJUDICATES ONLY; no product byte and no CSS
were changed.

## Population: 245 eyebrows across all 13 `docs/design/*.dc.html` files

Derived at test time (`readdirSync`, never hand-listed, DEC-808). Frame
identification is PORTED from `test/desktop-frame-ledger.scan.test.ts`'s
own label-per-frame walk (that file's `allFramesInFile` function, whose
`isPhone` predicate this task's own brief cites by line number): every
`font-size:19px ... >TITLE<` label line opens a frame; the frame's extent
runs to the next such label, CLIPPED at the file's own single `</x-dc>`
line if that comes first (DEC-967 wave-41: an extent must end at the pack
template's own close, never at EOF, matching the shape `v12m-w41-d` applies
to the four pre-existing desktop ledgers). A frame is DESKTOP when its
(clipped) extent contains no `width:390px`+`height:844` line anywhere in
it — the exact `isPhone` predicate that file's own header states.

**A wrinkle measured this wave, not assumed going in:** a desktop label
line is frequently followed, BEFORE the card itself opens, by a
design-rationale annotation span painted in the identical
`font-size:11px; text-transform:uppercase` idiom the eyebrow grammar
matches — e.g. `Chautauqua Account.dc.html:29`, `` "Forgot your password?"
starts the reset below `` — a note to the mockup's own reader about *why*
the screen looks this way, never text the product renders. The phone
ledger never meets this row: its own frame anchor is the `width:390px` DIV
itself, which opens *after* that annotation span, so the row sits outside
its extent by construction. A bare label-line anchor has no such boundary,
so this ledger additionally restricts EYEBROW EXTRACTION (never frame/
`isPhone` classification, which stays label-anchored per this task's own
citation) to the sub-extent starting at the pack's own non-390 card
signature line — `background:#F4F1E8; border:1px solid #D3CFC0;
border-radius:6px; overflow:hidden; box-shadow:0 18px 44px
rgba(27,29,23,0.13)` — the same signature and the same content-extraction
anchor `test/desktop-control-label.scan.test.ts`'s own `framesInFile`
already uses, ported here rather than invented fresh. A label extent with
no card signature anywhere inside it (an explainer/style-guide panel with
no drawable card of its own) contributes nothing to the population.

Inside each card sub-extent, an eyebrow candidate is extracted by the
IDENTICAL grammar the phone ledger uses: a
`<span|div style="...">TEXT</span|div>` whose style carries
`text-transform:uppercase`, whose own TEXT contains no `<`, `>` or `{{`,
and is `>= 2` chars after trim; a candidate whose own style carries a
control face (`min-height` + `border-radius` + (`border:1px` or
`background:`)) is dropped (control-label ledger territory), and a
candidate followed within a 400-char sibling window by an input-shaped box
(`border:1px solid #BAB6A6` with a `border-radius`) is dropped (field-label
ledger territory).

## Disjointness argument, asserted directly

1. **Caption ledger** (`test/frame-caption-ledger.scan.test.ts`) — that
   ledger covers every frame in the pack, phone AND desktop, but excludes
   `text-transform:uppercase` by its own stated grammar; this ledger
   requires it. Verified against the live `ALL_CAPTIONS` export — 0
   overlapping `(fileName, line)` rows.
2. **Desktop control-label ledger**
   (`test/desktop-control-label.scan.test.ts`) — that ledger's population
   is footer/anchor/painted-span CONTROL shapes over the same non-390
   card-signature frames. This ledger's own control-face drop already
   excludes any candidate sharing that ledger's face grammar; verified
   directly against the live `ALL_LABELS` export — 0 overlapping rows.
3. **Phone eyebrow ledger** (`test/frame-eyebrow-label.scan.test.ts`) —
   every population row is re-checked directly against this file's own
   `isPhone` predicate and confirmed `false` — structurally disjoint from
   the phone population's `width:390px`+`height:844` signature.

## Per-file breakdown (population size / DIVERGES count)

| File | Eyebrows | DIVERGES (graded per DEC-986 wave-41) |
| --- | --- | --- |
| Chautauqua Account.dc.html | 4 | 0 |
| Chautauqua Agenda.dc.html | 3 | 2 |
| Chautauqua Comms.dc.html | 19 | 7 |
| Chautauqua Contacts.dc.html | 14 | 6 |
| Chautauqua Content.dc.html | 6 | 4 |
| Chautauqua Docs.dc.html | 13 | 12 |
| Chautauqua Home.dc.html | 5 | 0 |
| Chautauqua Overview.dc.html | 48 | 20 |
| Chautauqua Public and Portal.dc.html | 35 | 11 |
| Chautauqua Review.dc.html | 26 | 13 |
| Chautauqua Settings.dc.html | 34 | 13 |
| Chautauqua Speakers.dc.html | 20 | 10 |
| Chautauqua Submissions.dc.html | 18 | 5 |
| **Total** | **245** | **103** |

## Grades

- **MATCHED**: 141 — the eyebrow's text occurs verbatim (case-folded,
  comment-stripped, entity-decoded, whitespace-collapsed) in the non-test
  `app/src/**`/`src/**` corpus, OR its digit-collapsed skeleton occurs
  verbatim in the digit-collapsed corpus (same two-tier join
  `test/frame-eyebrow-label.scan.test.ts` uses, imported from
  `./frame-source-corpus`, DEC-613).
- **UNRESOLVED**: 1 — `Chautauqua Review.dc.html:202`, `Wave 2 · AI
  Engineering · round 1`. COMPOSED-from-data: `scorecardEyebrow`
  (`app/src/pages/review/Scorecard.tsx`,
  `` [plan.name, planTrackScope(...), planNamesRound(plan.rounds) ?
  roundLabel(...) : null] ``) joins the plan name, track scope and round
  label from the live review plan, never the frame's fixed string — the
  identical composing expression the phone eyebrow ledger's own
  `DIGIT_COMPOSED` table already verified for its own instance of this row
  (see `docs/design/audit/frame-eyebrow-label-390-v12.md`).
- **DIVERGES**: 103 — every other unmatched row, graded at face value (see
  "Scope narrowing" below), under DEC-986 wave-41's own face-value grading
  rule for this ledger: DESKTOP IS FROZEN, so this wave measures and
  adjudicates the bucket without repairing any row in it. No `SETTLED` rows
  this wave.
- **SETTLED**: 0.

Row-count accounting (DEC-808, DEC-976): MATCHED + UNRESOLVED + DIVERGES +
SETTLED = 141 + 1 + 103 + 0 = 245 = population, asserted directly in the
test suite.

## Scope narrowing, stated honestly

The desktop population (245 rows) is roughly 4x the phone ledger's 62,
because every non-390 card carries its own copy of this pack's shared
eyebrow idiom, repeated per file rather than shared like the phone
footer/nav chrome is. Individually verifying every miss's composing source
expression — the labour the phone ledger's own wave-33 lane spent an
entire wave on, for 16 rows — is out of THIS task's own scope for 103
rows. This wave verifies only the one row (`Chautauqua Review.dc.html:202`)
the phone eyebrow ledger already verified for the identical composing
expression at its own coordinates (DEC-180: a discriminator narrows the
miss classification, it never hides a real offender after classification).

Every other unmatched row is graded DIVERGES at face value, per DEC-986
wave-41's own scope for this ledger. Sampling the 103 rows by hand shows at
least three distinct shapes inside that single bucket, none of them repaired
here (DESKTOP IS FROZEN):

1. **Composed-from-data misses this wave did not individually verify** —
   e.g. `Chautauqua Comms.dc.html:81`, `Recipients · 23`; a live recipient
   count, the same COMPOSED shape the phone ledger's own `DIGIT_COMPOSED`
   table names for its sibling rows, simply not re-derived here.
2. **A repeated placeholder identity** — `Jordan A.` (and `Jordan A. ·
   Sign out`), the pack's own stand-in for "the signed-in organiser's
   name", drawn in nav/footer chrome across roughly a dozen frames; the
   live app renders the actual signed-in user's name, never this literal
   string, in `app/src/App.tsx`'s nav header identity block. One real
   composing fact, counted once per frame it recurs in.
3. **Style-guide / documentation prose painted in the pack's eyebrow
   idiom** — e.g. `Chautauqua Docs.dc.html:249`, `01 · Prose`, one of nine
   numbered section eyebrows inside a design-reference frame explaining the
   Docs article system to the pack's own reader, not literal product copy
   any route renders; `Chautauqua Overview.dc.html`'s interaction-states
   reference frame (`Live · hover me`, `Rows and cells`, `Border only on
   hover · outline on focus`, …) is the same shape, and accounts for most
   of that file's 20.

None of these three shapes is adjudicated row-by-row here — that
individual pass, and the possible follow-on question of whether shape (3)
belongs in this population at all (an explainer-panel exclusion, the same
disposition `test/desktop-frame-ledger.scan.test.ts`'s own EXPLAINER
PANELS exclusion already gives a hand-picked three titles), is this
ledger's own next lane (see "Next work" below).

## Ratchets

- `DESKTOP_EYEBROW_DIVERGENCE_CEILING = 103` — hand-measured on branch
  `v12m-w41-f` by forcing to `-1` and reading the printed offender roster
  back.
- `DESKTOP_EYEBROW_UNRESOLVED_CEILING = 1` — same measurement technique,
  same branch.

Both two-sided (`test/campaign-ratchet-two-sided.scan.test.ts` verified
green: a companion `it` fails when the measured count falls below the
ceiling, forcing it down in the same commit that lands a fix). Both
registered in `scripts/exit-predicate/campaign-scope.ts`'s
`OUT_OF_CAMPAIGN_SCOPE` with a principle reason (DEC-099): a newly
measured, previously-uncounted population must not move the campaign's own
exit-gate goalposts mid-convergence — the same disposition already given
to `FRAME_EYEBROW_DIVERGENCE_CEILING` / `FRAME_EYEBROW_UNRESOLVED_CEILING`
and to `DESKTOP_FLOOR_DIVERGENCE_CEILING` /
`DESKTOP_FLOOR_UNRESOLVED_CEILING`.

## Next work, deliberately not built here

1. **The individual composed-expression verification pass** the phone
   ledger performed for its 16 UNRESOLVED rows, applied to this ledger's
   103 DIVERGES rows — likely to promote a meaningful fraction of them to
   UNRESOLVED (shape 1 above) the same way the phone ledger's wave-33 lane
   did. Deferred, not undecided: DEC-986 wave-41 scopes this wave to
   measurement and adjudication only, and the bucket it leaves behind is
   already graded at face value above.
2. **A possible explainer-panel exclusion for shape 3** (documentation/
   style-guide prose painted in the eyebrow idiom, distinct from product
   copy) — whether this belongs in the population at all is an open
   question this wave states rather than settles, deliberately, given the
   time this task's own scope allows.
3. **A possible SETTLED row for shape 2** (`Jordan A.`) once a ruling
   adjudicates whether a repeated placeholder identity across a dozen
   frames is a single settled divergence (the same disposition
   `frame-eyebrow-label-390-v12.md`'s own `SETTLED_EXCLUSIONS` table
   already gives its two rows) or 103 independent ones.
