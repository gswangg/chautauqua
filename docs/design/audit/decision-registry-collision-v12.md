# Decision-registry id collision (DEC-976 wave-155, task w11-pd)

Two directories hold `DEC-NNN.md` files and their ids COLLIDE: `decisions/`
(the older, canonical directory for `test/decisions-parity.test.ts` and the
`void DEC_NNN` compile pins) and `src/decisions-data/` (what the scribe has
written since wave 5, the population `test/decision-doc-citation.scan.test.ts`
checks under its two-directional citation grammar). Measured directly from
the tree with a throwaway script (`readdirSync` over both directories,
matched against `/^DEC-\d+\.md$/`, DEC-808 -- never a hand-listed manifest),
re-derivable by `test/decision-registry-collision.scan.test.ts`:

| Fact | Count |
| --- | --- |
| ids in `decisions/` | 999 |
| ids in `src/decisions-data/` | 77 |
| ids present in BOTH directories | 77 |
| pairs byte-identical | 0 |
| pairs with a different H1 title (different subject under one id) | 35 |
| of those 35, this wave's registry note written | 11 |

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
| DEC-013 | API conventions for /api/v1 and the SPA client contract | D21 amendment: the SWR read cache lives INSIDE the one API client and is opt-in per call site | AMENDS | |
| DEC-018 | Review API contract, criteria kinds, reviewer UX, and /api/v1/me | The plan editor at 390 is two lists, not a narrowed grid, with its save pair docked | SUPERSEDES | |
| DEC-024 | SPA shared modules for wave 3: useCurrentEvent, useMe, api.ts as sole wire | D21 amendment: URL-keying IS event scoping | AMENDS | |
| DEC-029 | Portal self-serve contract: tasks, invitations, sessions, resources | The portal's last two phone frames: Resources opens rather than downloads, and a rejected co-presenter is told what survived | AMENDS | |
| DEC-144 | Two permanent render gates: render-sweep + jsdom/RTL smokes | Wave-154 amendment: the route manifest carries tab and panel sub-states | AMENDS | |
| DEC-238 | Mailer failure taxonomy: system vs organizer-triggered sends | A skipped recipient the send report counts owes a comms-history row | AMENDS | |
| DEC-253 | Mobile bar for public, submit and portal surfaces, enforced by render-sweep | Wave-154 amendment: the live 390 pass measures every interactive element, not a class vocabulary | AMENDS | ✓ |
| DEC-367 | One design-token vocabulary for both runtimes; self-hosted variable fonts; no semantic red | An exemption is a grammar, not a punctuation mark -- repair `topLevelRulesWithExemption`'s exempt flag | SUPERSEDES | ✓ |
| DEC-374 | SSR CSS is injected via dangerouslySetInnerHTML and must be value-free | Amendment (wave 147): SSR stylesheets are inlined COMMENT-STRIPPED | AMENDS | ✓ |
| DEC-380 | Agenda phone flow: arm-then-tap over one room, 30-minute default placement | Amendment (wave 147): a live-count caption whose every input is already on the screen is buildable | AMENDS | |
| DEC-381 | The phone tab bar's five destinations are Overview, Submissions, Speakers, Content, More | The phone tab bar's fourth slot is contextual and every slot carries its dot above the label | AMENDS | ✓ |
| DEC-385 | One phone switch (max-width: 700px) and one set of phone metrics | Amendment (wave 103): a shadow can be load-bearing | AMENDS | ✓ |
| DEC-393 | 44px is the phone tap-target floor everywhere, MIN_TAP_TARGET_PX | Amendment (wave 147): a control's floor is the floor its OWN frame draws | AMENDS | ✓ |
| DEC-441 | SPEC §10 #3 (assisted chasing) ships now; #2 waits one more wave | Amendment (wave 135): The reminder email is built to its frame | AMENDS | |
| DEC-582 | GET / is an anonymous surface, styled from the public CSS family | A file split re-points every ledger row that cites it, in the splitting commit | SUPERSEDES | |
| DEC-621 | Comms on a phone lands on a choice, and no input may clip the text it holds | The Comms phone landing's draft card renders from a real persisted draft | AMENDS | |
| DEC-660 | One merge-field vocabulary: resolvable sets and the 100-recipient cap | Amendment (wave 147): the compose-time unresolvable-merge-field warning is built, not deferred | AMENDS | |
| DEC-663 | A CSV import is PLANNED before it is applied: dry run, per-line skips | Amendment (wave 135): A dry run plans the SAME inputs the real run applies | AMENDS | |
| DEC-700 | A badge is a live claim: exception counts refetch on navigation and mutation | D21 amendment: the mutation bump IS the cache's invalidation clock | AMENDS | |
| DEC-727 | Test tiers are DERIVED by predicate, never hand-listed | A test that touches `window` is jsdom/SLOW -- composeDraft.test.ts leaves the fast tier | AMENDS | |
| DEC-728 | Settings is a read-only summary with drill-in editing, drilled section is URL state | Amendment (wave 147): the navigation snapshot is a single module-level slot keyed by search | AMENDS | ✓ |
| DEC-730 | The onboarding grid's three status states are one control family | Status tokens pair by density and a banner never changes a status vocabulary | AMENDS | |
| DEC-777 | The speaker's own session page: one fact per row, event-timezone dates | Amendment (wave 147): the portal placement grammar carries the session's shape | AMENDS | |
| DEC-781 | Call for papers is a read-only summary with one drill-in | Settings' fixed grid tracks and field-width tokens are desktop geometry and collapse at 390 | SUPERSEDES | |
| DEC-851 | One filter contract for a public surface: page, .json, .xml, embed builder | D21 amendment: the client half never lands alone -- apiGetCached/apiListCached/useCachedRead | SUPERSEDES | |
| DEC-865 | The org user directory is organizer/reviewer only | Reviewer assignment resolves the user through the ORG_USER_ROLES vocabulary | AMENDS | |
| DEC-908 | Submission detail is the frame's three-and-three | Amendment (wave 147): the CFP confirmation card's meta reads through the one session-display vocabulary | AMENDS | |
| DEC-926 | Deleting a file version never leaves a task_assignment pointing at a hole | Amendment (wave 135): A repoint across a partial-unique link deletes the row before it re-links | AMENDS | |
| DEC-929 | Deleting an evaluation plan states its blast radius from ONE read | Deleting an evaluation plan freezes server-side once any evaluation exists | AMENDS | |
| DEC-937 | A stylesheet may only reference tokens that EXIST (em dash) | A stylesheet may only reference tokens that EXIST (double hyphen) | AMENDS (punctuation-only divergence) | |
| DEC-967 | A send is irreversible, so it asks once and names what it is about to do | Amendment (wave 135): A frame coordinate quoted inside an exclusion REASON is not a claim | SUPERSEDES | ✓ |
| DEC-976 | The app's CSS contract gains its second direction: a chq-* class must have a rule | Amendment (wave 135): The caption ledger's exclusion taxonomy is FOUR named classes | SUPERSEDES | ✓ |
| DEC-986 | The public CFP picks ONE track; the many-to-many model and wire shape stay | The phone CFP wizard validates before it advances, and conditional visibility un-requires controls | AMENDS | |
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

## Not resolved this wave

24 of the 35 title-divergent ids (all rows above with a blank Note column)
carry no registry note. `test/decision-registry-collision.scan.test.ts`
ratchets this population directly off the tree (readdirSync both
directories, DEC-808) and is seeded at 24; it may only be LOWERED, by
writing a registry note into the `src/decisions-data/DEC-NNN.md` side of a
divergent pair, never raised.
