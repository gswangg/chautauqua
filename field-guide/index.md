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
- FINDINGS w25-31 (DEC-937..982, heavily compacted): a ref that EXISTS may be
  MERGED -- read the CODE; undefined var(--chq-*) resolves TRANSPARENT; two
  class families on ONE element = later rule wins; a cron swallowing
  per-item failures makes the failure branch dead code; the scrim IS the
  dialog; a COUNT is not an IDENTITY; two roots of one kind are two
  documents not two versions; scan BOTH directions for dead classes;
  role="menu" with only Escape is a list of buttons; hide a transitive
  fixed point STRUCTURALLY; a read gate needs a write counterpart; a JOIN
  row cascades on contact delete, only a row losing a document may refuse;
  a value settable once and never editable is half a feature; a grid class
  shared by two components is a CELL COUNT contract.
- FINDINGS w32 (DEC-983..987): the tree MOVED mid-plan -- a grep that says
  "no matches" at minute 5 is a fact about minute 5, not main; re-probe
  before concluding a task never landed. The richest seam of verified-open
  work is the codebase's OWN confessions: an ALLOWED/EXCLUDED/LEGACY entry
  reading "pre-existing gap, flagged for follow-up" is a defect with a
  comment. A predicate applied HALF is worse than none -- it looks
  filtered. A state the server 409s on must be READABLE on the route that
  renders the form. An exclusion list is a promise about a route's nature,
  never a parking space.
- FINDINGS w33 (DEC-988..993): a mandate file's OPEN list ages faster than
  the code -- ~15 named items probed, EVERY ONE already closed; real open
  work came from the design pack and dead round trips. An ENDPOINT with a
  tested payload builder and no caller is a feature the product renders and
  cannot set -- grep build*Payload helpers for a non-test importer. A
  design pack that SUPERSEDES a decision leaves the old decision's TEST
  standing: page-measure asserted 820-everywhere while v6 specified four
  classes. A container class belongs to the CONTENT, so it is a class on
  the page root, not a clamp re-declared per stylesheet. Two vocabularies
  in one constant (route surfaces AND nav surfaces) is one rename from a
  nav item nobody can reach -- derive the narrower list. Exception lists
  generalise: render-sweep's clip map carried eight "owned by another
  in-flight branch" entries from waves long merged.
