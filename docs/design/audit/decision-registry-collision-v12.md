# Decision-registry id collision (DEC-976 wave-155, task w11-pd; drained wave w10, task w10-tf)

Two directories hold `DEC-NNN.md` files and their ids COLLIDE: `decisions/`
(the older, canonical directory for `test/decisions-parity.test.ts` and the
`void DEC_NNN` compile pins) and `src/decisions-data/` (what the scribe has
written since wave 5, the population `test/decision-doc-citation.scan.test.ts`
checks under its two-directional citation grammar). Measured directly from
the tree with a throwaway script (`readdirSync` over both directories,
matched against `/^DEC-\d+\.md$/`, DEC-808 -- never a hand-listed manifest),
re-derivable by `test/decision-registry-collision.scan.test.ts`. The
`src/decisions-data/` population grew from 77 to 92 files between task
w11-pd and task w10-tf as later scribe waves wrote more decisions under
existing ids; the counts below are RE-MEASURED at task w10-tf, not
inherited from the original table:

| Fact | Count (task w11-pd) | Count (re-measured, task w10-tf) |
| --- | --- | --- |
| ids in `decisions/` | 999 | 999 |
| ids in `src/decisions-data/` | 77 | 92 |
| ids present in BOTH directories | 77 | 92 |
| pairs byte-identical | 0 | 0 |
| pairs with a different H1 title (different subject under one id) | 35 | 48 |
| of those, a registry note is written | 11 | 48 (all -- drained to 0 unnoted) |

**Task w10-tf drained the ratchet to 0.** Every title-divergent id --
the 24 left unnoted by task w11-pd (`DEC-013, DEC-018, DEC-024, DEC-029,
DEC-144, DEC-238, DEC-380, DEC-441, DEC-582, DEC-621, DEC-660, DEC-663,
DEC-700, DEC-727, DEC-730, DEC-777, DEC-781, DEC-851, DEC-865, DEC-908,
DEC-926, DEC-929, DEC-937, DEC-986`), plus 7 more that surfaced as the
`src/decisions-data/` population grew (`DEC-382, DEC-575, DEC-720,
DEC-902, DEC-948, DEC-949, DEC-964`), plus whatever remainder of the
now-48-wide divergent population was already noted by other in-flight
work -- now carries a `> Registry note:` first line. `UNNOTED_REGISTRY_COLLISION_CEILING`
in `test/decision-registry-collision.scan.test.ts` is set to the
measured 0. **The registry note is now a PRECONDITION of creating any
new `src/decisions-data/DEC-NNN.md` file, not a cleanup task for a later
wave**: because `decisions/`'s 999-id space is closed (DEC-808) and the
scribe keeps writing new rulings under existing ids, every new file
collides with an existing `decisions/DEC-NNN.md` by construction. A
scribe wave that writes a new `src/decisions-data/DEC-NNN.md` under an
id whose `decisions/DEC-NNN.md` H1 differs MUST write the registry note
in the same commit that creates the file -- deferring it re-inflates
this ratchet exactly as it did across tasks w11-pd through w10-tf.

`decisions/` holds 999 `DEC-NNN.md` files (out of 1000 entries in the
directory; the remaining entry is `decisions/README.md`, which rules the
id space closed and is not itself a decision doc). All 77 ids that exist in
`src/decisions-data/` also exist in `decisions/` -- every collision is total,
there is no id in one directory's population that is merely absent from the
other. No pair is byte-identical: even the 42 non-title-divergent pairs
differ in body prose. 35 of the 77 pairs carry a DIFFERENT H1 under the same
id -- a different subject entirely, not a rewording of the same ruling.

## Why this matters

