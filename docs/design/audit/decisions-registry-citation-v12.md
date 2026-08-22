# decisions/ registry citation resolvability (DEC-518 wave-155, task ph)

MEASURE-ONLY landing. This surfaces a first count for a population that has
never been checked beyond bare path existence; it fixes no offenders and
changes no `decisions/*.md` body. A later drain wave should use this as its
starting map.

## Population

`decisions/DEC-*.md` -- the OLDER, canonical registry used by
`test/decisions-parity.test.ts` -- 1000 files, enumerated by `readdirSync`
(never hand-listed, DEC-808/DEC-180). This is a directory disjoint from
`src/decisions-data/` (77 files); the two share overlapping DEC ids that
sometimes name entirely different, even contradictory, subjects (field
guide wave-155: DEC-991 is a direct contradiction between the two
directories). This audit covers only the 1000-file `decisions/` directory.

Previously, `test/decision-path-references.scan.test.ts` checked citations
in this directory for bare path EXISTENCE only -- no line range, no quote.
`test/decision-doc-citation.scan.test.ts`'s two-directional grammar
(`findCitations`/`resolvePath`/`quoteAfter`/`checkCitationsPartitioned`,
reused verbatim, no second grammar per DEC-613) is now also applied to this
directory as a sixth `WIDENED_SOURCE_CLASSES` entry
(`decisions/DEC-*.md`), sharing the vacuous-population tripwire the other
five widened classes get, but scored under its OWN ratchet
(`DECISIONS_REGISTRY_CITATION_CEILING`) rather than folded into
`WIDENED_UNRESOLVED_CITATION_CEILING`, which grades a different,
already-drained population.

## Measured offender count

**1291** citations across the 1000-file population fail DIRECTION 1
(path:line resolves to a real, in-range file) or DIRECTION 2 (an
immediately-following backtick quote matches the target line verbatim).
Measured on this branch by forcing `DECISIONS_REGISTRY_CITATION_CEILING`
to `-1` and reading the printed offender list; the ceiling is now seeded at
`1291` (two-sided ratchet, DEC-808 wave-106 amendment -- may only be
LOWERED by a later drain wave, never raised).

## Offender shapes

Four shapes, with their counts (sum to 1291):

- **Path does not resolve -- missing (341 offenders).** The cited
  basename/path has no match anywhere in the current tree -- most commonly
  a bare basename cited without its directory prefix at a time when the
  file has since moved or the citation was always slightly wrong (these
  decisions/ docs predate the two-directional grammar entirely, so nothing
  ever caught this). Example: DEC-011.md cites `src/lib/csv.ts` around line
  109-114 (the wave-65 amendment on the same file later moved that module to
  `src/domain/csv.ts` and deleted the original), and no such repo-relative
  path resolves.

- **Path does not resolve -- ambiguous (159 offenders).** A bare basename
  (no `/`) that now matches more than one file in the tree, so
  `resolvePath` correctly refuses to guess. Example: DEC-013.md cites the
  bare basename `views.ts` (line 45), which today matches three different
  `views.ts` files under `app/src/pages/submissions/`, `src/routes/api/`
  and `src/server/repo/`.

- **Line-number drift, cites past EOF (179 offenders).** The path resolves
  but the cited line number exceeds the target file's current line count
  -- classic drift from a file that has since been trimmed or rewritten.
  Example: DEC-004.md cites `src/routes/auth.tsx` around line 353, but
  that file is only 40 lines today (this exact shape -- `auth.tsx` shrunk
  to 40 lines -- recurs across several DEC-*.md files citing lines in the
  350-500 range against it).

- **Quote mismatch (612 offenders, the largest shape).** The path/line
  resolves in-range, but the backtick-quoted literal immediately following
  the citation does not appear verbatim on that line -- either the target
  line has been edited since, or (a distinct sub-pattern visible in the
  sample) the citation and its "quote" are actually a CHAIN of adjacent
  path:line citations where the grammar is reading the NEXT citation's own
  path text as if it were a receipt quote for the current one. Example of
  plain drift: DEC-004.md's citation of `src/routes/auth-login.tsx` around
  line 242 carries the receipt quote `isSecureRequest(c.req.url)`, but that
  line today reads `if (token) {` instead. Example of the chained-citation
  sub-pattern: DEC-008.md cites `src/server/repo/submit.ts` around lines
  153-154, and the text immediately following that citation is itself
  ANOTHER citation (`src/server/repo/portal-edit.ts` around lines
  144-145) rather than a code receipt -- here the "quote" is another
  citation's path text, not a code receipt; a drain pass should
  distinguish this sub-pattern (arguably a citation-FORM issue, not a
  content-drift issue) from genuine quote drift before repairing either.

## Next steps for a drain wave

- Start with the "missing" and "ambiguous" shapes (500 offenders): these
  are almost certainly directory-prefix drift (a bare basename that used
  to be unambiguous) and are the most mechanically fixable.
- The "cites past EOF" shape (179) generally means the citation described
  a much larger file that has since been substantially cut down (e.g.
  `auth.tsx` at 40 lines today) -- these need the citing prose re-read to
  find where the described behaviour now lives, not just a line-number
  bump.
- The "quote mismatch" shape (612) needs the chained-citation sub-pattern
  separated out first (see example above) before treating the remainder
  as ordinary content drift.
