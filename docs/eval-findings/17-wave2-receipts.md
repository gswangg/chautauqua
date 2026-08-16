# Wave-2 rebase receipts (task-w2-f) — ALL-PASS block re-derivation + rebuilt in-flight census

MEASURED_SHA `1cac107dc1a954f54de8d3103a852a077b20fac6` ("merge task-w1-d"),
this worktree's own HEAD/`task-w2-f` branch point at `main`, derived AT
THIS TASK'S OWN RUNTIME (`git -C
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua rev-parse
HEAD` before the worktree was cut). This wave-counter is the harness's
second cycle after its wave-1 reset (see field guide's "WAVE COUNTER
RESET, TREE DID NOT" and "WAVE 2 IS A CODE WAVE" entries); the tree at
`1cac107d` already carries five more merges (`task-w1-b/-e/-f/-g/-h`)
than the `17-wave1-receipts.md` boundary (`5458bda3`). Any "wave N" token
below is a HARNESS LABEL for when a lane ran, not a claim about the
tree's age — read MEASURED_SHA, not the number.

This is a DOCS-ONLY mandate-hygiene task (DEC-358, DEC-702); no gate ran,
no `docs/verification-log/index/` section filed (DEC-069 precedent, w74/
w76/w78/w80/w81/w1).

## ALL-PASS block: items closed this task, each read directly against MEASURED_SHA

1. **A9 — `?section=<x>&edit=1` arriving read-only.** CLOSED, confirmed
   again (same shape task-w1-f's receipt already closed for the
   `resources` half; re-read here, not inherited). `app/src/pages/
   settings/ResourcesPanel.tsx:23-26` (DEC-785 wave-66 amendment
   comment): "This panel is only ever mounted inside its caller's own
   edit drill (PortalSettingsPanel's `edit=1` branch)... The default
   (unset) render is now always the full CRUD surface." `app/src/pages/
   settings/PortalSettingsPanel.tsx:110` sets `editing =
   searchParams.get('section') === SECTION_KEY &&
   searchParams.get('edit') === '1'`; the read-only summary row at
   `:216-219` renders `<ResourcesPanel readOnly />` while the editing
   branch at `:323` (inside the `editing` block wrapped by
   `SettingsEditForm`) renders bare `<ResourcesPanel />` — the full
   add/edit/delete surface. There is no independent `resources`
   deep-link target for a second nested drill to arrive at; DEC-358's
   wave-2 amendment (`decisions/DEC-358.md:142-144`) rules this closed
   verbatim.

2. **B12 — synth-title collision.** NOT A DEFECT, DO-NOT-CHASE,
   reconfirmed a third time. `scripts/seed.ts:133-159` (`SYNTH_TOPICS`)
   counted directly: exactly 27 entries. `scripts/seed.ts:1109` (grep
   for `additionalCount`) sets it to 27, matching `SYNTH_TOPICS.length`.
   `scripts/seed.ts:254-258` (`synthTitle`): `topic =
   SYNTH_TOPICS[i % SYNTH_TOPICS.length]` — since `additionalCount ===
   SYNTH_TOPICS.length`, `i % 27 === i` for every seeded `i` in
   `0..26`, so every synthesized title draws a distinct topic. No
   collision in this seed shape; whatever produced a judge's title
   collision is not reproducible from this code path.

3. **B17 — tracks/rooms error-clear.** NO CODE LANE, reconfirmed. `grep
   -n "setError(undefined)" app/src/pages/settings/TracksRoomsPanel.tsx`
   returns six hits, one as the first statement of each write function:
   `addTrack` (`:208`), `saveTrack` (`:234`), `confirmDeleteTrack`
   (`:269`), `addRoom` (`:287`), `saveRoom` (`:313`),
   `confirmDeleteRoom` (`:351`). DEC-856's error-cleared-at-write-start
   shape is present in source; this remains a click-through
   verification item, not a code fix, for whichever lane next has
   browser access.

4. **B20 — portal version-history minute-identical timestamps.**
   CLOSED, reconfirmed. `src/routes/portal/tasks/views.tsx:67` renders
   every version row's timestamp through
   `formatEventDateTimeWithSeconds(v.uploadedAt, timezone)`, not a
   minute-granular formatter — two versions uploaded in the same
   minute render distinguishable rows.

5. **P3 #23 — add-to-event advisory.** CLOSED by DEC-795, reconfirmed.
   `app/src/pages/contacts/AddToEventModal.tsx:20` ("existing roster
   spot on the selected event is an advisory, never a block") and
   `:76` ("an advisory, never a block (a second session is
   legitimate)"); the rendered advisory paragraph is at `:184`
   (`chq-contacts-advisory chq-add-to-event-advisory`). No disabling
   logic exists in the file; a second session for the same contact on
   the same event is deliberately legitimate, matching the primary
   Add-to-event action which is untouched.

6. **P3 #26 — participation rollup.** CLOSED at gate-11 under DEC-936,
   reconfirmed present in source. `src/server/repo/tasks/grid.ts:64`
   ("EVERY participation this contact covers on this roster row"),
   `:174-175`, `:283`, `:370` — the DEC-936 rollup (one roster row
   covering every participation a contact holds, "Mixed" status plus
   per-submission detail) is the shipped shape; DEC-358's wave-2
   amendment confirms this was already ruled closed at gate-11 and does
   not need re-opening.

## P3 #27 — DO-NOT-CHASE ruling recorded verbatim (DEC-358 wave-2 amendment)

`decisions/DEC-358.md:142-144` (Amendment, wave 2): "P3 #27 asks whether
public session/agenda cards should carry speaker job title and company;
its own text makes it conditional on the frames, the v11/v12
session-tag meta line is ruled, and no frame draws title/company on a
card. That is a design question, so it is answered here rather than
delegated: FORFEIT NOTE, not a fix — do not spend a lane on it."

## Rebuilt IN-FLIGHT census (`.git/refs/heads/`, `.git/packed-refs`, read at this task's own runtime)

`git merge-base --is-ancestor <branch> main`, run against every ref
present in loose refs OR packed-refs, at MEASURED_SHA `1cac107d`:

**Merged into `main` (not in flight, no citation needed):** `manual-qa`,
`task-custodian-w68-4`, `task-w2-c`, `task-w2-e`, `task-w2-g` (all three
last three sit at the same sha as `main` itself, `1cac107d`).

**STILL NOT ancestors of `main`, one clause each so the next planner does
not re-file the scope:**

- `task-w1-a` (`ecfe7005`) — the ONE still-running `task-w1-*` branch (the
  task brief's assumption of "four running `task-w1-*` branches" is
  STALE against this MEASURED_SHA — five more, `-b/-d/-e/-f/-g/-h`,
  merged since; only `-a` remains unmerged): seed hygiene, distinct eval
  comments per (reviewer, plan), narrows `seed_user_0004`'s whole-track
  scope (DEC-702 amendment). This is the direct fix for B13/B14 below —
  the next planner should check whether landing this branch closes them
  before re-filing a fresh seed-hygiene lane.
- `task-w2-a` (`390719ad`) — docs-content articles: speakers-tasks-and-
  content, agenda-and-publishing, embeds-and-public-pages.
- `task-w2-b` (`e3227fc6`) — docs-content articles: contacts-pipeline-
  and-comms, running-the-software.
- `task-w2-d` (`081c6bfa`) — docs-content: role-group vocabulary given
  one owner (DEC-613 amendment).
- `task-w81-e` (`078727e1`) — Settings §09 footer grammar + saved-embed
  card anatomy sub-clauses (DEC-896/DEC-785 wave-81).
- `task-w82-a` (`2e32b2c6`) — CFP FieldModal built to the vendored frame
  (DEC-650 wave-82).
- `task-w82-b` (`a47666b4`) — Email-log export filter params derived
  from the list, `templateId` honoured (DEC-027).
- `task-w82-c` (`8a91a77b`) — Two send-path invariants fixed
  (`reminders.ts` guard-after-use, `email-binding.ts` METHOD label;
  DEC-023/DEC-168).
- `task-w82-d` (`bd6c76df`) — ResultsTable renders the Choice-criterion
  distribution footer (DEC-241).
- `task-w82-e` (`d75ee129`) — Scorecard Choice criterion as a stacked
  radio row, Overall states its denominator.
- `task-w82-f` (`d802d381`) — Plan editor Choice options as editable
  rows, bounded 2..6 (DEC-422/DEC-018 w82 amendment).
- `task-w82-g` (`bb3667de`) — `/docs` user-facing site shell, index, and
  one written article.
- `task-w82-h` (`4f34d12e`) — De-duplicate `roomBelongsToEvent` onto
  `getRoomEventId`, enable `noUnusedLocals`.

These are the same nine branches the harness-wave-1 rebase reported as
"still not ancestors of `main` after a full wave" — confirmed unchanged
a second time this task, with `git merge-base --is-ancestor` re-run
directly rather than inherited.

**NEWLY DISCOVERED this task, also NOT ancestors of `main` — the
previous two rebases' census did not enumerate these (they predate the
harness's `task-w81-*`/`task-w82-*` numbering but were never merged or
pruned):**

- `mail-rich-shape-fallback` (`786642f7`) — reverts prod mail to the
  Cloudflare Email Service `send_email` binding (DEC-996 amended, user
  decision 2026-08-13).
- `task-w17-i` (`7b78d8b6`) — sign-in page names the event and its open
  CFP (DEC-716).
- `task-w68-b` (`88d7f55c`) — caps CSV-import field lengths to match
  `PATCH /contacts/:id` (DEC-663).
- `task-w71-a` (`f0538cab`) — session-over-break conflict warner, the
  WARNER's twin of the PLACER (DEC-010/DEC-557 amendment).
- `task-w72-a` (`b99f16de`) — agenda overlay z-index tier named
  (DEC-900 w72 amendment).
- `task-w72-b` (`3b81758b`) — agenda breaks editor moved behind a
  head-row disclosure.
- `task-w72-c` (`b079f202`) — shell footer deleted, Sign out rejoined to
  header identity (DEC-369).
- `task-w72-d` (`d6b42234`) — reviewer queue row anatomy: paired
  eyebrow, recused meta, queue-owned footer.
- `task-w72-e` (`763955e3`) — Scorecard reading column becomes the
  frame's body (DEC-889 wave-72).
- `task-w72-f` (`6f3e702b`) — who-reviews-what persistent cap row with a
  real summary (DEC-745 wave-72).
- `task-w72-g` (`0017ad09`) — CFP builder strip: editable Opens/Closes +
  real header Save.
- `task-w72-h` (`7141667a`) — agenda tray anatomy: duration in-card,
  tracks off-card, bare count, wrapping hint (DEC-571).
- `task-w72-i` (`27271675`) — content status band full-bleed via
  `--chq-main-pad-x` token, one status vocabulary.
- `task-w72-j` (`a363dac9`) — content worklist: Approve-N-ready moved
  off title row, inverted status emphasis.

RISK, stated plainly: none of these 27 branches (9 harness-`task-w82-*`/
`task-w81-e` + 4 current-cycle `task-w1-a`/`task-w2-a`/`-b`/`-d` + 14
newly enumerated from the interleaved earlier campaign) is an ancestor
of `main`. Several are single
uncommitted-into-main features (docs site shell, Choice-criterion UI,
export filter fix, conflict warner) that the ALL-PASS/V12 lanes above
assume or reference as landed — a planner reading only `main`'s source
tree will not see them. This receipt does not merge them (out of a
docs-only task's scope) — it only names them so the next planner can
decide whether to land, rebase, or abandon each one, and does not
re-file any of their scopes as new work.
