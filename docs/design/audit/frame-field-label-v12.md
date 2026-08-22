# Frame FIELD-label ledger

DEC-180 wave-24 amendment. Instrument: `test/frame-field-label.scan.test.ts`.

**MEASURES AND FILES ONLY.** This lane moves zero product bytes and
repairs no row -- a lane that both widens a population and drains it can
always drain by narrowing.

DEC-180: "The three divergences [DEC-613] rules on were found by hand, not
by any instrument." Nothing in the tree graded whether the pack's drawn
FIELD labels ("Event name", "Starts", "From which plan", ...) are the
words the app actually renders. The two frame ledgers measure CITATION.
The two control-label ledgers (`test/frame-control-label.scan.test.ts`,
`test/desktop-control-label.scan.test.ts`) grade CONTROL-shaped
populations (footer bands, 44px anchors, painted spans). The field-width
ledger (`test/desktop-field-width.scan.test.ts`) uses a field label only
as a JOIN KEY toward a WIDTH fact, and its own Adjudications say plainly:
"a words-only ledger ... is the correct instrument for that fact, not this
one." This is that instrument.

## Population

readdirSync over `docs/design` for `*.dc.html` (13 files; 11 of them carry
at least one qualifying label, see "0 rows" note below). Frame extents are
the label/extent walk every sibling ledger already shares: a frame's title
is the nearest preceding `font-size:19px ... >TITLE</span>` label; its
extent runs to the next such label or EOF. An extent is PHONE-side when
its own text carries both `width:390px` and `height:844`, DESKTOP-side
otherwise.

Inside each extent, a FIELD LABEL is a `font-size:1[12]px` `<span>` whose
text node is 2-44 characters after trim, excluding a bare numeral, a
`Word · N` count composition, and any text containing `{{` (a template
interpolation) -- the same exclusion grammar `test/frame-control-label.
scan.test.ts` already applies to its own population -- **and** which is
followed, within the next 5 lines of the same file, by an input-shaped
`border:1px solid #BAB6A6` box.

This population is intentionally NARROWER than a raw "every 11px/12px
caption" scan: requiring the adjacent input-shaped box is what makes a row
a real FIELD label rather than a section heading, a stat caption, or a
chip. Measured on the integrated tree (v12m-w24-h, `f4e59770b`): **175**
qualifying rows, 29 phone-side, 146 desktop-side.

## Match side

Every non-test `.ts`/`.tsx` file under `app/src/**` and `src/**`
(`test/frame-source-corpus.ts`'s shared `enumerateSourceFiles`, which
already skips `src/decisions-data/**` and `src/decisions.ts` per DEC-976
wave-129 amendment (c): a ruling's own prose must not satisfy the ledger
it rules on), comment-stripped and entity-decoded via that same module's
`normalizeSource` (a comment-quoted label must never satisfy the ledger,
DEC-967). 604 files scanned. Four call-site shapes, attribute-order
independent:

- `<FormRow label="…">` (`app/src/components/ModalFrame.tsx`)
- `<SettingsField label="…">` (`app/src/pages/settings/SettingsEditForm.tsx`)
- a `<label>`'s own text node
- a complete, statically-quoted `aria-label="…"` value (an
  `aria-label={...}` JSX-expression form is not "complete" and is not
  extracted)

174 distinct match-side label strings were found.

## Grade

