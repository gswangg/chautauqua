# Frame drawn CONDITIONAL-STATE ledger — DEC-383 wave-29

Instrument: `test/frame-conditional-state.scan.test.ts`. Every population
this campaign has graded so far is made of WORDS the pack always draws
(screens, control labels, captions, eyebrows, field labels). This ledger
names the pack's STATE vocabulary instead: every `sc-if value="{{ ... }}"`
block, each of which commits the app to TWO renderings of one region — the
branch its `hint-placeholder-val` draws, and the branch it doesn't.
`docs/design/DESIGN-RULINGS.md`'s B8 ("interaction-states standard") names
this class of missing artifact; DEC-383's wave-58/60 amendments already
host both interaction-states scans. This lane MEASURES AND RATCHETS ONLY;
no product byte and no CSS were changed.

## Population: 23 sc-if rows across 6 of 13 `docs/design/*.dc.html` files

Derived at test time (`readdirSync` over `docs/design`, never hand-listed,
DEC-808). **POPULATION DISCREPANCY:** the DEC-383 wave-29 ruling prose
(`src/decisions-data/DEC-383.md`'s own "Amendment (wave 29)" section,
landed by the scribe ahead of this build) names 15 rows — Agenda (6),
Public and Portal (4), Speakers (3), Comms (2) — having enumerated those
four files by hand. The `readdirSync`-time population is 23: Review
contributes 7 rows (`c.isScale` ×2, `c.isChoice` ×5, across three separate
`width:390px`/`width:1600px` frames — the reviewer scorecard's rating-scale
vs. multiple-choice criterion rendering) and Settings contributes 1
(`f.note`, a per-field optional note inside the phone "Event" fields
list). This is exactly the DEC-808 doctrine in action: a hand-count in
ruling prose is not a population, and the code below grades all 23 rather
than the 15 the ruling names.

| # | File | Line | Expression | Hinted | 390? |
|---|------|------|------------|--------|------|
| 1 | Agenda | 85 | `cell.session` | false | no |
| 2 | Agenda | 90 | `cell.clash` | false | no |
| 3 | Agenda | 151 | `slot.placed` | true | **yes** |
| 4 | Agenda | 159 | `slot.clash` | false | **yes** |
| 5 | Agenda | 175 | `slot.free` | false | **yes** |
| 6 | Agenda | 182 | `slot.blocked` | false | **yes** |
| 7 | Comms | 719 | `e.hasFact` | true | no |
| 8 | Comms | 726 | `e.hasButton` | true | no |
| 9 | Public and Portal | 175 | `s.isBreak` | false | no |
| 10 | Public and Portal | 182 | `s.hasSessions` | true | no |
| 11 | Public and Portal | 293 | `s.isBreak` | false | no |
| 12 | Public and Portal | 300 | `s.hasSessions` | true | no |
| 13 | Review | 305 | `c.isScale` | true | **yes** |
| 14 | Review | 312 | `c.isChoice` | false | **yes** |
| 15 | Review | 507 | `c.isChoice` | false | no |
| 16 | Review | 609 | `c.isChoice` | false | **yes** |
| 17 | Review | 626 | `c.isScale` | true | **yes** |
| 18 | Review | 631 | `c.isChoice` | false | **yes** |
| 19 | Review | 754 | `c.isChoice` | false | no |
| 20 | Settings | 327 | `f.note` | false | **yes** |
| 21 | Speakers | 96 | `row.needsInvite` | false | no |
| 22 | Speakers | 100 | `row.outstanding` | true | no |
| 23 | Speakers | 304 | `m.current` | false | no |

## Derivation rule (content search, never a hand-written frame→component map)

**TIER 1 — COPY MATCH.** Extract the `sc-if` block's OWN literal text
(excluding any nested `sc-if`'s text — `cell.session` wraps `cell.clash`,
and the nested block's "Room double-booked" belongs to the inner row, not
the wrapper), i.e. every run of ≥6 non-mustache, non-tag characters. If any
literal occurs verbatim (word-boundary, comment-stripped, entity-decoded —
reusing `test/frame-source-corpus.ts`'s shared primitives, the same module
the caption/eyebrow/field-label ledgers already share) in the row's CLUSTER
directory, TIER 1 reports a match.

