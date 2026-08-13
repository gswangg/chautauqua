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
- FINDINGS w7-16 (DEC-821..882, compacted): mandate/probe findings
  EXPIRE, re-grep before tasking (six w16 lines were ALREADY CLOSED).
  Shared predicate matches printed number to query arithmetic; a
  "frozen" column is dead only if NOTHING writes it. Unpublish/
  narrow/unschedule SAYS so at the moment of choice; a link is the
  route it LANDS on; error shape follows the REQUEST's route;
  submitted blank CLEARS, absent key is silence; list+export read
  status through ONE reader; main can be RED — grep `<<<<<<<` every
  wave. Hand-listed vocab tables DESYNC — read ONE enumerated set. A
  gate must not render children while identity loads. A promised
  column needs controls on EVERY row; two save paths for one row is
  one too many. Pills that clear each other are a radio group in a
  toggle's clothes; two filter axes each name their axis. A per-row
  count re-scanning per row is N scans — one pass; list and count
  share ONE where-builder. An identity from a supplied email must
  never be ECHOED. Blank is ABSENT for EVERY kind. A FRAGMENT
  returned into a CSS grid donates its extra child as a grid ITEM.
  A role read off a USER is null for a row with no user. Print a
  blend with the SAME pure function the server aggregates with. A
  shared token is only adopted where a page APPLIES it. A reset
  lands scoped to the properties it means, never a whole family. A
  count's LABEL is a claim about its WHERE clause. A disabled input
  is not read-only; a status picker is not a decision.
- FINDINGS w17 (DEC-883..890): the tree MOVES WHILE YOU PLAN — a file
  re-read minutes later already carried the fix. Verify twice before
  re-tasking; a missing DEC marker is not proof of a missing fix. A
  toggle needing a companion choice must REVEAL the choice and WAIT
  — firing on the toggle makes the feature's first act a 400. A
  shared class is shareable only where every member wants every
  DECLARATION: a lowercase wordmark on an event name renames the
  customer's event. auto-fill with a small minmax floor is a phone
  rule that never stops applying — desktop columns are COUNTED. An
  absent image is a DRAWN placeholder; an empty box reads as
  failure. An irreversible action is a PAGE naming what goes AND
  what it refuses; another's recorded judgment is never the
  organizer's to erase. A prop with one call site is a setting
  nobody sets. "Last used" comes from the log via ONE grouped query,
  never a new column, never a query per row.
