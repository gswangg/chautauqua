# Frame FIELD-label ledger -- RETIRED (wave-28, DEC-613 amendment)

This audit doc and `docs/design/audit/drawn-field-label-v12.md` recorded two
instruments claiming the pack's drawn FIELD-label population
(`test/frame-field-label.scan.test.ts` and `test/drawn-field-label.scan.test.ts`),
landed by the same merge train, disagreeing by 14x (73/71 diverges vs. 5).
`docs/design/audit/drawn-field-label-v12.md` is the survivor: its per-row
hand-graded ledger is the tighter, correct population derivation (this
file's own "within 5 lines, font-size:1[12]px" grammar admitted 62 false
positives -- section eyebrows, status-legend words, buttons, char
counters, chip-group headings -- that the survivor correctly excludes,
against 7 real rows this file's looser grammar uniquely found that the
survivor's grammar had missed and has since absorbed).

`test/frame-field-label.scan.test.ts` is kept as a retired pointer test
(never deleted); `FRAME_FIELD_LABEL_DIVERGENCE_CEILING` and
`FRAME_FIELD_LABEL_UNRESOLVED_CEILING` no longer exist and are no longer
registered in `scripts/exit-predicate.ts`. This doc is kept, never
deleted, so the duplication and its resolution stay visible in the tree;
none of its rows are re-derivable from live code any more (the instrument
that produced them is retired), so they carry no independent adjudication
here -- see `docs/design/audit/drawn-field-label-v12.md` and
`src/decisions-data/DEC-613.md`'s wave-28 amendment for the full
symmetric-difference evidence and every surviving row's own citation.
