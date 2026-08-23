# Audit-doc handoff paragraph staleness (DEC-903 wave-41, task w41-a)

Four consecutive waves (38, 39, 40, 41) paid a hand-audit tax re-reading
`docs/design/audit/**/*.md`'s deferral-shaped paragraphs by eye every time,
each wave rediscovering that most of them were already paid (field guide
wave-39: "audit handoff paragraphs are mostly already paid"). Nothing
before this task counted that population automatically or graded each
paragraph's claim against something the tree can still measure. This
document, and its instrument at
`test/audit-handoff-paragraph-staleness.scan.test.ts`, answer that
question per-paragraph instead of by hand.

Note on this document's own wording: this file lives under
`docs/design/audit/**`, the exact population the instrument below scans.
Where a deferral phrase from the grammar table would otherwise appear
verbatim in this prose, this document paraphrases instead (e.g. "a
deferral clause" rather than quoting the literal phrase), so this document
does not silently add a row to the population it is describing.

## Population and grammar

Derived, never hand-listed (DEC-808): `readdirSync docs/design/audit`
RECURSIVELY, every `*.md` file split into blank-line-delimited paragraphs.
A paragraph is a CANDIDATE when its text (case-insensitive) carries a
deferral clause of one of eight shapes -- the same eight the instrument's
own header comment (`test/audit-handoff-paragraph-staleness.scan.test.ts`)
spells out literally, since that file lives outside `docs/design/audit/**`
and can name the phrases without adding a row to this population: a
work-remains claim, an open-status claim, a clause deferring to a future
wave, a clause addressed to the planner, a sized-versus-built claim, a
second phrasing of the work-remains claim, a clause deferring to a later
lane, or a forward-looking log-update clause.

## Grading

Each candidate paragraph is legal under exactly two dispositions:

- **(a) live non-zero measurable.** The paragraph names a
  `<NAME>_CEILING` / `<NAME>_FLOOR` / `<NAME>_TRIPWIRE` constant, resolved
  by grepping `test/**`, `app/src/**` and `scripts/**` for a top-level
  `[export ]const <NAME> = <int>;` declaration, whose live value is
  non-zero -- the claim "work remains" is still true because the
  instrument that would prove it false still reads non-zero.
- **(b) closure marker.** The paragraph carries CLOSED, RESOLVED, RETIRED,
  SUPERSEDED, or ALREADY RULED, recording that a later wave already
  adjudicated the claim.

Anything else is an offender: a claim that work remains with nothing left
in the tree that can still measure it.

## Measured result

Re-measured live on branch `v12m-w41-a` (wave 41): 22 offenders, forced
from a re-derived walk rather than trusted from wave 40's by-hand ~30
estimate.

| file:line | grammar | offending because |
| --- | --- | --- |
| `agenda-clash-390-v12.md:94` | sized-but-not-built | no constant named, no closure marker |
| `cancelled-padding-gap-v12.md:29` | for-the-planner | no constant named, no closure marker |
| `cancelled-padding-gap-v12.md:116` | future-wave deferral | names `CANCELLED_PADDING_GAP_CEILING`, which resolves to 0 (zero is not "still live") |
| `content-drill-390-v12.md:3` | for-the-planner | no constant named, no closure marker |
| `content-v12.md:26` | not-fixed | no constant named, no closure marker |
| `desktop-control-floor-v12.md:481` | still-open | no constant named, no closure marker |
| `desktop-control-floor-v12.md:490` | not-fixed | no constant named, no closure marker |
| `desktop-control-floor-v12.md:631` | not-fixed | no constant named, no closure marker |
| `docs-article-390-v12.md:83` | not-fixed | no constant named, no closure marker |
| `drawn-field-label-v12.md:20` | still-open | no constant named, no closure marker |
| `drawn-field-label-v12.md:182` | not-fixed | no constant named, no closure marker |
| `frame-conditional-state-v12.md:130` | for-the-planner | no constant named, no closure marker |
| `frame-conditional-state-v12.md:185` | for-the-planner | no constant named, no closure marker |
| `frame-conditional-state-v12.md:187` | sized-but-not-built | no constant named, no closure marker |
| `frame-control-floor-390-v12.md:129` | not-fixed + future-wave deferral | no constant named, no closure marker |
| `frame-eyebrow-label-390-v12.md:104` | next-...-sweep-to-log | no constant named, no closure marker |
| `open-divergence-ledger-v12.md:355` | still-open | names `OPEN_DIVERGENCE_CEILING`, which resolves to 0 |
| `public-390-request-verdicts-v12.md:105` | for-the-planner | no constant named, no closure marker |
| `public-submitted-390-v12.md:60` | not-fixed | no constant named, no closure marker |
| `public-submitted-390-v12.md:79` | not-fixed (dup phrasing) | no constant named, no closure marker |
| `review-hub-390-v12.md:21` | not-fixed | no constant named, no closure marker |
| `speakers-390-v12.md:128` | not-fixed | no constant named, no closure marker |

Two paragraphs matched the grammar but graded LEGAL and are excluded from
the roster above, as evidence the instrument discriminates rather than
flagging every deferral-shaped sentence: `open-divergence-ledger-v12.md:3`
names `CLAIMED_FLOOR`, which resolves to 100 (non-zero, still live) at its
first declaration in the code-root walk order; `frame-control-floor-390-
v12.md:150` names `FRAME_FLOOR_DIVERGENCE_CEILING` (0) alongside
`UNRESOLVED_COUNT_TRIPWIRE` (106, non-zero) -- the second name resolves
live, so the paragraph is legal under disposition (a).

This is an instrument-completeness fact about the checker's own claim
coverage over `docs/design/audit/**`, not a v12 frame or 390-geometry
conformance fact in its own right -- registered `OUT_OF_CAMPAIGN_SCOPE` in
`scripts/exit-predicate/campaign-scope.ts`.
