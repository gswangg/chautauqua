# Wave-counter-reset receipts (task-w1-f) — five ALL-PASS closures + rebuilt in-flight census

MEASURED_SHA `5458bda33d7a2ab3f6713c1e2d9580659f1fc188` ("merge task-w1-c"),
this worktree's own HEAD/`task-w1-f` branch point, derived AT THIS TASK'S
OWN RUNTIME (`git rev-parse HEAD` inside the worktree). Note for the next
lane: `main` in the shared repo advanced one further commit
(`509175a1`, "Two input adornment nits") after this worktree was cut —
that commit is UNRELATED to anything this task touches and is not
reflected in the citations below; they are read against `5458bda3`.

This is the harness's wave-counter RESET: the harness is issuing
`task-w1-*` branch names again while the tree itself is at wave-82+
vintage (see the field guide's own "WAVE COUNTER RESET, TREE DID NOT"
entry). Any "wave N" token elsewhere in this file (including the header
this replaces) is therefore a HARNESS LABEL for when a lane ran, not a
claim about the tree's age — read the MEASURED_SHA, not the wave number,
when weighing a citation's freshness.

This is a DOCS-ONLY mandate-hygiene task (DEC-358, DEC-702); no gate ran,
no `docs/verification-log/index/` section filed (DEC-069 precedent, w74/
w76/w78/w80/w81).

## Five closures/reclassifications re-verified this task, against MEASURED_SHA

Every citation below was read directly inside this worktree this task —
none is inherited from the planner's brief without a fresh read, per the
standing "a citation is not an assertion" rule.

1. **B12 (synth title reuses the fixture title)** — NOT A DEFECT,
   DO-NOT-CHASE, reconfirmed. `scripts/seed.ts:133-159` (`SYNTH_TOPICS`)
   holds exactly 27 entries (counted directly); `scripts/seed.ts:1109`
   sets `additionalCount = 27`, matching `SYNTH_TOPICS.length`, so
   `synthTitle(i)` (`:254-258`, `topic = SYNTH_TOPICS[i %
   SYNTH_TOPICS.length]`) draws a DISTINCT topic for every `i` in
   `0..26` even though the 10-entry `SYNTH_TITLE_TEMPLATES` cycles —
   the topic substitution alone guarantees no two synthesized titles
   collide with each other. Checked the three hand-authored fixture
   titles in `docs/fixtures/sample-data.json` ("Taming 40-Minute CI:
   Incremental Builds at Monorepo Scale", "Your AI Pair Programmer Is
   Lying to You: Verification Patterns That Scale", "Docs That Answer
   Back: Retrieval-Grounded Documentation Sites") against every
   `SYNTH_TITLE_TEMPLATES` × `SYNTH_TOPICS` combination by inspection —
   none match (the templates are all generic "Rethinking {topic}"-style
   phrases, the fixture titles are colon-subtitled and topic-specific).
   This reinstates the wave-62 ruling that a later wave's rebase had
   marked "not re-verified" without contradicting it.

2. **B20 (portal file-version rows show identical minute timestamps)** —
   CLOSED, reconfirmed. `src/routes/portal/tasks/views.tsx:67`:
   `<span class="chq-portal-detail">{formatEventDateTimeWithSeconds(
   v.uploadedAt, timezone)}</span>` — every version row in
   `VersionHistory` renders through the seconds-carrying formatter, not
   the minute-granular one. The function's own doc comment at `:55-56`
   states the reason: "two versions uploaded in the same minute must
   still read as distinguishable rows." DEC-158's seconds grammar does
   reach the portal.

3. **B17 (tracks-and-rooms: success + simultaneous error banner)** — NO
   CODE LANE, reconfirmed; DEC-856's shape is present but this needs a
   click-through, not a fix. `app/src/pages/settings/
   TracksRoomsPanel.tsx` calls `setError(undefined)` as the FIRST
   statement of every write function: `addTrack` (`:208`), `saveTrack`
   (`:234`), `confirmDeleteTrack` (`:269`), `addRoom` (`:287`),
   `saveRoom` (`:313`), `confirmDeleteRoom` (`:351`) — six sites, all
   read directly. Re-filed as a click-through verification item per the
   brief's instruction, not as an open code defect.

4. **A9 (settings deep-link `?section=<x>&edit=1` must arrive editing)**
   — NARROWED for the `resources` case; the item as originally worded
   named a section that does not independently exist. `app/src/pages/
   settings/ResourcesPanel.tsx:1-25` (header comment): "Rendered as a
   fragment (no own `<section>`/h2) inside PortalSettingsPanel's
   Resources row"; the file is a component, not a routed section.
   `app/src/pages/settings/PortalSettingsPanel.tsx:110`: `const editing
   = searchParams.get('section') === SECTION_KEY &&
   searchParams.get('edit') === '1'` (`SECTION_KEY` is `'portal'`, read
   at the top of the file); `:240`: `<SummarySection sectionKey=
   {SECTION_KEY} ... editing={editing}>`; `:323`: the full CRUD
   `<ResourcesPanel />` (no `readOnly`) renders inside that same
   `editing`-gated drill, alongside the read-only summary variant at
   `:216` (`<ResourcesPanel readOnly />`) outside it. There is no
   `?section=resources&edit=1` deep-link target to arrive at — the
   general item's `resources` half is the SAME drill as
   `?section=portal&edit=1`, which the field guide's w78 entry already
   cites as closed (`PortalSettingsPanel.tsx:110,216,240,323`, same
   line numbers this task independently re-read). Close this item's
   `resources` half; the item's other named half (an actual separate
   `resources` section outside the portal edit drill) does not exist in
   the schema/routing to be tested — DO NOT RE-FILE as if a bug were
   found, the surface being asked about does not exist as described.

