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
  conditional visibility a FIXED POINT; hand-copied vocab drifts --
  IMPORT it; uniqueIndex a CONTRACT; negation skips NULLs.
- FINDINGS w1-23 (DEC-570..771, compacted): full suites SERIALIZED;
  real <button> not `div draggable`; colour isn't identity -- NAME it;
  blank CSV cell ABSENT DATA; anonymity a RATCHET; merge a SET; raw id
  LABELS; cacheability DEFAULT+"own header wins"; irreversible action a
  PAGE; hub gives a row ONE action; grid cells POSITIONAL; person named
  by CONTACT; tab selection URL state; side effects ONE writer;
  sandboxed child origin "null"; tiers a PREDICATE; publish the WINDOW
  not a flag; decision with no code a LIE; seed satisfies every read;
  envelope KEYS fixed by route; seeded reviewer NAMED; task creation
  always expands; merge shows EVERY differing field; roster/expand-set
  ONE predicate; contact identity (org, lower(email)); author a PERSON
  never "Unknown"; rows grow not scroll; position re-derives from URL;
  `participant` ONLY contact-to-event link; armed CELL owns click;
  dying-on-reload control is decoration.
- FINDINGS w2-4 (DEC-772..800, compacted): mandate file a HYPOTHESIS/
  PROD SNAPSHOT -- grep the route before tasking, prod lags main. Count
  and its list ONE predicate over ONE set. Output format the rubric
  NAMES is a capability. Permanently disabled control: ship the route
  or drop it. Speaker reads EVENT tz. Control NAMES its state
  (Save/Saved). Filter a SET: rail composes, never replaces. Toggle
  with no public consequence is decoration. Distribute PREVIEW then
  apply, pure+deterministic. Role validated server-side, rendered a
  LABEL. Duplicate warned at CREATION. No raw ISO day. Merge
  vocabulary one SET: a seeded template whose tokens the send path
  rejects is a landmine -- parity is a test. Name the recipient the
  preflight rejected. Arming a control must not move the page. Default
  to the event in context; a legitimate repeat announces itself.
  Seeded log row shows what was SENT. Ratchet counts only promises
  actually made. Test isolation belongs to the harness, not the file.
- FINDINGS w5 (DEC-801..810): the tree MOVES under a planner --
  re-grep before every claim, never re-task an in-flight wave.
  docs/design/README.md is a REQUIREMENTS file, not decoration. A task
  cannot be late before it was assigned. A preview that reads only the
  discarded record hides the keeper's own labels; a strike means a
  value was really dropped. A card in a stage owes its age; a decline
  owes its reason. Render a control for every filter you apply and
  none you ignore. A status pill is not an invitation -- inviting is a
  send. A page must RESOLVE to its route or its tab never lights. A
  border that never rests splits one control in two. A token adopted
  server-side only is half a token; scan by ENUMERATION. A view
  re-saved under its own name is one view. Never invent a talk title.
