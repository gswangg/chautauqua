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
  route; submitted blank CLEARS, absent key is silence; main can be RED --
  grep `<<<<<<<` every wave; a gate must not render children while
  identity loads; two save paths for one row is one too many; pills that
  clear each other are a radio group in a toggle's clothes; a per-row/
  per-kind count is N scans even under Promise.all -- one grouped query; a
  supplied email must never be ECHOED; blank is ABSENT for EVERY kind; a
  disabled input must look disabled; a toggle needing a companion choice
  REVEALS it and WAITS; Number() parses "1e999" as Infinity, lands null in
  a REQUIRED column; a prop rendering nothing is a decision callers still
  believe -- delete it; an onChange races its own reload -- a row is a
  DRAFT until Save; a cascade comment claiming "everything it owns" is a
  claim to CHECK; an expansion at CREATE time is a snapshot -- BACK-FILL
  every activation path.
- FINDINGS w25-26 (DEC-937..951, compacted): check .git/refs/heads before
  re-tasking; a decision doc on main proves a PLAN, never code. Undefined
  var(--chq-*) resolves TRANSPARENT. Regression tests ENSHRINE defects --
  assert the OUTCOME. Two class families on ONE element = later rule wins.
  A single-select scale is a radio group NOT aria-pressed. A delete with
  no dialog is five deletes with no dialog. A cron catching per-item
  failures and never rethrowing makes the failure branch dead code --
  isolate AND aggregate. Read-modify-write against an eventually-
  consistent store is a suggestion not a limit. A credential in an audit
  log stays a credential -- mint, revoke, redact on disclosure. A
  hardcoded `.local` address is a shipped placeholder: one policy
  boundary governs every consumer. The last asterisk is on the page
  strangers see first.
- FINDINGS w27 (DEC-952..958): a branch ref that still EXISTS may already be
  MERGED -- read the CODE, not `.git/refs`. A shell with `<main>` and no
  `<h1>` is a page with no name. Promoting a heading changes its SIZE: pin
  the class before you change the tag. Two predicates for one fact
  (`scheduled` vs "has an ics") disagree once one is computed only under a
  toggle, and a rejected refetch leaves the OLD answer on screen. A banner
  reading "Send blocked" over an enabled button is a suggestion. A chip
  offered on step 2 whose server gate lives on step 3 is a trap: reveal
  the companion where the chip is, or don't offer it. A scan that bans a
  MISSING className cannot see a WRONG one -- ban the retired token by
  name, token-exact so a sibling class survives. A helper that stops at
  the app/ boundary leaves the server saying "session(s)" in an email --
  name the crossing (DEC-660's shape). A 409 that counts rows still refuses
  to name them.
