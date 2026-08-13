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
- FINDINGS w32-35 (DEC-983..999, 512; 001-999 now FULL -- decisions/README.md
  permits DEC-1000+ for the next mint): a grep saying "no matches" is a fact
  about that minute, not main -- re-probe. Codebase's OWN confessions
  ("pre-existing gap") are defects with comments; a predicate applied HALF
  is worse than none; an exclusion list is a promise about a route's
  nature, never a parking space, and its REASON can expire. Mandate open
  lists age fast (~90% stale by w34) -- mine the CODE. A defect spelled the
  SAME WAY in N places is fixed by deleting the SHAPE so the compiler
  removes the other N-1. A rule applied to N-1 of N query sites (invite-
  status filter) stayed absent from Overview's clash/lead-speaker reads and
  CRM speaker KPI. A fallback branch is a defect report: `?? user.email` is
  reached only because a create path never mints the name.
- FINDINGS w36 (no new DEC -- 001-999 ALL taken, planner schema pins
  DEC-\d{3}; decisions/README.md now permits DEC-1000+ for next mint): the
  MANDATE FILE IS NOT EVIDENCE -- ~30 more named items (520-card+404, Home
  hub states, saved-embed format/ON-OFF/Delete, per-person remind, content-
  note email, merge rebuild, Insert-a-field menu, Speakers List/Grid, seed
  required-flags, public search rows, published counts, useMenu keyboard,
  date-grammar/plural scans) probed against main -- every one CLOSED. Two
  waves running, same result: MINE THE CODE, and probe TWICE (overview.ts
  gained its invite filter BETWEEN two greps in one session). Open work now
  lives in: (a) a decision's own DEFERRAL whose stated reason expired --
  DEC-970 postponed the CSS reverse direction only until DEC-968 landed, and
  it landed; .chq-auth-hint still has no markup; (b) a scan exemption citing
  an in-flight branch -- page-measure NAMED_EXEMPTIONS still parked
  MergePage.tsx for a merge rebuild that shipped in DEC-992. A DEFERRAL IS A
  DATED PROMISE: grep decisions for "not this wave / another lane is fixing"
  and check whether the lane landed.
