# w41-a: docs/clarifications.md conformance ledger

Built `test/clarifications-ledger.scan.test.ts` per DEC-518's wave-41
amendment (docs/clarifications.md — the top of `docs/README.md`'s
precedence chain — gets the same derived, two-directional ledger as the
rubric corpus).

## Population

14 top-level bullets derived at test time from `docs/clarifications.md`'s
`## Scope reductions` (9) and `## Scope confirmations` (5) headings, matched
by `- **<bold lead-in>**...`. One bullet under Scope confirmations
("Calendar invites: **no video link; room details when available.**") does
NOT open with a bold span and is deliberately excluded from the population —
its content is folded into the ledger row for the sibling
".ics email is sufficient" bullet, which already carries the citation for
the whole calendar-invite clarification.

## Result: no gaps found

Every one of the 14 derived bullets resolves against the tree this wave:

- 12 rows verdicted `honored` (cited file exists, contains the cited
  literal, and the cited test file exists).
- 2 rows verdicted `absent-by-design` (the scope-reduction bullets —
  "skip Accelevents" and the ticketing/registration half of the
  "open source is not a hard requirement" bullet — proved by the literal
  term `accelevent` / `ticket` not appearing anywhere in `src/**` or
  `app/src/**`).

`KNOWN_GAPS` is therefore `[]` this wave. The ratchet in the test file may
only shrink from here — if a future wave finds a clarification the tree no
longer honors, that finding is added to `KNOWN_GAPS` with a corresponding
`gap` ledger row and the detail (file:line of the drift) is recorded in a
new dated section below, never by loosening the scan.
