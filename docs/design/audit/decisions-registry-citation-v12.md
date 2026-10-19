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

## Wave 26 repair pass (task w26-c, DEC-518 amendment)

Before: **1265** (drift since the wave-10 measurement of 1260 -- re-measured
by forcing `DECISIONS_REGISTRY_CITATION_CEILING` to `-1` on this branch and
reading the printed offender list, per the standing DEC-069 rule that this
ratchet moves DOWN every wave it is red). Per-file offender density this
wave: `decisions/DEC-422.md` 31, `decisions/DEC-069.md` 25,
`decisions/DEC-358.md` 20, `decisions/DEC-072.md` 18, `decisions/DEC-592.md`
15, `decisions/DEC-851.md` 14, `decisions/DEC-147.md` 13 (and others below
13, unrepaired this wave).

All 31 offenders in `decisions/DEC-422.md` -- this wave's top-density file
-- were repaired at the citation, never by raising the constant and never
by inventing a quote. Two shapes:

- **(a) a `path:line` citation's neighbouring backtick text misread as its
  own receipt quote.** One instance: the wave-1 amendment's `Max ${N}`
  survey packed roughly twenty bare `module.ts:line[,line...]` fragments
  and five quoted refusal-grammar examples into one dense paragraph, each
  citation's own parenthesised quote sitting BEFORE it in the prose and the
  NEXT item's quote sitting close enough after to be misread as the
  receipt. Repaired by rewording the whole paragraph past-tense (the
  five-grammar audit it describes was already closed by the paragraph's
  own landed ruling) and dropping the seventeen now-redundant bare-path
  fragments rather than re-punctuating twenty adjacent citations. A second
  instance: `src/lib/pagination.ts`'s citation had its neighbouring prose
  word `` `export` `` (describing what the cited line lacks) misread as a
  receipt quote for the citation itself -- repaired by dropping the
  backticks around the prose word rather than touching the citation.

- **(b) a quote or line number that no longer matches because the cited
  construct drifted or the paragraph describing it went stale.** Two
  isolated line-drift citations (the save-draft handler, since split out
  of `submit.tsx` into `submit-draft.tsx`; `MAX_CRITERION_GUIDANCE_LENGTH`,
  since moved from `evaluation.ts` into `evaluation/criteria.ts`) were
  converted to the DEC-518 drift-proof shape (repo-relative path plus a
  backtick-quoted verbatim construct, no `:line` suffix) and re-anchored on
  the construct's current home. One missing-prefix bare path
  (`routes/api/views.ts` → `src/routes/api/views.ts`) was corrected and
  converted to the same drift-proof shape. Four paragraphs described a bug
  or gap that a LATER amendment in the same file had already closed
  (PlanEditor's hand-typed `MAX_CRITERIA = 7`, since replaced by the pure-core
  `MIN_CRITERION_OPTIONS`/`MAX_CRITERION_OPTIONS` pair; the participant-cap
  overage copy, since routed through `participantCapRefusalMessage`; the
  repeated-single-value-answer merge in the portal edit/task forms, since
  routed through `readSingleFormValue`/`REPEATED_ANSWER_MESSAGE`) -- each
  reworded past-tense and re-anchored on the construct that closed it (the
  wave-10 DEC-010 precedent for a since-CLOSED paragraph).

After: **1234**, re-measured by re-running the scan on the repaired tree
with the ceiling still forced to `-1`.
`DECISIONS_REGISTRY_CITATION_CEILING` lowered 1260 → 1234; the two-sided
"ceiling is not stale" companion is green in the same run.

## Wave-44 update (task w44-c)

A prior wave's custodian split already lowered
`DECISIONS_REGISTRY_CITATION_CEILING` from 1234 to 1228, unrelated to this
task. Re-measured live, not inherited, on this branch:
`src/decisions-data/DEC-967.md` carried one more unresolved decisions/
registry citation (`test/deviations-ledger.scan.test.ts`'s own line-count
had drifted under it, and a three-way chained `App.tsx`/`settings.css`/
`Chautauqua Settings.dc.html` backtick run misread each neighbour's
citation as its own receipt quote), repaired by converting both to bare
prose per DEC-967's own drift-proof shape. Live measurement today:
`DECISIONS_REGISTRY_CITATION_CEILING = 1227`.

## WAVE 57 (merge-train repair pass, thunderdome medic)

The wave-44-c measurement recorded above (`DECISIONS_REGISTRY_CITATION_CEILING`
`= 1227`) was overtaken by the wave-55/56/57 train, which drifted the true
count up to 1237 -- ten rows OVER the declared ceiling. Per the DEC-069 RULE
carried in the constant's own comment, the repair is the citations and never
the constant.

Thirteen offenders repaired, and the ceiling then lowered to the re-measured
value rather than to a hoped-for one:

- `decisions/DEC-535.md` (2). The J4 bulk reviewer-nudge handler moved out of
  `src/routes/review/plans.ts` into `src/routes/review/plans-progress.ts` when
  that monolith was decomposed, leaving a line-keyed citation pointing into a
  28-line stub; and the cron fan-out's `runDueReminders` drifted off its
  quoted line. Both re-anchored on the DEC-518 drift-proof shape -- repo-relative
  path immediately followed by a backtick-quoted verbatim construct, no `:line`
  suffix -- so neither can rot from line movement again.
- `decisions/DEC-026.md` (11). Five bare-basename citations that resolved
  uniquely when written and went AMBIGUOUS as the contacts layer grew second
  and third files of the same name (`merge.ts` now exists three times,
  `history.ts` twice); each given its repo-relative prefix. Three line-keyed
  citations repointed at the construct they name after it moved -- the
  `mergeOnePair` fold, `previewMerge`'s call site, and the phone
  import-column assertion, whose stale `width:100%` claim was corrected to
  the `width:262px` / `max-width:48%` the test actually pins. And one run of
  three adjacent code spans de-adjacented into a plain list per the DEC-008
  wave-10 precedent, since adjacent `path:line` spans read as each other's
  receipt quote.

Re-measured on the repaired tree by running the scan: the live value today is
`DECISIONS_REGISTRY_CITATION_CEILING = 1224`.

## Multi-portal decision 74

Re-measured on this branch: the decision docs' stale citations into the deleted Settings resource panel, Settings › Portals edit form and general portal preview were rewritten or marked as deleted, which also repaired three citations whose cited lines had only moved.

`DECISIONS_REGISTRY_CITATION_CEILING` moves 1224 -> 1221.

## Multi-portal decision 76

Re-measured on this branch: the decision docs' citations into the retired acceptance planner (`submissions/status.ts`, `domain/acceptance.ts`) were marked as removed, and citations whose cited lines had only moved (the Speakers grid, the New task modal, the task routes) were re-pointed, which also repaired five that had drifted before.

`DECISIONS_REGISTRY_CITATION_CEILING` moves 1221 -> 1216.
