# A frame extent must not run past its template close (v12m-w41-b)

DEC-967's wave-41 field-guide finding named the defect: in
`app/src/frame-citation-frames.ts` every frame extent used to run to the
NEXT label line, or — for the last labelled block of a `docs/design/*.dc.html`
file — to end-of-file (`nextLabel ?? Infinity`, `labelLineNums[i + 1] ??
Infinity`). Every one of the 13 design files closes its drawn template with
a single `</x-dc>` exactly one line before `<script data-dc-script>` opens,
so the last labelled block of every file was silently swallowing its own
script body — 236 lines/370 strings onto Portal · Resources, 158/234 onto
Scorecard · a criterion unscored, 1,049 style declarations tree-wide (field
guide, wave-41). A `.dc.html:<line>` citation landing inside that script
body still "resolved to a real frame" under the old extent math: the
verbatim-quote check only compares a cited line's text, never asks whether
that line sits inside the drawn template at all.

## The fix

`app/src/frame-citation-frames.ts` gained `templateCloseLine(fileName)`: the
1-based line of the file's single `</x-dc>`, throwing loudly if a file has
zero or more than one (fail-loudly — this derivation depends on exactly one
template boundary existing per design file). Both `frameExtentsInFile`
(phone) and `desktopFrameExtentsInFile` (desktop) now clip their computed
`extentEnd` to `Math.min(extentEnd, templateCloseLine(fileName))`, so no
extent this module exports can ever reach past a file's template close.

A citation whose cited line is `> templateCloseLine` is classified
PAST_TEMPLATE via the new `isPastTemplate(fileName, line)` predicate. This
is a distinct kind from "the cited line doesn't exist" or "the quote
mismatches": a PAST_TEMPLATE citation may point at a perfectly real, exactly
matching line — it is disqualified purely by being outside the drawn
template, inside `<script data-dc-script>` markup a frame extent can never
mean to cover.

## Effect on the existing receipt ceilings

Because every extent this module exports is now clipped, a citation whose
line falls past the close no longer satisfies `isInsideAPhoneFrame` /
`isInsideADesktopFrame` for ANY labelled block in its file (the clip pulls
the last block's `extentEnd` down to `templateCloseLine`, and no later block
exists to pick it up). Such a citation simply falls out of the population
`TEST_PHONE_CITATIONS`/`TEST_DESKTOP_CITATIONS` filter on — it was never
inside a frame to begin with. `UNRECEIPTED_CLAIM_CEILING`,
`DESKTOP_UNRECEIPTED_CLAIM_CEILING`, `HEADER_SCOPE_WITHOUT_RECEIPT_CEILING`
and `DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING` all remeasure to their
already-declared `0` on this branch (confirmed by a dedicated assertion in
`app/src/frame-citation.scan.test.ts`) — the clip removes offenders from
consideration, it never adds one.

## `FRAME_CITATION_PAST_TEMPLATE_CEILING`

A new population and ratchet ceiling in `app/src/frame-citation.scan.test.ts`
gives the removed citations a name and a count, rather than letting them
vanish from every ceiling's population with no record they ever existed.

- **Population**: every `docs/design/<Name>.dc.html:<line>` citation
  (`STRICT_RE`/`ABBREV_RE`, this file's own vocabulary — DEC-613, never a
  second copy) found across four roots: `test/`, `app/src/` (both
  `*.css`/`*.ts`/`*.tsx` and `*.test.ts`/`*.test.tsx`), `src/` (`*.ts`/
  `*.tsx`, both non-test and test), and `src/decisions-data/*.md` — the
  root fact's stated scope. The `.md` root is enumerated directly via
  `readdirSync` (DEC-808 — never a hand-listed manifest); the other three
  reuse `enumerateFiles`/`enumerateTestFiles` from `./frame-citation-core`
  verbatim.
- **Rule**: a citation counts only when it names a REAL design file (via
  `designFileNames()`) — a citation naming a nonexistent frame file is a
  different, pre-existing defect this task does not touch — and its cited
  line is `isPastTemplate`.
- **Shape**: a two-sided ratchet (`FRAME_CITATION_PAST_TEMPLATE_CEILING`,
  mirroring `UNRECEIPTED_CLAIM_CEILING`'s own companion idiom): fails above
  the ceiling with the full offender roster printed, and fails below it too
  (a stale ceiling must never hide fixed debt).
- **Measured**: 19 on this branch, re-derived directly (forced to `-1`,
  roster read back) rather than trusted from the task brief's own
  approximate "24" — the brief itself warned not to trust that number. This
  task does not repair any of the 19 named citations; it only gives their
  shape a name and a ceiling, matching every other newly-derived ceiling's
  disposition in this campaign (DEC-808/DEC-986).

## Campaign scope

`FRAME_CITATION_PAST_TEMPLATE_CEILING` is registered in
`scripts/exit-predicate/campaign-scope.ts`'s `OUT_OF_CAMPAIGN_SCOPE`
(appended at the end of the object, principle-only reason, no provenance
narrative — three other in-flight lanes hold that file this wave). It
measures citation hygiene — a stale line number, or a reference into a
design file's non-drawn scaffolding — never a v12 frame or 390-geometry
conformance fact about any screen the product draws, the same disposition
already given to `GATE_TIMEOUT_MARGIN_UNGUARDED_CEILING` and
`FRAME_EYEBROW_UNRESOLVED_CEILING`.

## Synthetic controls

`app/src/frame-citation.scan.test.ts` adds positive/negative controls
against `Chautauqua Speakers.dc.html` (template close at line 728, chosen
because it is a REAL design file, per this suite's own convention that a
synthetic control never invents a frame path — wave-107/108):

- **Positive**: `templateCloseLine + 1` classifies `isPastTemplate === true`
  and resolves inside NEITHER `isInsideAPhoneFrame` nor
  `isInsideADesktopFrame`.
- **Negative**: `templateCloseLine - 1` classifies `isPastTemplate === false`
  and still resolves inside the frame extent that contains it (the last
  labelled block before the close, at line 665, is a desktop extent).
- **Fail-loudly**: `templateCloseLine` on a design file name that does not
  exist under `docs/design/` throws rather than silently returning a
  sentinel.