**TIER 2 — STRUCTURAL MATCH**, only when TIER 1 finds no literal at all (a
fully template-composed block, e.g. `slot.blocked`'s only content is
`{{ slot.note }}`). The condition's last dotted segment is searched two
ways: (a) as a bare COMPOUND identifier (`\bneedsInvite\b`) — permitted
only for genuine camelCase compounds (an internal lowercase→uppercase
transition), never a single morpheme; (b) the identifier's `is`/`has`/
`needs`-stripped, lower-cased suffix noun (`isBreak` → `break`,
`hasSessions` → `sessions`) OR, for an identifier with no such prefix
(`session`, `clash`, `placed`, `free`, `blocked`, `current`, `note`,
`scale`, `choice`), the bare identifier itself — searched ONLY as a quoted
string literal (`"word"`/`'word'`) or a CSS class-name token (`-word`/
`word-`), never as a bare word. Both single-morpheme and suffix-noun
searches require the candidate be ≥5 characters — `note` (4 chars) is
excluded outright. Comments are stripped first (DEC-967).

**Why the single-morpheme bare-word search is banned, not just
discouraged:** during this file's own development, `slot.blocked`'s bare
identifier `blocked` matched `app/src/pages/agenda/PhoneAgenda.tsx`'s
`blockedBreaks` parameter and a comment discussing it — a real word in real
code, for an entirely unrelated concept (which minutes are blocked by a
scheduled break, not a `PhoneSlot` kind). Requiring a discriminant SHAPE
(quoted string or class token) for single morphemes, while still permitting
bare-word search for multi-morpheme compounds (`needsInvite`,
`hasSessions`), closes that false-positive without losing real matches —
`kind: "break"`/`kind: "sessions"` (Public and Portal), `kind: 'clash'`/
`kind: 'placed'` (Agenda), `.is-current` (Speakers), `chq-review-scale-`/
`chq-review-choice-` (Review) all still resolve.

A row with no evidence from either tier grades **diverges** (see the
canonical section below for the token this ledger's own findings use). A
row with evidence grades **MATCHED** when some `*.test.ts(x)` file anywhere
in the repo also contains that same evidence string; **PRESENT-UNMOUNTED**
when the evidence exists in product source but no test contains it.

## Cluster directories (structural, not per-row)

| dc.html file | Cluster directories |
|---|---|
| Agenda | `app/src/pages/agenda` |
| Public and Portal | `src/routes/public`, `src/routes/portal` |
| Review | `app/src/pages/review`, `src/routes/review` |
| Settings | `app/src/pages/settings` |
| Speakers | `app/src/pages/speakers` |
| Comms | `app/src/pages/comms`, `src/mail`, `src/routes/comms` |

## Results: 20 MATCHED, 0 PRESENT-UNMOUNTED, 0 unsettled diverge (3 diverge, all 3 now RULED)

Ceilings (`test/frame-conditional-state.scan.test.ts`):
`FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING = 0`,
`FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING = 0`, each measured by forcing
to `-1` and reading the printed roster, both registered in
`scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE` (a newly-measured
population, the same disposition already given to
`FRAME_EYEBROW_DIVERGENCE_CEILING`/`FRAME_EYEBROW_UNRESOLVED_CEILING`).
The DIVERGENCE_CEILING reads 0 rather than 3 because all three rows below
are now excluded from the ceiling's population via
`test/frame-conditional-state.scan.test.ts`'s `SETTLED_EXPR_KEYS` (DEC-383
wave-32) — the mechanical join's own grade for each is unchanged (this
section's prose is unchanged, superseded in place rather than deleted), it
is the adjudication, not the grading, that changed.

### The three findings — RULED wave-32 (superseding "unruled" below in place)

