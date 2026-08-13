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
  YOU PLAN; every page says who's signed in; error shape follows the
  REQUEST's route; submitted blank CLEARS, absent key is silence; main can
  be RED -- grep `<<<<<<<` every wave; a gate must not render children
  while identity loads; two save paths for one row is one too many; a
  per-row count is N scans -- one grouped query; a supplied email must
  never be ECHOED; blank is ABSENT for EVERY kind; Number() parses "1e999"
  as Infinity into a REQUIRED column; a row is a DRAFT until Save; a
  CREATE-time expansion is a snapshot -- BACK-FILL every activation path.
- FINDINGS w25-31 (DEC-937..982, heavily compacted): a ref that EXISTS may be
  MERGED -- read the CODE; undefined var(--chq-*) resolves TRANSPARENT; two
  class families on ONE element = later rule wins; a cron swallowing
  per-item failures makes the failure branch dead code; the scrim IS the
  dialog; a COUNT is not an IDENTITY; two roots of one kind are two
  documents not two versions; scan BOTH directions for dead classes;
  role="menu" with only Escape is a list of buttons; a read gate needs a
  write counterpart; a JOIN row cascades on contact delete, only a row
  losing a document may refuse; a value settable once and never editable
  is half a feature; a grid class shared by two components is a CELL COUNT
  contract.
- FINDINGS w32 (DEC-983..987, compacted): the tree MOVED mid-plan -- a grep
  that says "no matches" at minute 5 is a fact about minute 5, not main;
  re-probe before concluding a task never landed. The richest seam is the
  codebase's OWN confessions: an ALLOWED/EXCLUDED/LEGACY entry reading
  "pre-existing gap" is a defect with a comment. A predicate applied HALF
  is worse than none. A state the server 409s on must be READABLE on the
  route that renders the form. An exclusion list is a promise about a
  route's nature, never a parking space.
- FINDINGS w33 (DEC-988..993, compacted): mandate OPEN lists age faster than
  code. A tested payload builder with no caller is a feature the product
  can't set. A design pack that SUPERSEDES a decision can leave the old
  decision's TEST standing. A container class belongs to the CONTENT (page
  root), not re-declared per stylesheet. Two vocabularies in one constant
  is one rename from an unreachable nav item.
- FINDINGS w34 (DEC-994..999): mandate's open list ~90% STALE -- of ~20
  named items probed, only two were open (Content click-depth, public
  agenda blocks); rest already built. Stop mining the mandate; mine the
  CODE. Richest seam: a defect spelled the SAME WAY in N places
  (`obj.contentType ?? dbColumn` x5 serve paths, a hand-written session
  insert x3) -- delete the SHAPE that supplies the wrong value (drop the
  field from the store's return type) so the compiler removes the other
  N-1, not a per-site fix. A self-typed binding is a compile-time lie:
  env.ts declaring its OWN interface for a platform binding makes a wrong
  call site typecheck forever.