5. **P3 #23 (add-to-event duplicate guard mints another session on
   confirm)** — CLOSED by DEC-795, reconfirmed. `app/src/pages/
   contacts/AddToEventModal.tsx:179-190`: when `alreadyOnRoster` is
   true, the component renders an advisory paragraph — "{firstName}
   {lastName} is already on this event — {N} {session|sessions}" — with
   a comment at `:180-183` stating "a second session is legitimate, so
   this never disables 'Add them' (relabelled below), only tells the
   organizer what they're about to do." No disabling logic gates the
   primary submit on `alreadyOnRoster` anywhere in the file (grepped
   directly). Minting another session on confirm is the DESIGNED
   behaviour, not a duplicate-guard defect; the dialog already carries
   the advisory the item's "explicit 'add ANOTHER session' confirm"
   request effectively describes.

## In-flight census (rebuilt fresh this task, replaces the wave-74 one)

At this task's own runtime, `main` (loose ref `.git/refs/heads/main` in
the shared repo, cross-checked against `.git/packed-refs` — absent
there, confirming the loose ref is authoritative) sits at `5458bda3`
("merge task-w1-c") at the moment this worktree was cut; a `git
rev-parse main` re-check from the shared repo during this task showed
`main` had since advanced one further commit to `509175a1` ("Two input
adornment nits"), unrelated to anything named below.

NINE branches, each carrying exactly ONE commit and confirmed NOT an
ancestor of `main` via `git merge-base --is-ancestor <branch> main`
(exit 1 / "NO" for every one, checked directly this task):

| branch | commit | subject | scope / OFF LIMITS for |
|---|---|---|---|
| `task-w81-e` | `078727e1` | Settings: close the last two carried §09 sub-clauses (DEC-896/DEC-785 wave-81) | §09 settings residue |
| `task-w82-a` | `2e32b2c6` | CFP FieldModal: build to the vendored frame (DEC-650 wave-82) | FieldModal frame/geometry (item 3 above, A3) |
| `task-w82-b` | `a47666b4` | Email-log export: derive filter params from the list, honour templateId | email-log export filter params (DEC-027) |
| `task-w82-c` | `8a91a77b` | Fix two send-path invariants that never fired (DEC-023, DEC-168 wave-82) | send-path invariants (DEC-023/DEC-168) |
| `task-w82-d` | `bd6c76df` | Results table: render the Choice-criterion distribution footer (DEC-241) | ResultsTable Choice distribution |
| `task-w82-e` | `d75ee129` | Scorecard: Choice criterion becomes a stacked radio row; Overall states its denominator | Scorecard Choice radio row |
| `task-w82-f` | `d802d381` | Plan editor: Choice options as editable rows, bounded 2..6 (DEC-422/DEC-018 w82 amendment) | PlanEditor Choice option rows |
| `task-w82-g` | `bb3667de` | Stand up user-facing docs site: shell, index, and one written article | the `/docs` shell + index + first article |
| `task-w82-h` | `4f34d12e` | De-duplicate roomBelongsToEvent onto getRoomEventId and enable noUnusedLocals (DEC-021 wave-82) | `roomBelongsToEvent`/`getRoomEventId` dedupe + `noUnusedLocals` |

All nine are OFF LIMITS for any concurrent or future lane touching the
files/scopes named in the right column until they land or are
independently re-derived as dead.

This task's own siblings (`task-w1-a` through `task-w1-e`), checked the
same way: `task-w1-a`, `task-w1-d`, `task-w1-e` are ancestors of `main`
(0 commits ahead — running, no work landed yet as of this read);
`task-w1-b` carries one unmerged commit ("docs screenshot shoot script
(v12 intake B; DEC-644)"); `task-w1-c` is an ancestor of `main` (already
merged — its content, "docs content: first tranche of four JSX-free
articles (DEC-518)", is the `5458bda3` merge commit itself). These are
recorded for completeness, not part of the NINE off-limits population
above (which is scoped to the pre-existing w81/w82 branches named in the
task brief).

## Sequencing (restated, per the brief)

The ALL-PASS lane (`docs/eval-findings.md`'s "ALL-PASS PUSH" block) is
now DRY except: (a) seed hygiene — B12 is now closed as not-a-defect
(item 1 above), B13/B14 remain open and reproduced (wave-81 receipt,
unchanged, in flight this wave under the nine-branch census's docs-site
and Choice-criterion lanes, none of which touch seed.ts), and (b) the
docs site (`task-w82-g`, in flight, one commit not yet merged). Once
those are dry: gate-12 fleet (all-PASS target, now including the 03
Choice-criterion frames + 13-docs shell) → FREEZE → scripted screenshot
shoot + docs content finalize → final deploy (carries docs) → final
official eval run → submission held for user.
