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
