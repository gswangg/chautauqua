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
- FINDINGS w32-34 (DEC-983..999, heavily compacted): a grep saying "no
  matches" is a fact about that minute, not main -- re-probe. Codebase's OWN
  confessions ("pre-existing gap") are defects with comments; a predicate
  applied HALF is worse than none; an exclusion list is a promise about a
  route's nature, never a parking space. Mandate open lists age fast (~90%
  stale by w34) -- mine the CODE. A defect spelled the SAME WAY in N places
  is fixed by deleting the SHAPE (drop the bad field from a return type) so
  the compiler removes the other N-1. A self-typed binding is a
  compile-time lie.
- FINDINGS w35 (DEC-512 -- the LAST free three-digit id; 001-999 are now
  full, so the next decision needs FOUR digits plus an edit to
  decisions/README.md's "three digits" rule): the mandate is SPENT. Thirty
  more named items probed (seed required-flags, --chq-sunk, armed-clash
  contrast, participation pill, scorecard measure, topCompanies, agenda
  ?day=, skip-row checkboxes, duplicate-at-create, accent colour, comms
  ICS/{feedback}, gallery toggle) -- every one already closed. Open work
  now comes only from reading code. Two seams paid: a rule applied to N-1
  of N query sites (the invite-status filter, fixed six times since w8,
  still absent from the Overview's clash + lead-speaker reads and the CRM
  speaker KPI) and an exemption whose REASON expired (a scan allow-list
  citing "an unmerged wave-24 branch" still guarded a one-click destroy).
  A fallback branch is a defect report: `?? user.email` is reached only
  because a create path never mints the name.