Each bullet below carries this ledger's own divergence token as its row
marker (`test/open-divergence-ledger.scan.test.ts`'s population walk):
each is its OWN bullet-shaped row, scoped only to its own indented
continuation lines, so the three are three separate rows, not one. At the
time this section was first written, all three were grepped, individually,
for a subject match against the decision registry and the deviations
record — none resolved (see "FOR THE PLANNER" below for what a ruling on
each needed). Wave-32 supplies exactly that ruling for each, cited inside
the bullet's own indented continuation lines below so the adjudication is
part of the row, not a separate table a future join can miss.

- **DIVERGES — `Chautauqua Agenda.dc.html:182` `slot.blocked` (hinted
  false).** `app/src/pages/agenda/phoneSlots.ts`'s `PhoneSlot.kind` union
  is `'placed' | 'clash' | 'free'` — three states, built and tested
  (`app/src/pages/agenda/phoneSlots.test.ts`, `PhoneAgenda.frame390.render
  .test.tsx`). No fourth `'blocked'` kind exists anywhere in the phone
  agenda. The frame draws a fourth slot treatment (`border:1px solid
  #E1DDCE`, uppercase muted note text reading `{{ slot.note }}` — a
  blackout/reserved-time row distinct from an ordinary free slot) that the
  phone agenda cannot currently render at all.
  RULED BUILD under DEC-895 wave-32: the frame's own demo data
  (`blocked: true, note: 'Break · 15 min'` / `'Lunch · 60 min'`) names it a
  scheduled break, and `PhoneAgenda.tsx` already receives `breaks`. Built
  by task `v12m-w32-b`.
- **DIVERGES — `Chautauqua Comms.dc.html:719` `e.hasFact` (hinted true).**
  `src/mail/shell.ts`'s `EmailShellOptions` interface is `{ eventName,
  reason, cta }` — no `fact`/`factLabel` field. The frame draws a
  border-left accent block (`border-left:3px solid #4E5C31`) inside the
  560px email card showing an uppercase label (`{{ e.factLabel }}`) and a
  value (`{{ e.fact }}`) — e.g. a highlighted single fact about the
  recipient's session (their slot, their room). No such block exists in
  `renderEmailHtml`; the only optional block that file supports is the CTA
  (`e.hasButton`, MATCHED above).
  RULED BUILD under DEC-441 wave-32: all FOUR of the frame's `emails`
  entries carry `hasFact: true` ('Your talk', 'Reviewer feedback', 'Still
  to do', 'Your slot'), so it is a drawn element of the shell, not a rare
  conditional. Built by task `v12m-w32-d`.
- **DIVERGES — `Chautauqua Settings.dc.html:327` `f.note` (hinted
  false).** The frame draws a **phone-only, read-only** "Event" fields
  list (`‹ Settings` back link, `eventFields` as label/value/optional-note
  rows, a `Save` footer button) distinct from
  `app/src/pages/settings/EventSettingsPanel.tsx` (the desktop-frozen EDIT
  form this campaign's mandate does not touch). No component under
  `app/src/pages/settings` renders a read-only, per-field note list
  matching this shape; `f.note`'s own bare identifier is too generic (4
  chars) to search safely, and no quoted-string/class-token evidence for
  it exists either.
  RULED NOT A DIVERGENCE under DEC-964 wave-32:
  `docs/design/audit/settings-panels-390-v12.md` row 5, for the SAME
  frame, grades the optional per-field note MATCHES (SHAPE) against
  `app/src/pages/settings/SummarySection.tsx`'s `row.hint`, which is live
  in the tree. This ledger's mechanical join produced a false negative
  because its evidence tier could not search a 4-character identifier by
  bare word; the sibling per-frame audit found it by SHAPE instead.

### FOR THE PLANNER: historical — what a ruling on each row would need (all three now supplied above, wave-32)

- **`slot.blocked`**: either (a) a product decision that a 4th phone-agenda
  slot kind is in scope, with the server/`buildPhoneSlots` wiring to
  produce it (what upstream data would populate `slot.note`? a break? a
  room hold?) — or (b) a DEVIATIONS entry retiring the drawn 4th state the
  same way `slot.clash`'s inner "one-tap resolution" control was retired
  (see below). SUPPLIED: (a), DEC-895 wave-32, built by `v12m-w32-b`.
- **`e.hasFact`**: a product decision on whether the "highlighted fact"
  block is a real feature (would need a new `EmailShellOptions.fact:
  {label, value} | null` field and at least one caller, e.g. the CFP
  decision or schedule-confirmation email template) or a DEVIATIONS entry
  naming it SIZED, NOT BUILT. SUPPLIED: the feature-real branch, DEC-441
  wave-32, built by `v12m-w32-d`.
- **`f.note`**: confirmation of whether a read-only phone "Event" settings
  summary is in scope at all, distinct from the existing desktop-frozen
  edit form — this is the only one of the three findings whose very
  EXISTENCE as a planned screen is unconfirmed, not just its note field.
  SUPPLIED: in scope, already built as `SummarySection.tsx`'s `row.hint`;
  DEC-964 wave-32 rules the row NOT A DIVERGENCE rather than BUILD, since
  nothing needed building.

## SETTLED (already ruled elsewhere — graded MATCHED by this ledger, not among the three findings above)

**`slot.clash` (`Chautauqua Agenda.dc.html:159`, hinted false) — this
ledger's own join independently grades it MATCHED** (`PhoneSlot.kind ===
'clash'` is real and tested), so no exclusion was needed for the ceiling.
Recorded here because the row's INNER content was previously the subject of
a real, now-resolved DIVERGES: `docs/design/audit/agenda-clash-390-v12.md`
PART 3 flagged the frame's "one-tap resolution" control (`Move DFC-047 to
11:30`) as `SIZED, NOT BUILT`, then RULED it RETIRED under DEC-903, quoted
verbatim:

> RETIRED (DEC-903): the tree now satisfies it —
> `app/src/pages/agenda/PhoneAgenda.tsx`\`function computeClashMove(\`
> defines the resolution, it is called at
> `app/src/pages/agenda/PhoneAgenda.tsx`\`computeClashMove(slot.sessions,
> day, placed, dayStartMin, dayEndMin, gridMin, blockedBreaks)\`, and the
> control renders as
> `app/src/pages/agenda/PhoneAgenda.tsx`\`className="chq-phone-slot-clash-move"\`,
> labelled via
> `src/domain/schedule-copy.ts`\`export function conflictMoveLabel(\` and
> styled at `app/src/pages/agenda/agenda.css`\`.chq-phone-slot-clash-move\`.

Resolution guard: this ledger's TIER 2 structural check independently found
`kind: 'clash'` live in `phoneSlots.ts`/`PhoneAgenda.tsx`, so the two
findings (RETIRED inner control, MATCHED outer state) are consistent and
reinforce each other rather than conflicting.

## Overlap with the drawn-word ledgers — BUILT wave-40 (task w40-g)

Task clause 3 (wave-29 original): a `hint-placeholder-val="{{ false }}"`
block is copy the pack COMMITS but the drawing never renders — the
drawn-word ledgers (caption/eyebrow/control-label/field-label) may be
scraping it as if it were drawn. This section was a measure-only handoff
("This table names the overlap for a future lane to investigate") for two
waves; DEC-383 wave-40 (task w40-g) closes it, per wave-39's field-guide
doctrine that a measure-only clause left unrouted becomes an orphan unless
the next plan names the repair lane.

### (1) Control-label measurement supplied

`test/frame-control-label.scan.test.ts`'s frame-enumeration and
`labelsInFrameText` extraction grammar moved, unchanged, to
`test/frame-control-label/population.ts` — the same contention-custodian
decomposition `test/frame-caption-ledger/population.ts` already used for
the caption ledger. A plain, non-test `.ts` module under `test/` is never
itself collected by vitest's `test/**/*.test.ts` include, so
`test/frame-conditional-state.scan.test.ts` can import its real
`ALL_LABELS`/`labelsInFrameText` directly without pulling
`frame-control-label.scan.test.ts`'s own `describe`/`it` suite into its
collection — the exact hazard that kept the eyebrow/field-label candidates
as local approximations (unchanged this wave; still documented as
approximate below). `labelsInFrameText` now also computes each label's
ABSOLUTE file offset/line from its `lineStartIndex`/`baseOffset` parameters
(accepted since wave-128 but never read — every caller, including
`test/frame-eyebrow-label.scan.test.ts`'s `controlLabelSitesInFile`, which
imports this function directly per its own DEC-613 comment, redid that
exact addition itself). The function's pre-existing `offset` field (frame-
relative) is UNCHANGED for backward compatibility with that caller; the new
`absoluteOffset`/`line` fields are additive. No behaviour change to either
ledger — re-verified: `test/frame-control-label.scan.test.ts` (7/7),
`test/frame-eyebrow-label.scan.test.ts` (24/24, including its own
control-label disjointness cross-check), `test/drawn-field-label.scan.test.ts`
(44/44) all pass unchanged.

### (2)/(3) Overlap, resolved-elsewhere vs. false match

Measured by re-using each ledger's own candidate-extraction logic (caption:
real, imported `captionsInText`; control-label: real, imported `ALL_LABELS`;
eyebrow/field-label: the same local, deliberately-simplified approximations
this file has carried since wave-29, still not imported directly for the
reason above) over the **15 false-hinted `sc-if` extents** in the pack, then
splitting each in-extent candidate by whether its literal text ALSO occurs
somewhere in the SAME `.dc.html` file OUTSIDE every false-hinted extent (a
true-hinted sibling branch, or static chrome the pack always draws) —
**RESOLVES ELSEWHERE**, the row's existing grade in its owning ledger
stands unchanged — or occurs ONLY inside a false-hinted extent — a **FALSE
MATCH**, this candidate's membership in a "drawn word" population is an
artifact of scanning inside a branch the demo pack's own hint commits to
never showing, not evidence of a rendering gap:

| Ledger | Rows inside a false-hinted extent | Resolves elsewhere | False match |
|---|---|---|---|
| Caption (real import) | 3 | 0 | 3 |
| Eyebrow (local approximation) | 6 | 0 | 6 |
| Field-label (both field-label ledgers, local approximation) | 3 | 3 | 0 |
| Control-label (real import) | 1 | 0 | 1 |
| **Total** | **13** | **3** | **10** |

(The 15 false-hinted extents host 13 overlapping candidates across the four
ledgers combined — some extents host no drawn-word-ledger candidate at
all, e.g. `slot.blocked`'s extent is pure template composition with no
caption/eyebrow/field-label/control-label shape.)

All 3 RESOLVES-ELSEWHERE rows are field-label: `Chautauqua Review.dc.html`
lines 513/613/760, each reading `3 of 6` — the review scorecard's
scale-vs-choice frames repeat this "N of 6" progress readout in BOTH the
`c.isScale`(true)/`c.isChoice`(false) sibling branches, so the exact digits
land inside the false-hinted `c.isChoice` extent too even though the pack's
own hint commits to demoing the scale branch. Fine, no action needed — the
words genuinely are drawn, in the sibling the demo happens to show.

The **10 FALSE MATCHES**, each ADJUDICATED here under DEC-383 (so this
table does not silently open a new row on
`test/open-divergence-ledger.scan.test.ts`, owned by task `v12m-w38-d`) —
none is a new, unfound product conformance gap; every sc-if row each traces
back to (`cell.clash`/`slot.clash` at Agenda, `c.isChoice` at all three
repeated Review scorecard frames, `m.current` at Speakers) already grades
**MATCHED** above via this file's own independent TIER1/TIER2 join against
real product source, per the "Results" table earlier in this doc — the
false-hinted-extent join is a POPULATION-CONSTRUCTION observation about the
caption/eyebrow/control-label ledgers, not a new product finding:

- **`Chautauqua Agenda.dc.html:91`** (eyebrow) `"Room double-booked"` and
  **`:161`** (eyebrow) `"Two sessions in this slot"` — both sit inside
  `cell.clash`/`slot.clash`'s false-hinted extents, both real clash-warning
  copy the phone agenda renders when `PhoneSlot.kind === 'clash'`
  (`app/src/pages/agenda/phoneSlots.ts`, tested). ADJUDICATED NOT A
  DIVERGENCE (DEC-383 wave-40): the eyebrow ledger's own MATCH grading
  already independently found this text live in product source; the
  false-hinted-extent join is orthogonal (it says only "this text's one
  occurrence in the FRAME sits in the untaken branch", not "the app never
  draws it").
- **`Chautauqua Review.dc.html:512/612/759`** (eyebrow)
  `"Options"`/`"Options · in the order reviewers see them"` and **:524/632/771**
  (caption) `"Two to six · results show how the picks fell, never an
  average"`/`"Recorded as a spread · no weight"` and **:622** (control-label)
  `"Add an option"` — all eight sit inside one of the three repeated
  `c.isChoice`(false) extents (the multiple-choice criterion rendering,
  demoed as NOT shown since the frame's hint picks the rating-scale sibling
  each time). ADJUDICATED NOT A DIVERGENCE (DEC-383 wave-40):
  `app/src/pages/review/Scorecard.tsx` and `src/routes/review` render the
  multiple-choice criterion form (this ledger's own `c.isChoice` row already
  grades MATCHED via TIER1/TIER2 evidence, and
  `docs/design/audit/frame-eyebrow-label-390-v12.md`/
  `frame-caption-ledger`'s own independent MATCH passes for these same
  strings agree) — the words are real, drawn UI, just never simultaneously
  with the scale sibling the frame happens to demo.
- **`Chautauqua Speakers.dc.html:305`** (eyebrow) `"Now"` — sits inside
  `m.current`'s false-hinted extent (the "currently speaking" marker on the
  green-room monitor). ADJUDICATED NOT A DIVERGENCE (DEC-383 wave-40):
  `row.needsInvite`/`row.outstanding`/`m.current`'s own TIER1/TIER2 join
  above already grades this sc-if MATCHED; `"Now"` is real product copy for
  the current-speaker state, just below this ledger's own eyebrow
  MIN_WORD_LENGTH-equivalent scrutiny threshold for a standalone finding.

