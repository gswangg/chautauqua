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
- FINDINGS w7-14 (DEC-821..869, compacted): mandate/probe findings
  EXPIRE, re-grep the anchor before tasking. Shared predicate matches
  printed number to query arithmetic; a "frozen legacy" column is
  only dead if NOTHING writes it, scan other storage by identifier.
  Unpublish/narrow/unschedule SAYS so at the moment of choice; a
  link is the route it LANDS on; error shape follows the REQUEST's
  route; submitted blank CLEARS, absent key is silence; list+export
  read status through ONE reader; main can be RED — grep `<<<<<<<`
  every wave. Hand-listed vocab/knob tables DESYNC — read ONE
  enumerated set. A gate must not render children while identity
  loads; identity via the DETECTOR's normalized form not raw ===. A
  promised column needs controls on EVERY row; two save paths for
  one row is one too many. Pills that clear each other are a radio
  group in a toggle's clothes; two filter axes each name their axis.
  A confirmation names both the reference AND the emailed address; a
  harness login in a product placeholder leaks the test. A per-row
  count re-scanning per row is N scans — one pass; a role column
  only AUTH reads is not authz, list and count share ONE
  where-builder. An identity resolved from a supplied email must
  never be ECHOED. Blank is ABSENT for EVERY kind; `ne` never fires
  on an absent trigger. A filter row states its conjunction, counts
  N of M via one activeRules() reader. A states menu marks the one
  in force (aria-checked, not CSS class).
- FINDINGS w15 (DEC-870..876): a FRAGMENT returned into a CSS grid
  donates its extra child as a grid ITEM — wrap the main column. A
  `<td>` with display:flex stops being a cell. A role read off a
  USER is null for a row with no user, never a sentinel string;
  "You" is an ID match not a name match. Print a blend with the
  SAME pure function the server aggregates with. A control that
  can't save a partial score isn't a "draft". One plan lands IN it.
- FINDINGS w16 (DEC-877..882): the mandate is a HYPOTHESIS with a
  half-life — six candidate lines this wave were ALREADY CLOSED in
  code (blank-clears, SSR html errors, list/export status parity,
  narrowed-window warning, /schedule search box, merge name case).
  Re-grep the anchor or waste a lane. A shared token is only adopted
  where a page APPLIES it: a defined token nobody wraps clamps
  nothing, and a header/content that clamp differently read as two
  documents. A reset landing after a family's modifiers DELETES the
  family — scope a reset to the properties it means. A count's LABEL
  is a claim about its WHERE clause: "N re-uploaded" filtered on
  changes_requested counts the opposite. A disabled input is not a
  read-only row; a status picker is not a decision.
