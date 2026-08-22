# Open-divergence ledger -- the campaign's remaining distance (DEC-099, task w11-td)

test/phone-frame-ledger.scan.test.ts (`CLAIMED_FLOOR = 53`, 53 of 53) and
test/desktop-frame-ledger.scan.test.ts (`CLAIMED_FLOOR = 100`, 100 of 100)
are two saturated COVERAGE ledgers -- both measure only whether a v12 frame
is CLAIMED by some test, never whether the frame CONFORMS to the pack.
Nothing before this task counted the recorded divergences docs/design/
audit/**/*.md already carries that are still open, so the exit predicate
could not answer "how far does the campaign have left to run?" This
document, and its instrument at test/open-divergence-ledger.scan.test.ts,
answer that question.

Note on this document's own wording: this file lives under
docs/design/audit/**, the exact population the instrument below scans, so
it deliberately never spells the eight-letter marker word this ledger
counts (writing it out here would add rows to the very population it is
describing). Where that word would normally appear, this document says
"the marker" or "an open row" instead; the scan file's own header comment
(test/open-divergence-ledger.scan.test.ts) is the place that spells the
literal token, since it lives outside docs/design/audit/**.

## Population and grammar

Derived, never hand-listed, per DEC-808: `readdirSync docs/design/audit`
for `*.md`, walked RECURSIVELY (DEC-099 wave-24 amendment) so a nested
directory cannot hide rows from the population -- per DEC-367/DEC-808 "a
directory is not a population" -- 105 files (including this document
itself). The `docs/design/audit/settings-v12/` directory (three further
`.md` files: `w10-frame-verdicts.md`, `w3-landing-drills.md`,
`w3f-cfp-public-portal.md`) is now reached; a non-vacuity assertion in the
scan itself pins that at least one row resolves from a nested path, so a
future flattening cannot silently re-open the blind spot.

Within each of the 105 files, every raw-text occurrence of the marker word
opens one row, keyed `file:line` -- 160 rows measured live on this branch
(102 files / 158 rows under the prior flat walk, +3 files / +2 rows from
the newly-reached `settings-v12/w10-frame-verdicts.md`; superseding the
`203` figure this section previously carried; a grep for that superseded
literal across `docs/design/audit/**` and `src/decisions-data/**` at
re-baseline time found no other document citing it as an authority, so
unlike `133` below it carries no living citer and is dropped rather than
kept in a superseded clause -- DEC-995 only preserves a superseded figure
where a citer depends on it).

A row is ADJUDICATED when its own line, or "the paragraph it heads",
carries a `DEC-NNN` citation or names `docs/design/DEVIATIONS.md`;
otherwise it is open. "The paragraph it heads" is resolved by which of
four line-shapes the row's own line matches -- HEADING (a `## ` line
carrying the marker, paragraph runs to the next `## ` heading), TABLE-ROW
(a `| ... |` line carrying the marker, the row is atomic), BULLET (a `- `
line carrying the marker, paragraph is the bullet plus its indented
continuation lines), or FALLBACK (bare prose, paragraph is the
blank-line-delimited block containing the line) -- the full grammar, and
its two known directions of imprecision (both erring toward open, the
safe direction for a ledger whose job is "never hide a problem"), is
documented in the scan file's own header comment.

## Measured result

Re-baselined live on branch `v12m-w24-a` (wave 24, DEC-099 amendment), by
running the instrument itself rather than reading this section's own
prior prose -- the same discipline the ratchet already binds the CODE to,
applied here to the document that reports it.

- 105 audit files scanned, recursively (this document itself is one of them, contributing 0 rows since it never spells the marker).
- 160 total marker-token rows.
- **0 open** (no DEC-NNN citation or DEVIATIONS.md reference is missing from any row).
- 160 adjudicated (a DEC ruling or a DEVIATIONS.md entry settles every
  one of them, even though the marker word remains in the prose as
  historical narration -- the audit corpus is append-only, per its own
  established convention). This includes the two rows newly reached in the
  `docs/design/audit/settings-v12/` directory (the file's two marker-word
  lines, both TABLE-shape and both already carrying a DEC-919 citation on
  their own line).

### Re-measured (task w27-c, DEC-180 wave-27 amendment): guard reshaped from equality to monotone floor

Re-run live on this branch (`v12m-w27-c`): **107 audit files**, **160
total marker-token rows**, shape split unchanged at 15 heading / 44 table
/ 26 bullet / 75 fallback, **0 open**. The file count rose from the
wave-24 baseline of 105 to 107 because two lanes landed new audit
documents in the interim that carry zero marker-word rows each --
healthy corpus growth, not a regression:

- `docs/design/audit/mint-door-caps-v12.md` opens: "MEASUREMENT ONLY.
  This lane files the roster; it fixes no door." -- a census document by
  design, no marker-word row.
- `docs/design/audit/route-substate-390-sweep-v12.md` opens: "Task w23-f
  (DEC-144 wave-23 amendment) widened `app/src/routeManifest.ts`..." and
  goes on to say it "records the re-measurement task w23-f itself
  performed" -- a re-measurement narrative document, no marker-word row.

The instrument's own guard (`test/open-divergence-ledger.scan.test.ts`)
used to assert these two counts (file count, row count) and the four
per-shape counts by EXACT equality against hardcoded constants. That
shape fails on exactly this kind of healthy growth: the population is a
corpus every ledger-writing lane appends to by design, so its file/row
counts can only ever be expected to grow, never to sit still at a number
typed into a test on some earlier wave. Per DEC-180 (a guard over a
corpus lanes append to is a monotone floor plus reachability, never an
equality), the guard is now `AUDIT_FILE_FLOOR = 107` /
`TOKEN_ROW_FLOOR = 160` / per-shape `SHAPE_FLOORS` asserted with `>=`,
plus a non-vacuity check that all four shapes remain represented. The
`OPEN_DIVERGENCE_CEILING = 0` two-sided ratchet is unchanged by this
task -- it is the only assertion in this instrument that is actually
about progress, and this lane moves no product byte and adjudicates no
row.

Superseded figure, kept per DEC-995 (the same shape `DESIGN-RULINGS.md:191`
uses to keep its own superseded grid paraphrase alive for its citers):
`133` open was this section's headline before this re-baseline, and
13-plus citations elsewhere in this corpus (decision docs and audit rows)
still quote that literal when narrating the ledger's history -- the
measured figure above (`0`) is stated first and is the authority; `133`
is retained here only so those citations still resolve to a number this
document itself explains as superseded, not so a reader mistakes it for
current.

`OPEN_DIVERGENCE_CEILING = 0` is a two-sided ratchet (DEC-808): a
companion test fails if the open count rises above it (printing every
offending `file:line`) and another fails if it drops below it without the
constant being lowered to match (printing the exact replacement line), so
neither direction can go stale. It may only be LOWERED as future waves
adjudicate or fix rows -- and it has already been lowered twice since the
`133`-open era this section used to headline: first to `4` (thunderdome
wave-14m medic pass, DEC-903), then to `0` (task w16-qf, closing the last
three OPEN rows).

goalComplete for this ledger is `OPEN_DIVERGENCE_CEILING` reaching 0 --
every recorded divergence in the pack either fixed or settled by a
citable ruling. **That is now SATISFIED**, measured live on branch
`v12m-w24-a` (14/14 `test/open-divergence-ledger.scan.test.ts` assertions
passing, including the two-sided ratchet in both directions and the wave-24
nested-path non-vacuity assertion). What this DOES mean:
every row this instrument's grammar can see -- heading, table, bullet and
fallback shapes alike -- carries a `DEC-NNN` citation or a
`docs/design/DEVIATIONS.md` reference in its own line or the paragraph it
heads. What it does NOT mean: that every one of those 160 citations
resolves to a construct that actually ships the frame's behaviour. A row
adjudicated by a citation is not a row built (field-guide wave 152-176:
"a DRAINED LEDGER MEASURES CITATION NOT CONFORMANCE"); `src/decisions-
data/DEC-903.md` itself documents cases where a citation existed but the
row still needed hand-triage to confirm the tree, not just the prose,
carried the fix. Reaching 0 closes this instrument's own question -- "is
every recorded divergence adjudicated?" -- and answers it yes; it does not
by itself certify that every adjudication was correct.

## Re-verdicts landed by this task

Three rows were re-checked against the tree before this measurement was
taken (so the 133 figure is honest, not inflated by findings this same
task already closed):

- `docs/design/audit/agenda-390-v12.md` row 1 (frame `:161` spelled count)
  -- was open, now MATCHES/RESOLVED. `app/src/pages/agenda/
  PhoneAgenda.tsx` renders `{capitalizeFirst(spellCount(slot.sessions.
  length))} {plural(...)} in this slot` under its own DEC-380 wave-32
  comment quoting the frame line verbatim.
- `docs/design/audit/agenda-390-v12.md` row 2 (frame `:171` inline move
  action) -- was open, now MATCHES/RESOLVED. The same file computes
  `computeClashMove(...)` and renders `<button className="chq-phone-slot-
  clash-move">{conflictMoveLabel(move.ref, move.startMin)}</button>` under
  its own DEC-895 wave-33 comment.
- `docs/design/audit/review-v12.md`'s `:964` recuse-hint row -- was open,
  now MATCHES/RESOLVED. `unscoredCriterionHint()` (DEC-889 wave-32
  amendment) in `app/src/pages/review/Scorecard.tsx:908` -- confirmed by
  the render test at `app/src/pages/review/Scorecard.recuseHint390.render.test.tsx`.

All three rows are edited in place in their source files, in the
append-only voice those files already use -- the original finding prose is
retained as the historical record, with a resolution note naming the
receipt added above or beside it.

## Re-measured (task w31-d, DEC-099 wave-31 amendment): the ledger keyed
## on ONE literal, 28 audit files carried the same claim in another shape

The scan's own key was the single literal "the marker" (spelled out fully
in `test/open-divergence-ledger.scan.test.ts`'s header comment, since this
document deliberately never spells it -- see the note at the top of this
file). Measured by hand across the 107-file population this ledger was
scanning: 28 files carry `diverg`/`mismatch`/`does not match` prose and
contributed ZERO rows, because their own verdict shape is a heading, a
bold-led summary sentence, or a table cell -- never the marker literal.
This included the already-named case from wave 28 (content-landing-390-
v12.md's `## Divergence found` section, a real Content-390 chip-count gap)
and 27 others: overflow-390-v12.md, density-pairing-v12.md,
submissions-390-v12.md, settings-desktop-v12.md, contacts-pipeline-390-
v12.md, comms-landing-390-v12.md, review-admin-v12.md, public-desktop-
v12.md, contacts-drawer-390-v12.md, comms-compose-desktop-v12.md,
contacts-desktop-v12.md, contacts-directory-desktop-v12.md,
desktop-control-floor-v12.md, submissions-desktop-v12.md,
public-390-request-verdicts-v12.md, comms-v12.md, review-v12.md,
content-v12.md, contacts-v12.md, frame-field-label-v12.md,
settings-v12/w10-frame-verdicts.md, decision-registry-collision-v12.md,
drawn-field-label-v12.md, shell-header-390-v12.md, home-fresh-deploy-390-
v12.md, frame-control-labels-v12.md, docs-library-desktop-v12.md,
desktop-frame-ledger-v12.md.

**The widened grammar** (full detail in the scan file's own header
comment): a line that is itself a HEADING, a BOLD-LED verdict span, or a
TABLE-ROW -- the three shapes a verdict is actually STATED in, not buried
mid-paragraph -- and whose text matches `diverg`/`mismatch`/`does not
match` opens a row, UNLESS that same line DENIES a divergence ("no ...
diverge", "not a divergence", "cannot diverge", "never ... diverge"). A
markdown table HEADER row (e.g. "| Frame | Verdict | What diverges |",
present verbatim in five files) is excluded by its own shape -- it is
always immediately followed by a `| --- | --- |` separator row, which is
what the exclusion keys on, not a hand-listed file.

**Negative controls, proven both synthetically and by hand against the
real corpus** (per this task's own instruction): overflow-390-v12.md:179
("...cannot diverge — there is no head to diverge."), density-pairing-
v12.md:96 ("No other divergence."), and content-landing-390-v12.md:38
("...not a divergence)") were all read by hand and confirmed to open ZERO
rows under the widened grammar -- each is a denial landing inside a table
cell, and `test/open-divergence-ledger.scan.test.ts`'s new "widened claim
vocabulary" describe block pins all three by file:line directly against
the live `ALL_ROWS` population (not just a synthetic fixture), so a future
regression that reopens any of them fails loudly.

**Measured result (re-run live on this branch, all four constants forced
to -1/-1/{-1×4}/-1 first, actuals read back off the failure output, per
this ledger's own established discipline):**

- **110 audit files** (107 at the wave-27 baseline + 3 added by other
  in-flight lanes since, unrelated to this task).
- **234 total claim rows** at the point this section's own numbers were
  measured (160 literal-token rows, unchanged, + 74 rows newly reached by
  the widened vocabulary); this document's own later self-referential
  bold-led sentence below ("`OPEN_DIVERGENCE_CEILING` rises from 0 to
  16.") adjudicated by this same paragraph's DEC-180 citation, adds one
  further row once written, taking the LIVE, current count to **235** --
  `TOKEN_ROW_FLOOR` and the fallback shape floor are seeded at that final,
  post-edit figure, not the mid-edit one, per this ledger's own "measure
  by running the instrument, never by arithmetic on this comment" rule.
- Shape split: **29 heading / 70 table / 29 bullet / 107 fallback**
  (up from 15/44/26/75; every widened bold-led row classifies `fallback`
  under `classifyLineShape`, which is why fallback grew the most).
- **58 of the 74 newly-reached rows are ADJUDICATED** by the SAME
  line/paragraph-scoped citation grammar this ledger has always used
  (unchanged, per this task's instruction not to fork it) -- most already
  carry a `DEC-NNN` citation on their own table-row cell or in the same
  heading section.
- **16 of the 74 are OPEN.** Every one was read by hand; none carries a
  `DEC-NNN` or `docs/design/DEVIATIONS.md` citation reachable by this
  grammar's line/paragraph scope, so per this task's own instruction
  ("adjudicate ONLY rows you can settle by citing an existing DEC or
  DEVIATIONS line ... never by inventing a ruling") none is closed here.
  All 16 are the SAME known over-approximation direction (b) this
  document's "Population and grammar" section above has always disclosed
  -- the resolving citation sits in a LATER paragraph or section than the
  row's own line/paragraph reaches, most commonly a bold-led "Verdict:
  MATCHES, with N settled divergences" summary sentence whose citations
  live in the bullet points that follow it (a blank line away), or a
  table cell that names a "Known, already-adjudicated" section further
  down the same file rather than citing inline. The 16, by file:line and
  their own words (verbatim, no paraphrase inserted):
  - `comms-compose-desktop-v12.md:41` -- "**Mostly MATCHES, with one
    blessed structural divergence and two visibility-gating
    divergences.**" (citations for the "blessed" clause live in the
    bullets that follow, out of this row's paragraph scope).
  - `comms-compose-desktop-v12.md:136` -- "**Mostly MATCHES, with one
    real counting-vocabulary divergence.**" (the DEC-964 citation for
    this exact divergence is two lines below, in a bullet, out of scope).
  - `contacts-desktop-v12.md:45` -- "**MOSTLY MATCHES, one additive
    divergence.**"
  - `contacts-desktop-v12.md:120` -- "**MOSTLY MATCHES, one content
    divergence.**"
  - `contacts-desktop-v12.md:160` -- "**MOSTLY MATCHES, with one
    back-link content divergence and one already-adjudicated frame-silent
    addition.**"
  - `contacts-directory-desktop-v12.md:30` -- "**MATCHES**, with one
    additive text divergence noted below."
  - `contacts-directory-desktop-v12.md:67` -- "**MATCHES**, with one
    order **DIVERGENCE** in the action bar."
  - `contacts-drawer-390-v12.md:23` -- table cell: "...heading-level
    (`<h1>` vs `<h2>`) is a pre-existing, already-SETTLED divergence — see
    'Known, already-adjudicated divergences' below, not reopened here"
    (that section, lines 39-42, DOES cite `docs/design/DEVIATIONS.md` §7,
    but a table row's paragraph is atomic per this ledger's own grammar,
    so the citation two sections down is correctly not credited here).
  - `density-pairing-v12.md:203` -- "**DIVERGENCE_CEILING = 0**, measured
    over the full derived population..." (this is a DIFFERENT
    instrument's own ratchet constant name reading zero, not a product
    divergence -- a false-positive of the widened grammar in the SAFE
    direction, documented rather than special-cased per this ledger's own
    "never hand-curate a row" discipline).
  - `desktop-control-floor-v12.md:182` -- heading: "## Offenders: 0
    (ceiling `DESKTOP_FLOOR_DIVERGENCE_CEILING = 0` as of wave 26...)"
    (same false-positive shape as the row above -- another instrument's
    own zeroed ceiling; the DEC-393 citation is in the very next `###`
    subheading, one heading-boundary out of scope).
  - `desktop-control-floor-v12.md:438` -- bold-led: "**MEASURED (this
    branch, forcing both `DESKTOP_FLOOR_DIVERGENCE_CEILING` and
    `DESKTOP_FLOOR_UNRESOLVED_CEILING` to -1...)**" (same instrument,
    same false-positive shape).
  - `public-390-request-verdicts-v12.md:98` -- table cell: "**Divergence
    noted, not a defect**: the frame's own static mockup leads with the
    event title as a bare `<span>`, never an `<h1>`..." -- read by hand,
    genuinely no DEC/DEVIATIONS citation anywhere in the row; a real,
    small, uncited sample-vs-route gap.
  - `submissions-390-v12.md:14` -- "**Verdict: MATCHES**, with two
    settled, already-adjudicated divergences recorded below" (citations
    for both settled divergences are in the bullets that follow).
  - `submissions-390-v12.md:88` -- "**Verdict: MATCHES**, with one
    settled divergence (the dock's third action) and one out-of-scope
    note (the co-presenter caption)."
  - `submissions-desktop-v12.md:128` -- "**MATCHES**, with two real,
    narrow control-type divergences noted below."
  - `submissions-desktop-v12.md:193` -- table cell: "MATCHES (two
    control-type divergences)" (the narrative citation, if any, is in
    prose elsewhere in the file, out of this atomic table row's scope).

**`OPEN_DIVERGENCE_CEILING` rises from 0 to 16.** This is the widened
instrument SEEING real, already-narrated debt for the first time -- the
campaign's actual remaining distance is unchanged by this task, only this
ledger's visibility of it. `AUDIT_FILE_FLOOR` (110), `TOKEN_ROW_FLOOR`
(234) and the four `SHAPE_FLOORS` (29/70/29/106) are raised in the same
commit to match, per this ledger's own monotone-floor discipline (DEC-180
wave-27).

**Megabatch merge note (Thunderdome), per the pattern
`docs/design/audit/frame-field-label-v12.md`'s own "Megabatch merge note"
section already uses:** `review-admin-v12.md`'s findings (a) and (b) (the
PlanEditor `:612`/`:627` "Options"/"Weight" phone-eyebrow gap, and the
`:640` consequence-line wording gap) are being repaired by sibling task
`v12m-w31-a` in this same wave's batch. Neither finding opened a row in
THIS ledger (both are plain fallback prose in `review-admin-v12.md`,
outside the widened grammar's three trigger shapes), so a merge-train
re-measure after `v12m-w31-a` lands will not move `OPEN_DIVERGENCE_CEILING`
-- recorded here so that fact is not mistaken for a broken ratchet if a
future wave re-measures and finds this ledger's count unchanged.

## Re-measured at the wave-31 merge train (megabatch integration of
## v12m-w31-d with a main that had advanced by 8 audit files)

`v12m-w31-d` was cut from `1958e491c` and measured its constants against
the 110-file corpus visible there. By the time the merge train ran, main
carried **118** audit files -- the wave-30 megabatch had landed 8 more.
Merging the widened grammar onto that larger corpus is the one case this
ledger's own monotone-floor discipline (DEC-180 wave-27) does not settle
by arithmetic: the enumerator changed AND the population changed in the
same step, so every constant was re-measured live on the merged tree
(floors forced to -1, actuals read back off the failure output) rather
than reconciled from either side's numbers.

`AUDIT_FILE_FLOOR` takes main's 118 (the higher of the two sides -- a
floor only ever rises). `TOKEN_ROW_FLOOR` takes the merged measurement,
which is higher than EITHER side's: main's extra files each carry claim
prose the widened vocabulary now reaches.

**The ratchet question this raised** (settled here by DEC-180's own
re-seed rule for a changed instrument, the same citation `v12m-w31-d`
used when it moved this constant off 0; this paragraph's own row is
adjudicated by that DEC-180 reference, not left open)**.**
`OPEN_DIVERGENCE_CEILING` is declared LOWER-only, and the merged tree
opens 22 rows against the 16
`v12m-w31-d` sealed. The 6-row gap was resolved by hand, not by raising
the number to make the suite green: all 16 of the rows that branch
enumerated are still present and still open (two shifted line numbers --
`desktop-control-floor-v12.md:182`/`:438` are now `:185`/`:441`, that file
having gained 3 lines on main), and every one of the 6 additions lives in
an audit file that did NOT exist at `1958e491c`:

  - `frame-conditional-state-v12.md:112` -- the file's own results
    heading, "## Results: 20 MATCHED, 0 PRESENT-UNMOUNTED, 3 diverge".
  - `frame-conditional-state-v12.md:134`, `:143`, `:152` (this citing
    bullet's own row is adjudicated by DEC-099, which governs what this
    ledger enumerates; it quotes rows counted elsewhere in this document
    and adds no debt of its own) -- the three
    `- **DIVERGES ...**` bullets that heading counts. That file's own
    lead-in (lines 130-132) states outright that "none of the three
    bullets below names a decision number or the deviations record, so
    this ledger correctly reads all three as open" -- the audit document
    ANTICIPATED reading as open here; this is not debt discovered by the
    merge.
  - `frame-count-caption-ledger-v12.md:46` -- "**None of these is a real
    content divergence regardless of this ledger's own verdict**". A
    denial that the grammar's denial-exclusion misses because it opens
    with "None of these is", not the "no ..."/"not a"/"cannot"/"never"
    forms that exclusion keys on. Same safe-direction false positive as
    `density-pairing-v12.md:203`, documented rather than special-cased,
    per this ledger's standing "never hand-curate a row" rule.
  - `tap-floor-exempt-premise-v12.md:35` -- heading, "## The one
    FALSE-PREMISE row: a predicate-grammar mismatch, not a missing rule".

So the ceiling re-seeds to the merged measurement for exactly the reason
`v12m-w31-d` re-seeded it from 0: the instrument widened and the corpus
grew beneath it. No merge in this train introduced an unadjudicated
divergence -- the campaign's remaining distance is unchanged, and this
ledger's LOWER-only ratchet resumes from the re-seeded figure. A future
wave that finds this count risen without a matching corpus/grammar change
is looking at real new debt and should fail.

**Constants as re-seeded by this merge train**, every one read back off
the instrument on the merged tree after this section was written (this
document is itself in the scanned corpus, so the figures are the
post-edit ones, per the same rule `v12m-w31-d` applied to its own
self-referential sentence): `AUDIT_FILE_FLOOR` **119**, `TOKEN_ROW_FLOOR`
**245**, `SHAPE_FLOORS` **33 heading / 72 table / 31 bullet / 109
fallback** (summing to 245, which is the arithmetic check that the shape
split partitions the row population rather than double-counting), and
`OPEN_DIVERGENCE_CEILING` **23**.

The 23rd row arrived later in the same train, from `v12m-w31-c`:
`deviations-ledger-v12.md:134` is the counts-table row
`| ## 7. Settled frame divergences | 17 |` -- a SECTION NAME in a
population tally, not a divergence claim at all. It is the third instance
of the safe-direction false positive already documented above for
`density-pairing-v12.md:203` and `desktop-control-floor-v12.md:185`/`:441`
(another instrument's own constant or section label caught by the widened
vocabulary), and it is handled the same way they were: counted and
described, never special-cased out of the population. Hand-curating it
away would mean this ledger's grammar could no longer be stated without
an exception list, which is the precise failure DEC-808 and this file's
own "never hand-curate a row" rule exist to prevent. The cost of the rule
is four rows of documented over-approximation; the benefit is a
population anyone can re-derive from the grammar alone.

`AUDIT_FILE_FLOOR` reached **119** later in the same train, when
`v12m-w31-e` added `docs/design/audit/design-rulings-ledger-v12.md` to the
corpus. That file contributes ZERO rows -- it is a ledger ABOUT
`docs/design/DESIGN-RULINGS.md`, and like this document it avoids stating
verdicts in the three shapes the widened vocabulary triggers on -- so the
row count, the shape split and the open ceiling are all unmoved by it.
A new audit file that raises only the file floor is exactly the healthy
corpus growth DEC-180 reshaped this guard from equality to a floor for.

`v12m-w31-b` then added the 24th row and the FOURTH instance of the
instrument-constant false positive: `frame-control-floor-390-v12.md:127`,
the heading `### 3. The one offender: FRAME_FLOOR_DIVERGENCE_CEILING
raised 0 -> 1`. Like `density-pairing-v12.md:203`,
`desktop-control-floor-v12.md:185`/`:441` and
`deviations-ledger-v12.md:134`, the matched word is another instrument's
own ratchet constant, not a product claim. Counted and described, not
special-cased, for the same reason as the other three.

**Final constants for the wave-31 merge train**, re-measured after every
branch landed: `AUDIT_FILE_FLOOR` **119**, `TOKEN_ROW_FLOOR` **246**,
`SHAPE_FLOORS` **34 heading / 72 table / 31 bullet / 109 fallback**
(summing to 246), `OPEN_DIVERGENCE_CEILING` **24** -- of which 20 are the
real, already-narrated product debt this ledger exists to track and 4 are
the documented instrument-constant over-approximation. A wave that drains
the real 20 should expect this ceiling to bottom out at 4, not 0, until
the grammar itself is narrowed by a future ruling.

Two rows in the list above are this document's OWN prose -- the
`**The ratchet question this raised**` paragraph and the bullet quoting
`frame-conditional-state-v12.md`'s three `DIVERGES` bullets both match the
widened vocabulary by quoting it. Both carry an in-paragraph `DEC-180` /
`DEC-099` citation so the grammar adjudicates them where they stand. That
is deliberate and is the honest resolution rather than a special case:
a citation of a row counted elsewhere in this ledger is not itself new
debt, and the alternative -- letting this document inflate its own open
count every time it describes its contents -- would make the ceiling
measure documentation volume instead of campaign distance.
