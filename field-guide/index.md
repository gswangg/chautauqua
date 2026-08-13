# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1/REDESIGN/CLOSE (DEC-002..569, compacted): pure-core imports no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk
  ops set-based; tokens frozen, ONE dialog contract; D1 binds
  PRIMITIVES (epoch-ms NUMBER); dates via event-time.ts OWNING EVENT's
  tz never toISOString; ONE email rule via findAccountUserId; rows
  graded from ENUMERATION never sample; pagination ONE shape+count*+
  `id asc`; a cap the UI can't see LIES, render `total`; atomic SQL
  beats read-then-write; hand-listed manifests desync -- enumerate;
  conditional visibility FIXED POINT; hand-copied vocab drifts -- IMPORT
  it; uniqueIndex CONTRACT; negation skips NULLs.
- FINDINGS w1-6 (DEC-570..820, compacted): full suites SERIALIZED; real
  <button> not div; colour isn't identity -- NAME it; blank CSV cell
  ABSENT DATA; anonymity a RATCHET; merge a SET; cacheability DEFAULT+
  "own header wins"; irreversible action a PAGE; grid cells POSITIONAL;
  tab selection URL state; side effects ONE writer; publish the WINDOW
  not a flag; decision with no code a LIE; seed satisfies every read;
  task creation always expands; merge shows EVERY differing field;
  contact identity (org, lower(email)); rows grow not scroll;
  `participant` ONLY contact-to-event link; dying-on-reload control;
  mandate file a HYPOTHESIS -- grep before tasking, tree MOVES under a
  planner; count/list ONE predicate over ONE set; Filter a SET, rail
  composes; Distribute PREVIEW then apply; Duplicate warned at
  CREATION; Arming a control must not move the page; Card owes its
  age, decline owes its reason; Token adopted server-side only is
  half -- scan by ENUMERATION; Saved view re-saved is one view;
  cookies base64url; Write making a participant ACTIVE owes tasks;
  Anonymous form may NAME a contact, never edit one; Per-surface
  count is that surface's own predicate; every page says who's signed in.
- FINDINGS w7 (DEC-821..828): mandate file MOSTLY CLOSED -- ~20 of ~25
  grepped lines already built. Plan from the TREE; a mandate line has
  a shelf life. A predicate shared server-side is half a rule: the
  number a page PRINTS must share the query's arithmetic. A saved
  thing saves what varies -- a name without its recipe is a bookmark.
  A no-collision rule scopes to identity, not the whole seed -- don't
  empty the demo. A public surface switched off is an intentional
  blank, not a 404 on someone else's site. Auto-distribute owes the
  work it could NOT do. Two chips answering one question are one chip
  with a count; optional score renders its absence or reads as zero;
  reserve migration numbers in the DEC when two waves are in flight.
- FINDINGS w8 (DEC-829..836): mandate list now MOSTLY STALE -- of ~30 open
  lines grepped, ~22 were already built (grid clipping, results blended
  column, anonymity ratchet, new-event modal, builder copy, filter rules,
  password CTA, People/Settings rail). Grep the anchor line before
  tasking; a probe finding expires. A filter option that can only return
  zero rows means the LISTING predicate is wrong, not the filter. Listing
  and expanding are different questions -- one predicate cannot answer
  both. A design sentence that contradicts a load-bearing invariant loses
  its mechanism, keeps its layout. A state whose write unpublishes someone
  must SAY so at the moment of choice. What the composer shows is what it
  sends. A send is auditable to its WORDS, not just its count. Identical
  labels at an irreversible choice are not labels. A day pill is
  navigation; a seed no grader can see a feature through fails a read.