- **MATCHES** when the drawn label's exact text is in the match set, or
  (composed-suffix tier) the drawn label carries the shared ` · optional`
  suffix (`src/domain/form-copy.ts`'s `OPTIONAL_SUFFIX`) and its base word
  is in the match set -- `FormRow`/`SettingsField` compose the suffix span
  separately from their own `optional` prop, so the call site's `label=`
  attribute never itself carries the suffix.
- **UNRESOLVED** (machine-derivable reason, never an allowlist) when the
  row's own input-shaped box, on the line it was found, itself contains
  `{{` -- a templated/repeated list-row VALUE this join's four static
  call-site shapes cannot resolve to one component instance no matter how
  the label is spelled.
- **DIVERGES** (DEC-180) otherwise -- the join had a definite static
  call-site shape to check against and found none carrying this exact text.

Measured totals: **100 matches / 73 diverges / 2 unresolved** (partitions
the 175-row population exactly).

## Per-file breakdown

| File | Total | Matches | Diverges | Unresolved |
|---|---|---|---|---|
| `Chautauqua Account.dc.html` | 13 | 3 | 10 | 0 |
| `Chautauqua Agenda.dc.html` | 4 | 3 | 1 | 0 |
| `Chautauqua Comms.dc.html` | 7 | 2 | 5 | 0 |
| `Chautauqua Contacts.dc.html` | 16 | 10 | 6 | 0 |
| `Chautauqua Content.dc.html` | 1 | 0 | 1 | 0 |
| `Chautauqua Overview.dc.html` | 12 | 6 | 5 | 1 |
| `Chautauqua Public and Portal.dc.html` | 40 | 28 | 12 | 0 |
| `Chautauqua Review.dc.html` | 11 | 3 | 7 | 1 |
| `Chautauqua Settings.dc.html` | 40 | 27 | 13 | 0 |
| `Chautauqua Speakers.dc.html` | 8 | 3 | 5 | 0 |
| `Chautauqua Submissions.dc.html` | 23 | 15 | 8 | 0 |
| **Total** | **175** | **100** | **73** | **2** |

(`Chautauqua Docs.dc.html` and `Chautauqua Home.dc.html` draw no
qualifying field label under this grammar -- no `font-size:1[12]px` span
sits within 5 lines of a `border:1px solid #BAB6A6` box anywhere in either
file -- and so contribute 0 rows, not an omission.)

## Unresolved rows (2)

1. `Chautauqua Overview.dc.html:673` -- **"Never animated"** (frame:
   `States · hover, pending, drag`, desktop). A states-legend caption over
   a hover/pending/drag demo strip; the adjacent box's `{{ }}`-templated
   value marks it as a repeated legend row this join has no single
   component instance to check against.
2. `Chautauqua Review.dc.html:627` -- **"Weight"** (frame:
   `Plan editor · 390`, phone). The phone reviewer-weight row sits over a
   `{{ }}`-templated per-criterion value (a repeated criteria list), the
   same shape.

## Diverging rows (73)

The full offender list is printed verbatim by
`test/frame-field-label.scan.test.ts`'s own failing-assertion path when
`FRAME_FIELD_LABEL_DIVERGENCE_CEILING` is forced below the measured count;
it is not re-transcribed here to avoid a second copy that can drift from
the instrument (DEC-613). Representative samples, by file:

- **Account**: `Password` / `Current password` / `New password` /
  `New password again` (desktop and phone) -- the account auth forms use
  their own dedicated markup, not `FormRow`/`SettingsField`/`<label>`/
  `aria-label`.
- **Comms**: `From which plan` (`Chautauqua Comms.dc.html:102`, desktop,
  `Compose · step 3 of 4`) -- the frame's own label; the app renders
  `Evaluation plan` for the equivalent control. Named in DEC-613 as one of
  the three hand-found divergences this instrument now grades formally.
- **Settings**: `Event name` (`Chautauqua Settings.dc.html:735` and
  `:1249`, both desktop) -- the frame's own label; the app renders `Name`.
  Also named in DEC-613.
- **Overview / Review / Speakers**: several rows (`Complete`, `Pending`,
  `Overdue`, `Accept`, `Decline`, ...) are control-shaped words drawn at
  field-label font sizes next to a bordered demo box in a states/legend
  strip, not real form fields with a `FormRow`/`SettingsField` call site --
  a known shape of this join's population (a caption that happens to sit
  near an input-shaped box is drawn into the population honestly, and
  grades DIVERGES honestly under DEC-180, rather than being excluded by an
  allowlist).

## Adjudications

- **No row here is repaired by this lane** (DEC-180 wave-24 amendment: a
  lane that both widens a population and drains it can always drain by
  narrowing). DIVERGES is the correct grade
  for every row above under this join's grammar, including rows where the
  underlying UI is arguably fine (e.g. a states-legend word that the app
  never needs to render verbatim as a form field) -- this instrument
  grades WORDS-ON-FIELDS fidelity, not UI correctness, and a future lane
  may find some of the 73 are non-issues once inspected by eye; that
  inspection is out of this lane's scope.
- **Composed-suffix tier is a narrowest-reasonable interpretation.** The
  task names one algorithmic exception to the plain exact-match join (the
  shared ` · optional` suffix); no other fuzzy-matching tier is applied.
  A label that differs from its call site by anything other than that one
  suffix grades DIVERGES, never a near-miss MATCH (DEC-180).
- **UNRESOLVED's reason is structural, not an allowlist.** Both UNRESOLVED
  rows are flagged by the SAME machine-derivable signal (the adjacent
  input-shaped box itself contains `{{`), not by a per-row exemption
  table -- a third templated row appearing anywhere in the pack would be
  caught by the identical rule with no ledger edit required.

## Megabatch merge note (Thunderdome)

Two sibling lanes this wave repaired rows counted here. Both have LANDED;
this section records what they closed, as a fact about the past:

- **v12m-w24-e** (DEC-180; Settings `'Event name'`/`'Starts'`/`'Ends'`):
  repaired the `Event name` DIVERGES rows at
  `Chautauqua Settings.dc.html:735` and `:1249` (both desktop) among this
  ledger's original 73.
- **v12m-w24-g** (DEC-613; Comms `'From which plan'`): repaired the
  `From which plan` DIVERGES row at `Chautauqua Comms.dc.html:102`
  (desktop) among this ledger's original 73.

On integrated main the count re-measured **71**, and
`FRAME_FIELD_LABEL_DIVERGENCE_CEILING` was LOWERED 73 -> 71 in the
merge-train's own re-measure commit, per this file's two-sided ratchet
discipline -- never left stale.
