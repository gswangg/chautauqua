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
for `*.md`, a FLAT (non-recursive) listing identical in shape to the two
frame ledgers' own `designFiles()` -- 101 files (including this document itself). A nested
`docs/design/audit/settings-v12/` directory holds three further `.md`
files this scan does not reach, mirroring the task brief's literal
instruction rather than inventing a wider walk.

Within each of the 101 files, every raw-text occurrence of the marker word
opens one row, keyed `file:line` -- 152 rows measured live on this branch
at `52bd83f65` (superseding the `203` figure this section previously
carried; a grep for that superseded literal across `docs/design/audit/**`
and `src/decisions-data/**` at re-baseline time found no other document
citing it as an authority, so unlike `133` below it carries no living
citer and is dropped rather than kept in a superseded clause -- DEC-995
only preserves a superseded figure where a citer depends on it).

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

Re-baselined live at `52bd83f65` (wave 21, DEC-099 amendment), by running
the instrument itself rather than reading this section's own prior prose
-- the same discipline the ratchet already binds the CODE to, applied here
to the document that reports it.

- 101 audit files scanned (this document itself is the 101st, contributing 0 rows since it never spells the marker).
- 152 total marker-token rows.
- **0 open** (no DEC-NNN citation or DEVIATIONS.md reference is missing from any row).
- 152 adjudicated (a DEC ruling or a DEVIATIONS.md entry settles every
  one of them, even though the marker word remains in the prose as
  historical narration -- the audit corpus is append-only, per its own
  established convention).

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
citable ruling. **That is now SATISFIED**, measured live at `52bd83f65`
(13/13 `test/open-divergence-ledger.scan.test.ts` assertions passing,
including the two-sided ratchet in both directions). What this DOES mean:
every row this instrument's grammar can see -- heading, table, bullet and
fallback shapes alike -- carries a `DEC-NNN` citation or a
`docs/design/DEVIATIONS.md` reference in its own line or the paragraph it
heads. What it does NOT mean: that every one of those 152 citations
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
