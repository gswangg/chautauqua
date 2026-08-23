# render-sweep advisory-gate promotion evidence (DEC-069 wave-41 amendment)

Task v12m-w41-g. DEC-069's wave-41 amendment rules that every
`*_BLOCKING = false` flag in scripts/render-sweep-lib.ts needs a named
promotion predicate, never a bare unfulfillable promise in a comment.
Two of the three flags -- TYPE_ROLE_BLOCKING and INTERACTION_STATE_BLOCKING
-- promise a flip once "a reading has come back all-PASS and been
reconfirmed on a later branch" (DEC-387's flip rule, the same one that
already fired for ADMIN_MOBILE_PASS_BLOCKING and FONT_FLOOR_BLOCKING). That
reading is a live getComputedStyle probe against a booted server, which no
fast-tier test may take (this lane is contractually forbidden from running
`gate:render-sweep`). This document is the recorded-reading artifact the
promotion registry points at for both flags -- it records what evidence
already exists in the tree, and states plainly what is still owed before
either flag may actually flip.

## What the tree already contains

Two verification-log entries, both reachable ancestors of this lane's own
HEAD, already report the live render-sweep type-role and interaction-state
passes reading all-PASS:

- docs/verification-log/task-w44-e-render-sweep-6edb5263.md, recorded at
  product sha 6edb526323f8ce3af8f8e71d791a722a7b1a69ad: "7/7 type-role
  checks passed" and "3/3 interaction-state checks passed".
- docs/verification-log/task-w48-f-render-sweep-243b3094.md, recorded at
  product sha 243b3094dcc4dd9125dc01f9cec01dc396251e89 -- a LATER sha,
  confirmed by `git merge-base --is-ancestor` to descend from the first --
  independently reports the same "7/7 type-role checks passed" and "3/3
  interaction-state checks passed" totals, zero FAIL rows anywhere in the
  sweep.

Read narrowly, that pair already satisfies DEC-387's letter: an all-PASS
reading, reconfirmed all-PASS on a later branch. It does NOT, on its own,
license this lane to flip either flag.

## Why this lane does not flip TYPE_ROLE_BLOCKING or INTERACTION_STATE_BLOCKING today

This task's own brief forbids running the live gate, so nothing in this
worktree re-measures whether that reading still holds at current HEAD.
Between sha 243b3094 and this lane's HEAD, other lanes have continued to
touch `/admin/overview` and the controls the B8 interaction-state probe
exercises (see the field guide's own running tally of merge-train wake);
a stale all-PASS reading carried forward without re-confirmation is
exactly the "declared, not measured" illusion DEC-069 exists to refuse.
Promotion is a MEASURE-AND-FLIP act, not a cite-and-flip one. RULED (by
this lane, narrowest reading): a future lane re-runs `gate:render-sweep`
against its own tip, and if the type-role and interaction-state passes
still read all-PASS there, that lane edits scripts/render-sweep-lib.ts to
flip TYPE_ROLE_BLOCKING and INTERACTION_STATE_BLOCKING true in the SAME
commit as its own recorded reading, appended below this section by voice
(never overwriting the citations above).

## Recorded-sha index (for the promotion-rule scan's existence check)

- type-role reading: sha 6edb526323f8ce3af8f8e71d791a722a7b1a69ad (first),
  reconfirmed at sha 243b3094dcc4dd9125dc01f9cec01dc396251e89 (later).
- interaction-state reading: same two shas, same two documents, same
  all-PASS totals.