Every ledger, probe row and code comment in this repo that writes `DEC-NNN`
with no directory prefix is ambiguous for these 77 ids: the reader cannot
tell, from the citation alone, which of two non-identical documents is meant.
`src/decisions-data/DEC-NNN.md` is the one compile-checked (via
`src/decisions.ts`'s `DEC_NNN` constants) and the one
`test/decision-doc-citation.scan.test.ts` verifies citations against at
line-level depth; `decisions/DEC-NNN.md` gets bare-path existence checking
only (`test/decision-path-references.scan.test.ts`) and is the one
`test/decisions-parity.test.ts` and `decisions/README.md`'s closed-id-space
ruling depend on for stability. Neither directory is "the" registry; both
are load-bearing, and 41 live citations name `src/decisions-data/DEC-NNN.md`
by path, so neither may be moved or deleted to resolve the collision.

## Classification legend

- **AMENDS** -- the two documents share a subject; `src/decisions-data`'s
  ruling narrows, extends, or adds a constraint on top of `decisions/`'s
  ruling for that subject. Both stand; `src/decisions-data`'s is the
  operative refinement.
- **SUPERSEDES** -- the id was reused for an entirely unrelated later
  ruling with no narrative link to the `decisions/` subject; the two share
  only a number. `src/decisions-data`'s ruling is what the tree's scans and
  compile-checked constants actually govern today.
- **CONTRADICTS** -- the two documents give live, opposite instructions
  about the same concrete behavior. Only one id measures this way: DEC-991.

## The 35 title-divergent ids

Row order matches directory-read (`readdirSync`, alphabetical). A ✓ in the
Note column means a `> Registry note:` first line was written into
`src/decisions-data/DEC-NNN.md` this wave (the campaign-governing subset the
task named); a blank means the id is title-divergent but out of this wave's
named subset and remains unresolved (counted by the scan test's ratchet).

| id | `decisions/` H1 | `src/decisions-data/` H1 | Classification | Note |
| --- | --- | --- | --- | --- |
| DEC-013 | API conventions for /api/v1 and the SPA client contract | D21 amendment: the SWR read cache lives INSIDE the one API client and is opt-in per call site | AMENDS | ✓ |
| DEC-018 | Review API contract, criteria kinds, reviewer UX, and /api/v1/me | The plan editor at 390 is two lists, not a narrowed grid, with its save pair docked | SUPERSEDES | ✓ |
| DEC-024 | SPA shared modules for wave 3: useCurrentEvent, useMe, api.ts as sole wire | D21 amendment: URL-keying IS event scoping | AMENDS | ✓ |
| DEC-029 | Portal self-serve contract: tasks, invitations, sessions, resources | The portal's last two phone frames: Resources opens rather than downloads, and a rejected co-presenter is told what survived | AMENDS | ✓ |
| DEC-144 | Two permanent render gates: render-sweep + jsdom/RTL smokes | Wave-154 amendment: the route manifest carries tab and panel sub-states | AMENDS | ✓ |
| DEC-238 | Mailer failure taxonomy: system vs organizer-triggered sends | A skipped recipient the send report counts owes a comms-history row | AMENDS | ✓ |
| DEC-253 | Mobile bar for public, submit and portal surfaces, enforced by render-sweep | Wave-154 amendment: the live 390 pass measures every interactive element, not a class vocabulary | AMENDS | ✓ |
| DEC-367 | One design-token vocabulary for both runtimes; self-hosted variable fonts; no semantic red | An exemption is a grammar, not a punctuation mark -- repair `topLevelRulesWithExemption`'s exempt flag | SUPERSEDES | ✓ |
| DEC-374 | SSR CSS is injected via dangerouslySetInnerHTML and must be value-free | Amendment (wave 147): SSR stylesheets are inlined COMMENT-STRIPPED | AMENDS | ✓ |
| DEC-380 | Agenda phone flow: arm-then-tap over one room, 30-minute default placement | Amendment (wave 147): a live-count caption whose every input is already on the screen is buildable | AMENDS | ✓ |
| DEC-381 | The phone tab bar's five destinations are Overview, Submissions, Speakers, Content, More | The phone tab bar's fourth slot is contextual and every slot carries its dot above the label | AMENDS | ✓ |
| DEC-385 | One phone switch (max-width: 700px) and one set of phone metrics | Amendment (wave 103): a shadow can be load-bearing | AMENDS | ✓ |
| DEC-393 | 44px is the phone tap-target floor everywhere, MIN_TAP_TARGET_PX | Amendment (wave 147): a control's floor is the floor its OWN frame draws | AMENDS | ✓ |
| DEC-441 | SPEC §10 #3 (assisted chasing) ships now; #2 waits one more wave | Amendment (wave 135): The reminder email is built to its frame | AMENDS | ✓ |
| DEC-582 | GET / is an anonymous surface, styled from the public CSS family | A file split re-points every ledger row that cites it, in the splitting commit | SUPERSEDES | ✓ |
| DEC-621 | Comms on a phone lands on a choice, and no input may clip the text it holds | The Comms phone landing's draft card renders from a real persisted draft | AMENDS | ✓ |
| DEC-660 | One merge-field vocabulary: resolvable sets and the 100-recipient cap | Amendment (wave 147): the compose-time unresolvable-merge-field warning is built, not deferred | AMENDS | ✓ |
| DEC-663 | A CSV import is PLANNED before it is applied: dry run, per-line skips | Amendment (wave 135): A dry run plans the SAME inputs the real run applies | AMENDS | ✓ |
| DEC-700 | A badge is a live claim: exception counts refetch on navigation and mutation | D21 amendment: the mutation bump IS the cache's invalidation clock | AMENDS | ✓ |
| DEC-727 | Test tiers are DERIVED by predicate, never hand-listed | A test that touches `window` is jsdom/SLOW -- composeDraft.test.ts leaves the fast tier | AMENDS | ✓ |
| DEC-728 | Settings is a read-only summary with drill-in editing, drilled section is URL state | Amendment (wave 147): the navigation snapshot is a single module-level slot keyed by search | AMENDS | ✓ |
| DEC-730 | The onboarding grid's three status states are one control family | Status tokens pair by density and a banner never changes a status vocabulary | AMENDS | ✓ |
| DEC-777 | The speaker's own session page: one fact per row, event-timezone dates | Amendment (wave 147): the portal placement grammar carries the session's shape | AMENDS | ✓ |
| DEC-781 | Call for papers is a read-only summary with one drill-in | Settings' fixed grid tracks and field-width tokens are desktop geometry and collapse at 390 | SUPERSEDES | ✓ |
| DEC-851 | One filter contract for a public surface: page, .json, .xml, embed builder | D21 amendment: the client half never lands alone -- apiGetCached/apiListCached/useCachedRead | SUPERSEDES | ✓ |
| DEC-865 | The org user directory is organizer/reviewer only | Reviewer assignment resolves the user through the ORG_USER_ROLES vocabulary | AMENDS | ✓ |
| DEC-908 | Submission detail is the frame's three-and-three | Amendment (wave 147): the CFP confirmation card's meta reads through the one session-display vocabulary | AMENDS | ✓ |
| DEC-926 | Deleting a file version never leaves a task_assignment pointing at a hole | Amendment (wave 135): A repoint across a partial-unique link deletes the row before it re-links | AMENDS | ✓ |
| DEC-929 | Deleting an evaluation plan states its blast radius from ONE read | Deleting an evaluation plan freezes server-side once any evaluation exists | AMENDS | ✓ |
| DEC-937 | A stylesheet may only reference tokens that EXIST (em dash) | A stylesheet may only reference tokens that EXIST (double hyphen) | AMENDS (punctuation-only divergence) | ✓ |
| DEC-967 | A send is irreversible, so it asks once and names what it is about to do | Amendment (wave 135): A frame coordinate quoted inside an exclusion REASON is not a claim | SUPERSEDES | ✓ |
| DEC-976 | The app's CSS contract gains its second direction: a chq-* class must have a rule | Amendment (wave 135): The caption ledger's exclusion taxonomy is FOUR named classes | SUPERSEDES | ✓ |
| DEC-986 | The public CFP picks ONE track; the many-to-many model and wire shape stay | The phone CFP wizard validates before it advances, and conditional visibility un-requires controls | AMENDS | ✓ |
| DEC-989 | The v6 width system is three tokens and three classes applied at the PAGE ROOT | No phone surface may declare a horizontal extent wider than the 390 viewport minus its gutters | AMENDS | ✓ |
| DEC-991 | A clip exception names the ELEMENT's nature... wave-27 amendment: line-height <= 1 on a display face is BANNED OUTRIGHT | A display-face line-height <= 1 is legal exactly where a v12 frame declares it | CONTRADICTS | ✓ |

## DEC-991: the resolved contradiction

`decisions/DEC-991.md`'s wave-27 amendment measured three real offenders --
forms.css around line 44, comms.css around line 240, and auth.css.ts around
line 56, each a display face declaring `line-height: 1` and clipping its own
glyphs (see decisions/DEC-991.md for the pinned citations) -- and ruled: a display-font
heading either omits `line-height` entirely or declares >= 1.08; `1` is
BANNED OUTRIGHT, fixed by deletion, never substitution.

`src/decisions-data/DEC-991.md` was written later against a DIFFERENT
concrete case: `test/display-heading-line-height.scan.test.ts` flagged
`.chq-phone-agenda-wordmark`/`.chq-phone-agenda-h1` in `agenda.css`, but
`docs/design/Chautauqua Agenda.dc.html:129,133` -- the v12 frame, the
geometry authority -- literally draws `line-height:1` on those two elements.
Moving the app off-frame to satisfy the wave-27 ban would be the wrong
repair. Its ruling: a selector may be exempt from the wave-27 ban ONLY when
its rule carries a `docs/design/...:NNN` citation whose quoted literal
itself contains `line-height:1`, independently verified by the frame-citation
scan -- so the exemption cannot be claimed without a receipt.

**Resolution (this wave's registry note):** the wave-27 ban stands as the
default; `src/decisions-data/DEC-991.md` AMENDS it with a narrow,
receipted carve-out for the one case the frame authority itself mandates.
A display-face `line-height: 1` is legal if and only if a cited v12 frame
line literally draws `line-height:1` for that selector and the citation
scan verifies the quote; every other `line-height <= 1` on a display face
remains banned outright, fixed by deletion per the original wave-27 text.

## Campaign-governing verdicts (wave 156, task w12-qi)

The task-named campaign-governing subset -- the ids actually cited by workers
to justify a geometry decision -- verdicted individually below. Verdict
vocabulary is deliberately DIFFERENT from the "Classification legend" above
(AMENDS/SUPERSEDES/CONTRADICTS describes the RELATIONSHIP between the two
texts; SUPERSEDES/AMENDS/DISJOINT below names which directory's text is
BINDING, the practical question a worker citing "DEC-NNN" with no directory
prefix actually needs answered):

- **AMENDS** -- `src/decisions-data/DEC-NNN.md` carries the SAME founding
  ruling as `decisions/DEC-NNN.md` (identical or near-identical opening
  paragraph), refined by its own, separately-evolved amendment chain.
  `src/decisions-data` is binding: it is the compile-checked, actively-read
  copy every campaign scan and worker comment means when it writes `DEC-NNN`.
- **SUPERSEDES** -- the id's `src/decisions-data` amendment chain has moved
  so far from the founding subject (or the founding subject is dormant/
  unrelated to what the campaign actually governs by this id today) that
  `src/decisions-data`'s LATER ruling, not the founding text, is what's
  binding -- effectively a second ruling wearing the first one's id.
- **DISJOINT** -- the two texts give live, incompatible instructions about
  the same concrete behavior with no reconciling reading; one directory must
  be picked as binding by an explicit, separate ruling (not by directory
  seniority alone).

| id | binding directory | verdict | why |
| --- | --- | --- | --- |
| DEC-180 | `src/decisions-data` | AMENDS | same founding login-rate-limiter ruling (opening paragraph identical); `src/decisions-data`'s wave-153/154/156 amendment chain (SPA classless-control population widening, `SPA_CLASSLESS_CONTROL_CEILING`) is what `scripts/exit-predicate.ts` and every citing worker comment mean. |
| DEC-253 | `src/decisions-data` | AMENDS | title-divergent (see table above); wave-154's live-390-measurement amendment refines the founding render-sweep ruling and is what the control-floor scans read. |
| DEC-374 | `src/decisions-data` | AMENDS | title-divergent; wave-147's comment-stripped amendment refines the founding SSR-injection ruling; the CSS-comment-citation scans implement this text. |
| DEC-385 | `src/decisions-data` | AMENDS | title-divergent; wave-103's "a shadow can be load-bearing" amendment extends the founding one-phone-switch ruling. |
| DEC-393 | `src/decisions-data` | AMENDS | title-divergent; wave-147's "a control's floor is the floor its OWN frame draws" amendment refines the founding 44px-floor ruling; `MIN_TAP_TARGET_PX` and the frame-floor scans read this text. |
| DEC-613 | `src/decisions-data` | AMENDS | same founding Sessionboard-importer ruling; `src/decisions-data`'s wave-93 cluster-sheet-exemption amendment is the text the field guide's DEC-613 line ("a second copy of a citation vocabulary is a trap with a delay fuse") and every citing worker comment mean. |
| DEC-728 | `src/decisions-data` | AMENDS | title-divergent; wave-147's nav-snapshot amendment refines the founding Settings-drill ruling; `Settings.tsx`'s `editing`/URL-state logic implements this text. |
| DEC-808 | `src/decisions-data` | AMENDS | NOT title-divergent (confirmed by the scan's own negative control above) -- same founding page-measure ruling; `src/decisions-data`'s wave-93 citation-practice amendment ("a line-numbered citation is a claim and must sit beside its assertion") is the text the field guide's DEC-808 line ("a directory is not a population") quotes, and every scan comment in this campaign naming "DEC-808" means this text. |
| DEC-919 | `src/decisions-data` | SUPERSEDES | NOT title-divergent, but the founding subject (public-list filter idiom, `PublicSearchBox`/`PublicFilterBar`) is dormant for this campaign; every live citation (Submissions phone head DEC-919 wave-7, Settings read-drill DEC-919 wave-114/155/156) is `src/decisions-data`'s amendment chain governing a materially different subject (re-lining a frame's controls, never removing them) -- a later ruling wearing the founding id, not a refinement of it. |
| DEC-967 | `src/decisions-data` | SUPERSEDES | title-divergent (see table above); the id was reused for an unrelated later ruling (this task's own citation-grammar and DEC-991-supersession text lives here). |
| DEC-976 | `src/decisions-data` | SUPERSEDES | title-divergent; the id was reused (caption-ledger exclusion taxonomy) with no narrative link to `decisions/`'s CSS-contract-second-direction subject. |
| DEC-991 | `decisions/` | DISJOINT | the one CONTRADICTS pair (see table above and "DEC-991: the resolved contradiction" below) -- `decisions/DEC-991.md`'s wave-27 outright ban and `src/decisions-data/DEC-991.md`'s proposed frame-cited carve-out give opposite instructions for the same concrete case. This wave's amendment (in `src/decisions-data/DEC-991.md` itself) RULES the ban binding: it is the later ruling and the only one with a measured clip receipt behind it; the carve-out mechanism is retired unbuilt. See `docs/design/DEVIATIONS.md` §3 for the resulting blessed deviation. |

## Not resolved this wave

Nothing remains: task w10-tf (DEC-976) measured 31 unnoted offenders on
`main` at start (`DEC-013, DEC-018, DEC-024, DEC-029, DEC-144, DEC-238,
DEC-380, DEC-382, DEC-441, DEC-575, DEC-582, DEC-621, DEC-660, DEC-663,
DEC-700, DEC-720, DEC-727, DEC-730, DEC-777, DEC-781, DEC-851, DEC-865,
DEC-902, DEC-908, DEC-926, DEC-929, DEC-937, DEC-948, DEC-949, DEC-964,
DEC-986` -- one fewer than the task's own 32-id candidate list because
DEC-558 had already been noted by other in-flight work), wrote a registry
note into every one, repaired one malformed pre-existing note
(`DEC-948`, which named "the existing `DEC_948` registry constant" and
used lower-case `amends` instead of the scan's required
`decisions/DEC-NNN.md holds a different ruling (...); this file
AMENDS|SUPERSEDES it because ...` shape), and re-measured 0 unnoted
title-divergent ids. `test/decision-registry-collision.scan.test.ts`'s
`UNNOTED_REGISTRY_COLLISION_CEILING` is now 0 (two-sided ratchet: a
future scan measuring below 0 is impossible, and a scan measuring above
0 means a NEW `src/decisions-data/DEC-NNN.md` was created without its
registry note -- see the PRECONDITION rule above). `DEC-018, DEC-582,
DEC-781, DEC-851` were reclassified from this table's original AMENDS
guess to SUPERSEDES: on inspection their `src/decisions-data` ruling has
no narrative link to the `decisions/` founding subject (an entirely
different screen or system), matching the "Classification legend"'s
SUPERSEDES definition rather than AMENDS. `DEC-964` (Comms
Templates/History self-contained screens vs. group-row column emphasis)
was written as SUPERSEDES for the same reason.
