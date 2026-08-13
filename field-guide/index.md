# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-24 (DEC-002..936, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; rows graded from ENUMERATION never sample; pagination ONE
  shape+count*+`id asc`; atomic SQL beats read-then-write; hand-listed
  manifests/vocab desync -- ENUMERATE/IMPORT; uniqueIndex CONTRACT;
  negation skips NULLs; merge a SET showing EVERY differing field;
  irreversible action a PAGE naming what goes AND what it refuses; publish
  the WINDOW not a flag; decision with no code a LIE; seed satisfies every
  read; mandate file a HYPOTHESIS -- tree MOVES WHILE YOU PLAN; every page
  says who's signed in; a "frozen" column is dead only if NOTHING writes
  it; a link is the route it LANDS on; error shape follows the REQUEST's
  route; submitted blank CLEARS, absent key is silence; main
  can be RED — grep `<<<<<<<` every wave; a gate must not render children
  while identity loads; two save paths for one row is one too many; pills
  that clear each other are a radio group in a toggle's clothes; a
  per-row/per-kind count is N scans even under Promise.all — one grouped
  query; a supplied email must never be ECHOED; blank is ABSENT for EVERY
  kind; a disabled input must look disabled; a toggle needing a companion
  choice REVEALS it and WAITS; Number() parses "1e999" as Infinity, lands
  null in a REQUIRED column; a gate skipped for one content type is not a
  gate; a prop that renders nothing is a decision callers still believe in —
  delete it; an onChange that writes to server races its own reload — a row
  is a DRAFT until Save. Mandate archaeology (~30 items w22-24, all CLOSED):
  a cascade comment claiming "everything it owns" is a claim to CHECK; a 409
  naming a CLASS is a dead end -- name the ROWS; an expansion at CREATE time
  is a snapshot -- BACK-FILL every activation path; `order by id asc limit
  1` in a correlated subquery is a rejected tie-break -- ASK when data
  admits two.
- FINDINGS w25 (DEC-937..943, compacted): check .git/refs/heads before
  re-tasking a prior wave -- decision doc lands at PLAN time, code later.
  Undefined var(--chq-*) resolves TRANSPARENT, silently. Regression tests
  ENSHRINE defects -- assert the OUTCOME not the reset's contents. Quieting
  via opacity fades text too, eats the AA margin. Two class families on ONE
  element = later rule always wins. A single-select scale is a radio group
  NOT aria-pressed -- refuse-with-reason in a DEC. A delete with no dialog
  is five deletes with no dialog. A branch the seed never reaches has never
  rendered.
- FINDINGS w26 (DEC-944..951): TEN branches unmerged at plan time --
  `.git/refs/heads` is the only truth; a decision doc on main proves a PLAN,
  never code; defects found by READING, not the findings file. A cron
  catching per-item failures and never rethrowing makes the caller's
  failure branch dead code -- isolate AND aggregate. Read-modify-write
  against an eventually-consistent store is a suggestion not a limit; the
  passing test has a strongly-consistent fake. A credential in an audit log
  stays a credential -- mint-with-revocation, redact on disclosure. A
  hardcoded `.local` address is a shipped placeholder: policy at one
  boundary (makeMailer) must govern every consumer. Keeping a replacement's
  function NAMES lets a call-site swap be one argument wide. The last
  asterisk in a product is on the page strangers see first. HAZARD:
  DEC-932's back-fill vs New-Task's "assign all accepted" CHECKBOX conflict
  -- w24 landing must reconcile or the checkbox lies at next acceptance.
