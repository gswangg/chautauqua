# Frame REPEATED-ROW ledger — DEC-180 wave-40

Instrument: `test/frame-repeated-row.scan.test.ts`. This lane builds the
pack's LAST named-but-unbuilt population, named in
`docs/design/audit/frame-conditional-state-v12.md`'s closing section
("Next population, named and deliberately not built"): every
`<sc-for list="{{ EXPR }}" as="ALIAS" hint-placeholder-count="N">` block
across `docs/design/*.dc.html`. Each one commits a frame to rendering a
REPEATED-ROW population from a named collection, at a drawn sample size —
a different vocabulary from the conditional-state ledger's boolean `sc-if`
branches (this is "how many rows", not "which branch"). This lane MEASURES
AND RATCHETS ONLY; no product byte and no CSS were changed.

## Population: 201 `sc-for`/`hint-placeholder-count` blocks across 12 of 13 `docs/design/*.dc.html` files

Derived at test time (`readdirSync` over `docs/design`, never hand-listed,
DEC-180). Confirmed at this worktree's HEAD (`3e2547267`, "scribe wave 40"):
exactly 201 `sc-for list=` occurrences and exactly 201
`hint-placeholder-count` occurrences, spanning 12 of the pack's 13
`*.dc.html` files (every file except `Chautauqua Account.dc.html`, which
draws no repeated-row population at all). The scan file's own
vacuous-population tripwire pins this at exactly 201 rows across exactly 13
`readdirSync`-discovered files (13, not 12, because the file count is the
discovered-file count, not the rows-present count), spanning ≥8 distinct
frames — both figures are asserted, not merely printed.

## Derivation rule (content search against the whole product corpus, never a hand-written frame→component map)

Each block is graded against the WHOLE product corpus (`app/src/**` +
`src/**`, non-test, comment-stripped and entity-decoded — the same corpus
`test/frame-caption-ledger.scan.test.ts` already grades against, reusing
`test/frame-source-corpus.ts`'s shared `enumerateSourceFiles`/
`normalizeSource`/`stripComments`/`labelIsMatched` primitives rather than
re-deriving them, DEC-613), never scoped to a hand-picked per-screen
cluster directory:

**TIER 1 — COPY MATCH.** This block's OWN literal text (its per-item
template, excluding any nested `<sc-for>` extent — a nested block's own
copy belongs to that inner row, not its wrapper, mirroring the
conditional-state ledger's own nested-`sc-if` exclusion), i.e. every run of
≥6 non-mustache, non-tag characters. If any such literal occurs verbatim
(word-boundary, comment-stripped, entity-decoded) anywhere in the product
corpus, TIER 1 reports MATCHED-COPY: the row's own drawn content is
realized somewhere in the shipped app, which for a REPEATED row can only
plausibly happen if some component actually renders more than one of it.

**TIER 2a — STRUCTURAL MATCH (identifier).** Only when TIER 1 finds no
literal at all (a fully template-composed block). The `list` expression's
LAST dotted segment (e.g. `phoneSlots` from `{{ phoneSlots }}`, `cells`
from `{{ row.cells }}`) is searched immediately adjacent to `.map(`
(comment-stripped): `IDENT.map(`. No minimum-length guard is applied here
(unlike the conditional-state ledger's `MIN_WORD_LENGTH` for bare-word
identifier search) — the discriminant SHAPE (`.map(` immediately following
the exact identifier) is itself the safety property: `content.map(` is a
real, deliberate array-render call in the product source, not a
coincidental substring of an unrelated string, even though `content` alone
would be far too generic to search as a bare word.

**TIER 2b — STRUCTURAL MATCH (alias).** Only when neither prior tier
finds evidence. The block's own `as="ALIAS"` — the frame's declared
per-item loop-variable name — is searched as a `.map()` callback's own
parameter name (`.map((ALIAS`/`.map(ALIAS =>`), restricted to aliases ≥5
characters. This pack's own aliases are almost all single letters or
`row`/`col`/`cell`/`card`/`ch` — too generic to discriminate safely as a
bare callback-parameter name — so this tier rarely fires in practice; it
exists for the aliases long enough to be genuinely discriminating.

