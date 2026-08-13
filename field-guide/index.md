# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-24 (DEC-002..936, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; rows graded from ENUMERATION never sample; pagination ONE
  shape+count*+`id asc`; atomic SQL beats read-then-write; hand-listed
  manifests desync -- ENUMERATE/IMPORT; uniqueIndex CONTRACT; negation skips
  NULLs; merge a SET showing EVERY differing field; irreversible action a PAGE
  naming what goes AND what it refuses; publish the WINDOW not a flag;
  decision with no code a LIE; mandate file a HYPOTHESIS -- tree MOVES WHILE
  YOU PLAN; every page says who's signed in; a link is the route it LANDS on;
  error shape follows the REQUEST's route; submitted blank CLEARS, absent key
  is silence; main can be RED -- grep `<<<<<<<` every wave; a gate must not
  render children while identity loads; two save paths for one row is one
  too many; a per-row count is N scans under Promise.all -- one grouped
  query; a supplied email must never be ECHOED; blank is ABSENT for EVERY
  kind; Number() parses "1e999" as Infinity into a REQUIRED column; a row is
  a DRAFT until Save; a CREATE-time expansion is a snapshot -- BACK-FILL
  every activation path.
- FINDINGS w25-28 (DEC-937..964, compacted): a ref that EXISTS may be MERGED
  -- read the CODE, undefined var(--chq-*) resolves TRANSPARENT; two class
  families on ONE element = later rule wins; a delete with no dialog is five
  deletes with no dialog; a cron swallowing per-item failures makes the
  failure branch dead code; a doc comment saying "the caller only passes
  rows it owns" is the check living outside the query -- put it in the
  WHERE; Intl with `undefined` locale differs per reader; the scrim IS the
  dialog -- ban the ELEMENT PAIR.
- FINDINGS w29-30 (DEC-965..978, compacted): mandate files list items already
  CLOSED -- read the CODE. A COUNT is not an IDENTITY: "v"+chain-length
  renumbers survivors after a middle delete. Two roots of one kind are two
  documents not two versions. A class the stylesheet defines and no markup
  uses is the token-defect in reverse -- scan BOTH directions, incl. SSR
  stylesheets. role="menu" with only Escape is a list of buttons: outside
  press, roving arrows and focus return ARE the menu. A per-event value
  passed as a string LITERAL is invisible to a grep for its OUTPUT -- scan
  the CALL. A transitive fixed point that hides by DELETING the trigger's
  answer is wrong when the absence is a real value -- hide it STRUCTURALLY.
  A read gate with no write counterpart lets you delete a row you cannot
  list. A speaker who DECLINED still clashes if one query forgot the invite
  filter. A scan proving the stylesheet is one direction of two.
- FINDINGS w31 (DEC-979..982): ~25 mandate probes, ~4 still open -- the list
  is a HYPOTHESIS, the code is the fact; find defects by READING. A refusal
  that says "remove them from those tasks first" is a dead end when nothing
  can remove one: a JOIN row (task_assignment, pipeline_entry) cascades with
  its contact and the dialog NAMES it; only a row that would leave a document
  orphaned may refuse. A value settable once and never editable is half a
  feature -- and the edit needs its own write: a same-stage PATCH that calls
  the mover forges a history row and resets the clock that history feeds. The
  one active-participant predicate must reach the data that LEAVES the product
  (Airtable) -- and an unordered join string re-writes an unchanged row on
  every sync. A grid class shared by two components is a contract on CELL
  COUNT: 8 cells in a 5-column template wrap silently, because the markup and
  the grid live in different files and neither looks wrong alone.
