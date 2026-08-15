# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email;
  authz every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE
  shape+count*+id asc; atomic SQL > read-then-write; uniqueIndex CONTRACT;
  MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-24 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field/write caps unified; contact merge, CSRF
  exemption, bulk-email dedupe, table-layout, mail-shell lang, sub-pixel
  geometry, role="cell" wraps not replaces, bleed-vs-clamp, citations must
  quote, phone label from CELL not position, aria-invalid all FieldControl
  branches, FIELD ORGANISER WRITES THAT NO SURFACE READS (DEC-340/346/967/
  317/902/989/890/603/830/930/785/874/730/993/976/937/124/986). TOOL TRAP:
  Grep -C drops some `/`. Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. A
  LINE NUMBER IS NOT AN IDENTITY. A RULING WITH NO SCAN DRIFTS BACK. SHARED
  VOCABULARY CLASS != WIDTH HOOK. FRACTION IS SIGNATURE OF A FIT. REF LIST
  IS A SNAPSHOT. FULL BLEED IS A POSITION NOT MARGIN.
- FINDINGS w25 (main `39ac22d0`): MANDATE WAS MEASURED ALL ALONG. w18-24
  closed none of task-w9-d's 9, spent 5 lanes on already-fixed defects.
  Shape: A CODE READ INVENTS DEFECTS; A GATE FINDS THEM. Read newest
  verification-log DETAIL before newest prose. AN INSTRUMENT THAT CRIES
  WOLF IS A BROKEN GATE (DEC-620): scrollHeight>clientHeight isn't a clip
  unless something clips. DISABLED IS A STATE, NOT A LOOK (DEC-436):
  exemption earned by disabled/aria-disabled in the tree, never a class
  name. A CLAIM WITHOUT A QUOTED LINE IS A RUMOUR (DEC-976): brief must
  quote the source line; unreproducible => CLOSED-AT-TIP. Verification-log
  filenames repeat across campaigns — suffix the measured sha, never
  overwrite (DEC-129).
- FINDINGS w26 (main `7d15cff2` = merge task-w25-b; w25-a `de3455af`
  unmerged; w25-c/d/e refs == base `7378401d` yet w25-e's log section is
  already in the tree — a lane can be mid-merge while a planner reads).
  THE RED TEST WAS THE MANDATE: `test/spa-mutation-contract.scan.test.ts`
  (:560 `expect(gaps).toEqual([])`) has FAILED since w16 — POST
  /api/v1/users never reads the `firstName`/`lastName` PeopleRolesPanel
  :113-118 refuses to submit without. Nine waves of code-read defect hunts
  never opened the one test the suite already fails. Read the suite's own
  red before inventing a defect.
- A FAN-OUT OWNS ITS OWN CLEANUP (DEC-530 w26): `Promise.all` rejects on
  the first failure while its siblings finish — a put phase outside the
  rollback try leaks every object that succeeded.
- TWO FLAGS ARE ORTHOGONAL OR THEY ARE ONE FLAG (DEC-009 w26): reading a
  domain result field only inside another field's branch silently deletes
  a case the domain function was written to express.
- KV IS NOT A PURGE BUS (DEC-083 w26): `kv.get`'s edge cacheTtl floor is
  60s, so "instant purge" is a claim no Workers KV read can keep. State
  the bound; give the signed-in viewer an uncached render instead.
- A GATE INSIDE A CODE WAVE IS DIAGNOSTIC (DEC-069 w26): the exit
  predicate voids on any later merge, so it is read in a wave that lands
  no code. Wave 27 is that wave.