A row with no evidence from any tier grades **GAP**. A row with evidence
from any tier grades **MATCHED**. This is a two-grade ledger (unlike the
three-grade conditional-state ledger) because the underlying question is
binary: does the cluster that owns this frame map over a real collection
into repeated markup, or not — not whether a separate test additionally
mounts it.

## Results: 111 MATCHED, 90 GAP

Measured by forcing `FRAME_REPEATED_ROW_GAP_CEILING` to `-1` in
`test/frame-repeated-row.scan.test.ts` and reading the printed roster back
(never invented, never derived by arithmetic) — the thrown error reported
exactly 90 GAP rows, restored to the roster below. The full 201-row roster
(both grades, in `docs/design/*.dc.html` file/line order):

| # | File | Line | List expr | Alias | Count | Grade |
|---|------|------|-----------|-------|-------|-------|
| 1 | Agenda | 77 | `rooms` | r | 4 | MATCHED |
| 2 | Agenda | 81 | `grid` | row | 10 | GAP |
| 3 | Agenda | 83 | `row.cells` | cell | 4 | MATCHED |
| 4 | Agenda | 106 | `tray` | t | 4 | GAP |
| 5 | Agenda | 147 | `phoneSlots` | slot | 8 | MATCHED |
| 6 | Agenda | 222 | `breakRows` | b | 3 | MATCHED |
| 7 | Comms | 66 | `steps` | s | 4 | MATCHED |
| 8 | Comms | 84 | `recipients` | r | 5 | MATCHED |
| 9 | Comms | 156 | `historyRows` | h | 4 | MATCHED |
| 10 | Comms | 199 | `historyRows` | h | 4 | MATCHED |
| 11 | Comms | 209 | `tabs` | t | 5 | GAP |
| 12 | Comms | 238 | `templates` | t | 5 | MATCHED |
| 13 | Comms | 292 | `templates` | t | 5 | MATCHED |
| 14 | Comms | 304 | `merge` | m | 6 | GAP |
| 15 | Comms | 342 | `historyRows` | h | 4 | MATCHED |
| 16 | Comms | 427 | `seamRows` | r | 5 | GAP |
| 17 | Comms | 517 | `skipped` | s | 2 | MATCHED |
| 18 | Comms | 638 | `historyRows` | h | 4 | MATCHED |
| 19 | Comms | 652 | `historyRecipients` | r | 4 | GAP |
| 20 | Comms | 691 | `emails` | e | 4 | MATCHED |
| 21 | Comms | 776 | `unresolved` | u | 3 | MATCHED |
| 22 | Contacts | 79 | `activeRules` | r | 2 | MATCHED |
| 23 | Contacts | 100 | `rows` | row | 2 | MATCHED |
| 24 | Contacts | 129 | `companies` | c | 5 | GAP |
| 25 | Contacts | 142 | `segments` | s | 4 | MATCHED |
| 26 | Contacts | 189 | `activeRules` | r | 2 | GAP |
| 27 | Contacts | 202 | `rows` | row | 2 | MATCHED |
| 28 | Contacts | 215 | `tabs` | t | 5 | GAP |
| 29 | Contacts | 241 | `contactGroups` | g | 4 | GAP |
| 30 | Contacts | 246 | `g.rows` | c | 4 | MATCHED |
| 31 | Contacts | 258 | `contactHistory` | h | 3 | GAP |
| 32 | Contacts | 291 | `mapping` | m | 5 | GAP |
| 33 | Contacts | 325 | `pipeline` | col | 5 | GAP |
| 34 | Contacts | 331 | `col.cards` | card | 3 | GAP |
| 35 | Contacts | 378 | `mergeRows` | m | 5 | MATCHED |
| 36 | Contacts | 413 | `contactGroups` | g | 4 | GAP |
| 37 | Contacts | 417 | `g.rows` | c | 4 | MATCHED |
| 38 | Contacts | 427 | `contactHistory` | h | 3 | GAP |
| 39 | Contacts | 459 | `pipelinePhone` | c | 3 | MATCHED |
| 40 | Contacts | 501 | `importTargets` | t | 5 | GAP |
| 41 | Contacts | 528 | `mergeRows` | m | 5 | MATCHED |
| 42 | Contacts | 634 | `enrollStages` | s | 5 | GAP |
| 43 | Contacts | 646 | `enrollScores` | n | 5 | GAP |
| 44 | Contacts | 689 | `importUpdates` | u | 4 | MATCHED |
| 45 | Contacts | 696 | `u.changes` | ch | 2 | GAP |
| 46 | Contacts | 791 | `importErrors` | e | 3 | GAP |
| 47 | Content | 84 | `rows` | row | 5 | MATCHED |
| 48 | Content | 145 | `versions` | v | 3 | MATCHED |
| 49 | Content | 170 | `comments` | c | 3 | MATCHED |
| 50 | Content | 216 | `rows` | row | 4 | MATCHED |
| 51 | Content | 230 | `tabs` | t | 5 | GAP |
| 52 | Content | 266 | `rows` | row | 4 | MATCHED |
| 53 | Content | 314 | `files` | f | 6 | MATCHED |
| 54 | Content | 348 | `files` | f | 6 | MATCHED |
| 55 | Content | 393 | `versions` | v | 3 | MATCHED |
| 56 | Content | 408 | `comments` | c | 3 | MATCHED |
| 57 | Docs | 47 | `nav` | g | 4 | GAP |
| 58 | Docs | 50 | `g.items` | i | 4 | MATCHED |
| 59 | Docs | 99 | `next` | n | 3 | GAP |
| 60 | Docs | 139 | `index` | g | 4 | GAP |
| 61 | Docs | 146 | `g.items` | i | 6 | MATCHED |
| 62 | Docs | 214 | `shotRules` | s | 6 | GAP |
| 63 | Docs | 309 | `defRows` | d | 3 | GAP |
| 64 | Docs | 330 | `next` | n | 3 | GAP |
| 65 | Home | 49 | `openEvents` | e | 1 | MATCHED |
| 66 | Home | 69 | `liveEvents` | e | 1 | MATCHED |
| 67 | Home | 88 | `archive` | e | 3 | MATCHED |
| 68 | Home | 132 | `openEvents` | e | 1 | MATCHED |
| 69 | Home | 146 | `liveEvents` | e | 1 | MATCHED |
| 70 | Home | 159 | `archive` | e | 3 | MATCHED |
| 71 | Home | 201 | `archive` | e | 3 | MATCHED |
| 72 | Home | 247 | `archive` | e | 3 | MATCHED |
| 73 | Home | 345 | `shown` | r | 5 | GAP |
| 74 | Home | 374 | `excluded` | x | 5 | GAP |
| 75 | Overview | 56 | `deadlines` | d | 4 | GAP |
| 76 | Overview | 78 | `overdue` | row | 3 | MATCHED |
| 77 | Overview | 101 | `triage` | row | 3 | MATCHED |
| 78 | Overview | 120 | `content` | row | 3 | MATCHED |
| 79 | Overview | 154 | `unplaced` | row | 3 | MATCHED |
| 80 | Overview | 171 | `quiet` | q | 3 | GAP |
| 81 | Overview | 197 | `deadlines` | d | 4 | GAP |
| 82 | Overview | 218 | `overdue` | row | 3 | MATCHED |
| 83 | Overview | 238 | `triage` | row | 2 | MATCHED |
| 84 | Overview | 256 | `content` | row | 2 | MATCHED |
| 85 | Overview | 285 | `quiet` | q | 3 | GAP |
| 86 | Overview | 295 | `tabs` | t | 5 | GAP |
| 87 | Overview | 385 | `triageRows` | row | 3 | MATCHED |
| 88 | Overview | 411 | `canvasCols` | c | 4 | GAP |
| 89 | Overview | 415 | `canvasRows` | r | 2 | GAP |
| 90 | Overview | 418 | `r.cells` | cell | 4 | MATCHED |
| 91 | Overview | 666 | `motionRows` | m | 3 | GAP |
| 92 | Overview | 675 | `neverAnimate` | n | 5 | GAP |
| 93 | Overview | 717 | `skeletonRows` | s | 6 | GAP |
| 94 | Public and Portal | 66 | `sessions` | s | 5 | MATCHED |
| 95 | Public and Portal | 105 | `days` | d | 3 | MATCHED |
| 96 | Public and Portal | 171 | `agendaSlots` | s | 7 | GAP |
| 97 | Public and Portal | 184 | `s.blocks` | b | 2 | MATCHED |
| 98 | Public and Portal | 221 | `agendaRooms` | r | 4 | GAP |
| 99 | Public and Portal | 289 | `agendaSlotsHi` | s | 7 | GAP |
| 100 | Public and Portal | 302 | `s.blocks` | b | 2 | MATCHED |
| 101 | Public and Portal | 339 | `agendaHiRooms` | r | 2 | GAP |
| 102 | Public and Portal | 386 | `sessions` | s | 5 | MATCHED |
| 103 | Public and Portal | 428 | `tasks` | t | 2 | MATCHED |
| 104 | Public and Portal | 455 | `done` | d | 3 | GAP |
| 105 | Public and Portal | 482 | `portalTasks` | t | 5 | GAP |
| 106 | Public and Portal | 512 | `formFields` | q | 5 | GAP |
| 107 | Public and Portal | 544 | `profileFields` | p | 6 | GAP |
| 108 | Public and Portal | 625 | `portalParticipants` | p | 2 | GAP |
| 109 | Public and Portal | 710 | `speakerCards` | s | 6 | MATCHED |
| 110 | Public and Portal | 761 | `galleryPeople` | s | 12 | MATCHED |
| 111 | Public and Portal | 806 | `savedDays` | d | 2 | GAP |
| 112 | Public and Portal | 812 | `d.rows` | s | 2 | MATCHED |
| 113 | Public and Portal | 871 | `saved` | s | 4 | MATCHED |
| 114 | Public and Portal | 934 | `tracks` | t | 3 | MATCHED |
| 115 | Public and Portal | 943 | `formats` | f | 5 | GAP |
| 116 | Public and Portal | 1043 | `tracks` | t | 3 | MATCHED |
| 117 | Public and Portal | 1052 | `formats` | f | 5 | GAP |
| 118 | Public and Portal | 1319 | `portalParticipants` | p | 1 | GAP |
| 119 | Public and Portal | 1414 | `portalParticipants` | p | 1 | GAP |
| 120 | Public and Portal | 1502 | `previewResources` | r | 3 | MATCHED |
| 121 | Public and Portal | 1569 | `previewResources` | r | 3 | GAP |
| 122 | Review | 70 | `plans` | p | 3 | MATCHED |
| 123 | Review | 106 | `reviewers` | r | 6 | MATCHED |
| 124 | Review | 127 | `results` | row | 4 | MATCHED |
| 125 | Review | 146 | `expanded` | e | 3 | GAP |
| 126 | Review | 218 | `scorecardAnswers` | a | 4 | GAP |
| 127 | Review | 229 | `criteria` | c | 3 | MATCHED |
| 128 | Review | 237 | `c.scale` | n | 5 | GAP |
| 129 | Review | 298 | `criteria` | c | 3 | MATCHED |
| 130 | Review | 307 | `c.scale` | n | 5 | GAP |
| 131 | Review | 314 | `c.choices` | o | 3 | GAP |
| 132 | Review | 384 | `queue` | q | 5 | GAP |
| 133 | Review | 428 | `queue` | q | 5 | GAP |
| 134 | Review | 495 | `planCriteria` | c | 3 | MATCHED |
| 135 | Review | 515 | `c.optionRows` | o | 3 | MATCHED |
| 136 | Review | 557 | `distributePreview` | p | 4 | GAP |
| 137 | Review | 570 | `planAssignments` | a | 4 | MATCHED |
| 138 | Review | 604 | `planCriteria` | c | 3 | MATCHED |
| 139 | Review | 615 | `c.optionRows` | o | 3 | MATCHED |
| 140 | Review | 646 | `planAssignments` | a | 4 | GAP |
| 141 | Review | 695 | `planCriteria` | c | 3 | GAP |
| 142 | Review | 742 | `defaultCriteria` | c | 3 | MATCHED |
| 143 | Review | 762 | `c.optionRows` | o | 3 | MATCHED |
| 144 | Review | 804 | `hubPlans` | p | 3 | GAP |
| 145 | Review | 851 | `hubPlans` | p | 3 | GAP |
| 146 | Review | 960 | `blankScale` | n | 5 | GAP |
| 147 | Settings | 55 | `sections` | s | 7 | MATCHED |
| 148 | Settings | 67 | `eventFields` | f | 5 | GAP |
| 149 | Settings | 110 | `tracks` | t | 3 | MATCHED |
| 150 | Settings | 118 | `rooms` | r | 4 | MATCHED |
| 151 | Settings | 133 | `publicPages` | p | 5 | MATCHED |
| 152 | Settings | 149 | `savedEmbeds` | e | 4 | MATCHED |
| 153 | Settings | 198 | `resources` | r | 3 | MATCHED |
| 154 | Settings | 219 | `people` | p | 4 | MATCHED |
| 155 | Settings | 248 | `tokens` | t | 2 | MATCHED |
| 156 | Settings | 285 | `mobileGroups` | g | 5 | GAP |
| 157 | Settings | 300 | `tabs` | t | 5 | GAP |
| 158 | Settings | 323 | `eventFields` | f | 5 | GAP |
| 159 | Settings | 358 | `tracks` | t | 3 | MATCHED |
| 160 | Settings | 373 | `rooms` | r | 4 | MATCHED |
| 161 | Settings | 403 | `exports` | e | 4 | MATCHED |
| 162 | Settings | 416 | `tokens` | t | 2 | MATCHED |
| 163 | Settings | 463 | `formQuestions` | q | 8 | GAP |
| 164 | Settings | 487 | `publicPages` | p | 5 | MATCHED |
| 165 | Settings | 533 | `resources` | r | 3 | MATCHED |
| 166 | Settings | 558 | `people` | p | 4 | MATCHED |
| 167 | Settings | 585 | `savedEmbeds` | e | 4 | MATCHED |
| 168 | Settings | 824 | `editTracks` | t | 3 | MATCHED |
| 169 | Settings | 843 | `editRooms` | r | 4 | MATCHED |
| 170 | Settings | 915 | `portalFields` | p | 5 | GAP |
| 171 | Settings | 927 | `editResources` | r | 3 | MATCHED |
| 172 | Settings | 989 | `editPeople` | p | 4 | MATCHED |
| 173 | Settings | 1079 | `embedFields` | x | 6 | GAP |
| 174 | Settings | 1150 | `tokens` | t | 2 | MATCHED |
| 175 | Settings | 1534 | `importFound` | i | 4 | GAP |
| 176 | Speakers | 81 | `tasks` | t | 6 | MATCHED |
| 177 | Speakers | 89 | `speakers` | row | 6 | MATCHED |
| 178 | Speakers | 104 | `row.cells` | cell | 6 | MATCHED |
| 179 | Speakers | 148 | `speakers` | row | 4 | MATCHED |
| 180 | Speakers | 156 | `row.cells` | cell | 6 | MATCHED |
| 181 | Speakers | 174 | `tabs` | t | 5 | GAP |
| 182 | Speakers | 240 | `responseRows` | r | 5 | GAP |
| 183 | Speakers | 267 | `speakers` | row | 6 | MATCHED |
| 184 | Speakers | 298 | `inviteMenu` | m | 4 | GAP |
| 185 | Speakers | 376 | `speakerTasks` | t | 6 | GAP |
| 186 | Speakers | 390 | `speakerFiles` | v | 3 | MATCHED |
| 187 | Speakers | 505 | `remindPreview` | r | 3 | GAP |
| 188 | Speakers | 644 | `taskAnswers` | a | 4 | GAP |
| 189 | Speakers | 709 | `taskWaiting` | w | 4 | GAP |
| 190 | Submissions | 82 | `statuses` | s | 6 | GAP |
| 191 | Submissions | 106 | `rows` | row | 8 | MATCHED |
| 192 | Submissions | 156 | `rows` | row | 5 | MATCHED |
| 193 | Submissions | 174 | `tabs` | t | 5 | GAP |
| 194 | Submissions | 235 | `answers` | a | 4 | GAP |
| 195 | Submissions | 247 | `reviews` | r | 3 | GAP |
| 196 | Submissions | 284 | `participants` | p | 2 | MATCHED |
| 197 | Submissions | 336 | `history` | h | 4 | GAP |
| 198 | Submissions | 368 | `answers` | a | 4 | GAP |
| 199 | Submissions | 377 | `reviews` | r | 3 | GAP |
| 200 | Submissions | 435 | `fields` | f | 8 | MATCHED |
| 201 | Submissions | 474 | `fields` | f | 8 | MATCHED |

