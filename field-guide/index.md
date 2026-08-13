# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1/REDESIGN/CLOSE + FINDINGS w1-6 (DEC-002..820, heavily compacted):
  pure-core imports no node:/cf; Hono sub-apps, errors
  {error:{code,message,fields?}}; bulk ops set-based; D1 binds
  PRIMITIVES; dates via event-time.ts OWNING EVENT's tz; rows graded
  from ENUMERATION never sample; pagination ONE shape+count*+`id asc`;
  atomic SQL beats read-then-write; hand-listed manifests/vocab desync
  -- ENUMERATE/IMPORT; uniqueIndex CONTRACT; negation skips NULLs;
  merge a SET showing EVERY differing field; irreversible action a
  PAGE; publish the WINDOW not a flag; decision with no code a LIE;
  seed satisfies every read; mandate file a HYPOTHESIS -- grep before
  tasking; every page says who's signed in.
- FINDINGS w7-11 (DEC-821..854, compacted): mandate/probe findings
  EXPIRE, re-grep the anchor before tasking. Shared predicate
  matches printed number to query arithmetic; switched-off public
  surface is intentional blank not 404; unpublish/narrow/unschedule
  SAYS so at the moment of choice; a link is the route it LANDS on.
  Error shape follows the REQUEST's route; submitted blank CLEARS,
  absent key is silence; list+export read status through ONE
  reader. main can be RED — grep `<<<<<<<` every wave. A hand-listed
  vocab/knob table per surface DESYNCS — read ONE enumerated set. A
  write that succeeds says what it did in its automated twin's
  vocabulary; a card that can only be MOVED does not say "place".
- FINDINGS w12-14 (DEC-855..869, compacted): a "frozen legacy"
  column is only dead if NOTHING writes it — scan other storage by
  identifier too. Preflight collects ALL misses, ONE message shape.
  A gate must not render children while identity loads; name
  identity via the DETECTOR's normalized form not raw ===; a
  promised column needs controls on EVERY row it affects. Two save
  paths for one row is one too many. Pills that clear each other are
  a radio group in a toggle's clothes; two filter axes each name
  their axis. A confirmation names both the reference AND the
  emailed address. A harness login in a product placeholder leaks
  the test. A per-row count re-scanning per row is N scans — one
  pass. A role column only AUTH reads is not authz; list and count
  share ONE where-builder. An identity resolved from a supplied
  email must never be ECHOED. Blank is ABSENT for EVERY kind; `ne`
  never fires on an absent trigger. A filter row states its
  conjunction, counts N of M via one activeRules() reader. A states
  menu marks the one in force (aria-checked, not CSS class).
- FINDINGS w15 (DEC-870..876): a component that returns a FRAGMENT
  into a CSS grid donates its extra child as a grid ITEM — wrap the
  main column or arming evicts the sidebar. A `<td>` with
  display:flex stops being a cell: per-column borders drift. A role
  read off a USER is null for a row with no user — never a sentinel
  string; "You" is an ID match, not a name match; one relative-time
  reader, not one per page. Print the blend with the SAME pure
  function the server aggregates with, never call a fail-loud
  aggregate on incomplete input. A control that cannot save a
  partial score is not a "draft" — name it for what it does. One
  plan means land IN it, not on a hub with no frame. A narrow list
  projection stays narrow: the body is a DETAIL read.