### (4) Standing guard, built

`test/frame-conditional-state.scan.test.ts` now carries a permanent guard,
two-sided per every other ratchet in this campaign
(`FRAME_CONDITIONAL_STATE_FALSE_MATCH_CEILING = 10`, measured on this
branch by forcing to -1 and reading the printed roster): a NEW false match
(a drawn-word-ledger candidate whose only occurrence in its own `.dc.html`
file sits inside a false-hinted `sc-if` extent, with no occurrence in any
true-hinted sibling branch or static chrome) rising above 10 fails the
suite loudly, printing the offending `[ledger] file:line "text"` rows, and
must be adjudicated in this section before the ceiling may rise. A
companion test fails if the count drops below 10 without the ceiling being
lowered to match (the same stale-ceiling guard every ratchet in this
campaign carries). Two synthetic non-vacuity controls
(`splitFalseHintedCandidates`, DEC-967) prove the join itself, never a live
row identity: a POSITIVE control (`Zzqxw Only In Dead Branch`, present only
inside a fabricated false-hinted extent) is reported as a false match; a
NEGATIVE control (`Zzqxw Shared Words`, present in both a true-hinted and a
false-hinted fabricated extent) resolves elsewhere and is not.

None of the four sibling ledgers' own populations, grades, or ceilings
(`FRAME_CAPTION_*`, `FRAME_EYEBROW_*`, the field-label ledgers' own
constants, `FOOTER_LABEL_CEILING`) were changed by this lane — re-verified
green above, per DEC-099 wave-36's "one owner re-measures every sibling
floor together" doctrine: this lane owns none of those four ceilings, so
none was force-measured or edited.

## Next population, named and deliberately not built

**201** `sc-for list="{{ ... }}" hint-placeholder-count="N"` blocks exist
across the pack (measured via the same `readdirSync` walk, sanity-checked
at `>150` in the test file). Each names a repeated-row population and its
drawn sample size — a distinct population from this ledger's boolean
branches, not built this wave.
