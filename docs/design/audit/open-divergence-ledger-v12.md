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
frame ledgers' own `designFiles()` -- 100 files (including this document itself). A nested
`docs/design/audit/settings-v12/` directory holds three further `.md`
files this scan does not reach, mirroring the task brief's literal
instruction rather than inventing a wider walk.

Within each of the 100 files, every raw-text occurrence of the marker word
opens one row, keyed `file:line` -- 203 rows measured on this branch
(after this task's three re-verdicts below landed, and after this very
document was added without ever spelling the marker itself).

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

- 100 audit files scanned (this document itself is the 100th, contributing 0 rows since it never spells the marker).
- 203 total marker-token rows.
- 133 open (no DEC-NNN citation or DEVIATIONS.md reference resolves them).
- 70 adjudicated (a DEC ruling or a DEVIATIONS.md entry already settles
  them, even though the marker word remains in the prose as historical
  narration -- the audit corpus is append-only, per its own established
  convention).

`OPEN_DIVERGENCE_CEILING = 133` is a two-sided ratchet (DEC-808): a
companion test fails if the open count rises above it (printing every
offending `file:line`) and another fails if it drops below it without the
constant being lowered to match (printing the exact replacement line), so
neither direction can go stale. It may only be LOWERED as future waves
adjudicate or fix rows.

goalComplete for this ledger is `OPEN_DIVERGENCE_CEILING` reaching 0 --
every recorded divergence in the pack either fixed or settled by a
citable ruling.

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
