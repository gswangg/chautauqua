# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-31 (DEC-002..982, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; rows graded from ENUMERATION never sample; pagination ONE
  shape+count*+`id asc`; atomic SQL beats read-then-write; hand-listed
  manifests desync -- ENUMERATE/IMPORT; uniqueIndex CONTRACT; negation skips
  NULLs; merge a SET showing EVERY differing field; irreversible action a PAGE
  naming what goes AND what it refuses; publish the WINDOW not a flag;
  decision with no code a LIE; mandate file a HYPOTHESIS -- tree MOVES WHILE
  YOU PLAN; every page says who's signed in; submitted blank CLEARS, absent
  key is silence; main can be RED -- grep `<<<<<<<` every wave; a gate must
  not render children while identity loads; a per-row count is N scans --
  one grouped query; blank is ABSENT for EVERY kind; a row is a DRAFT until
  Save; a CREATE-time expansion is a snapshot -- BACK-FILL every activation
  path; undefined var(--chq-*) resolves TRANSPARENT; the scrim IS the
  dialog; two roots of one kind are two documents not two versions; a JOIN
  row cascades on contact delete, only a row losing a document may refuse;
  a grid class shared by two components is a CELL COUNT contract.
- FINDINGS w32-36 (DEC-983..999; 001-999 FULL, decisions/README.md permits
  DEC-1000+): a grep saying "no matches" is a fact about that minute, not
  main -- re-probe (overview.ts gained its invite filter BETWEEN two greps
  in one session). Codebase's OWN confessions ("pre-existing gap") are
  defects with comments; a predicate applied HALF is worse than none; an
  exclusion list's REASON can expire (page-measure NAMED_EXEMPTIONS parked
  MergePage.tsx after its rebuild shipped in DEC-992). Mandate open lists
  age fast (~90% stale by w34) -- MINE THE CODE, twice. A DEFERRAL IS A
  DATED PROMISE: DEC-970 postponed CSS reverse-direction only until DEC-968
  landed, and it landed, yet .chq-auth-hint stayed unmarked -- grep
  decisions for "not this wave" and check if the lane landed.
- FINDINGS w37 (no new DEC -- 001-999 ALL exist and the planner schema pins
  DEC-\d{3}; successor rule now lands in decisions/README.md: a new ruling is
  an `## Amendment (wave N)` section on the nearest existing DEC, the DEC-004
  precedent -- never a new file, never an overwrite): a decision can land on
  ONE PACKAGE and read as done. DEC-989's width system reached app/src and
  stopped at the src/ boundary -- main.chq-pub-main clamps NOTHING, and the
  public sessions pair the decision names by name (820+34+300) spreads to the
  monitor. Ask of every cross-cutting decision: WHICH PACKAGE did it reach?
  A TOKEN declared and consumed by nobody is the same lie as a rule no markup
  uses (theme.ts held --chq-measure-table for no one). And TRUST FLOWS ONE
  WAY: the organizer's add-participant wrote 'invited' (inactive until
  accepted) while the SPEAKER-supplied co-presenter path wrote 'none'
  (ACTIVE). When an untrusted path is MORE permissive than the trusted one,
  the defect is in the WRITE -- and the invite scan on main only reads reads.
