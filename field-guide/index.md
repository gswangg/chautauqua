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
  failure branch dead code; a doc comment saying "caller only passes rows it
  owns" is the check living outside the query -- put it in the WHERE; Intl
  with `undefined` locale differs per reader; the scrim IS the dialog.
- FINDINGS w29-31 (DEC-965..982, compacted): mandate files list items already
  CLOSED -- read the CODE, tree MOVES WHILE YOU PLAN. A COUNT is not an
  IDENTITY: "v"+chain-length renumbers survivors after a middle delete. Two
  roots of one kind are two documents not two versions. A class the
  stylesheet defines and no markup uses is the token-defect in reverse --
  scan BOTH directions. role="menu" with only Escape is a list of buttons.
  A per-event value passed as a string LITERAL is invisible to a grep for
  its OUTPUT -- scan the CALL. Hide a transitive fixed point STRUCTURALLY,
  never by deleting the trigger's answer. A read gate needs a write
  counterpart. A speaker who DECLINED still clashes if one query forgot the
  invite filter. A JOIN row cascades on contact delete; only a row losing a
  document may refuse. A value settable once and never editable is half a
  feature. The active-participant predicate must reach data that LEAVES the
  product (Airtable). A grid class shared by two components is a CELL COUNT
  contract.
- FINDINGS w32 (DEC-983..987): the tree MOVED mid-plan -- a grep that says
  "no matches" at minute 5 is a fact about minute 5, not about main;
  re-probe before concluding a task never landed. The richest seam of
  verified-open work is the codebase's OWN confessions: an
  ALLOWED/EXCLUDED/LEGACY entry reading "pre-existing gap, flagged for
  follow-up" is a defect with a comment -- four such lists were on main. A
  predicate applied HALF (visible with no invite_status) is worse than
  none -- it looks filtered. A state the server 409s on must be READABLE
  on the route that renders the form, or the gate lives only until reload.
  An exclusion list is a promise about a route's nature, never a parking
  space: GET / -- the biggest new public surface -- had never been
  render-swept because a task-scope note became a permanent entry.