Ceiling: `test/frame-repeated-row/ceiling.ts`'s
`FRAME_REPEATED_ROW_GAP_CEILING = 90`, a single two-sided ratchet (both
directions asserted in `test/frame-repeated-row.scan.test.ts`, per
DEC-099's positive/negative-control requirement, satisfied by the file's
own `describe('non-vacuity ...')` block over synthetic fixtures — never a
live row's own identity).

Re-measured with the multi-portal participant home in the tree: one GAP row
closed (the home's per-item rows now draw a repeated row the frame shows), so
`FRAME_REPEATED_ROW_GAP_CEILING = 89`.

## What a GAP row means, and what it doesn't

A GAP grade means this ledger's own two-tier join (literal copy anywhere in
the product corpus, or an identifier/alias immediately adjacent to `.map(`)
found no evidence. It does NOT by itself mean the feature is unbuilt — the
same epistemic caveat the conditional-state ledger's `f.note` finding
demonstrated (a mechanical join can false-negative when the product side
uses a different local variable name or a sibling per-frame audit already
found the match by a different method). This lane deliberately does not
adjudicate any individual GAP row — that is repair-lane work, out of this
MEASURE-AND-RATCHET lane's scope, DEC-180.

## Registration note (NOT done by this lane)

`FRAME_REPEATED_ROW_GAP_CEILING` is **not yet registered** in
`scripts/exit-predicate.ts` — that file's `CAMPAIGN_CONSTANT_NAMES`/
`TIER2_CEILING_NAMES` tables are owned by task `v12m-w37-c`. Per the field
guide's DEC-069 clause (b) (an exclusion/ratchet table's promotion promise
needs a promotion rule): a later lane may register this ceiling in
`scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE` (the same disposition
already given to `FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING`/
`FRAME_EYEBROW_DIVERGENCE_CEILING`) once — and only once — it has
re-measured this ceiling against the tree it is registering it into (forced
to `-1`, roster read back fresh, never carried on faith from this
document), the same discipline every other newly-measured population in
this campaign was registered under.

Re-measured again with the multi-portal organizer screens in the tree: the
new Portals, Sponsorships, approval-queue and person-record lists close nine
more GAP rows, so `FRAME_REPEATED_ROW_GAP_CEILING = 80`.
