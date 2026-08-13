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
  decision with no code a LIE; seed satisfies every read; mandate file a
  HYPOTHESIS -- tree MOVES WHILE YOU PLAN; every page says who's signed in; a
  link is the route it LANDS on; error shape follows the REQUEST's route;
  submitted blank CLEARS, absent key is silence; main can be RED -- grep
  `<<<<<<<` every wave; a gate must not render children while identity loads;
  two save paths for one row is one too many; pills that clear each other are
  a radio group in a toggle's clothes; a per-row count is N scans under
  Promise.all -- one grouped query; a supplied email must never be ECHOED;
  blank is ABSENT for EVERY kind; a disabled input must look disabled;
  REVEALS+WAITS for a companion choice; Number() parses "1e999" as Infinity
  into a REQUIRED column; a prop rendering nothing is a decision callers
  believe -- delete it; a row is a DRAFT until Save; a CREATE-time expansion
  is a snapshot -- BACK-FILL every activation path.
- FINDINGS w25-27 (DEC-937..958, compacted): check .git/refs/heads before re-
  tasking, but a ref that still EXISTS may already be MERGED -- read the CODE.
  Undefined var(--chq-*) resolves TRANSPARENT. Regression tests ENSHRINE
  defects -- assert the OUTCOME. Two class families on ONE element = later
  rule wins. A single-select scale is a radio group NOT aria-pressed. A delete
  with no dialog is five deletes with no dialog. A cron catching per-item
  failures and never rethrowing makes the failure branch dead code -- isolate
  AND aggregate. Read-modify-write against eventually-consistent store is a
  suggestion not a limit. A credential in an audit log stays a credential. A
  hardcoded `.local` address is a shipped placeholder. The last asterisk is on
  the page strangers see first. A shell with `<main>` and no `<h1>` is a page
  with no name; promoting a heading changes its SIZE -- pin the class first.
  Two predicates for one fact disagree once computed only under a toggle. A
  banner reading "blocked" over an enabled button is a suggestion. A chip
  offered on step 2 whose gate lives on step 3 is a trap. A scan banning a
  MISSING className cannot see a WRONG one -- ban the retired token by name,
  token-exact. A helper stopping at the app/ boundary says "session(s)" --
  name the crossing; a 409 that counts rows still refuses to name them.
- FINDINGS w28 (DEC-959..964): docs/eval-findings.md is a HYPOTHESIS -- a
  dozen of its named-open items were already CLOSED on main this wave; verify
  EVERY item against the tree before scheduling one. A mock's sample DATA is
  spec too: three row kinds, three sample metas, not one grammar borrowed
  twice. Two names for one grammar is one too many. A doc comment saying "the
  caller only passes rows it owns" is the ownership check living outside the
  query -- put it in the WHERE. Intl with an `undefined` locale is a different
  string per reader; a test recomputing `expected` from the implementation can
  never catch it. The scrim IS the dialog: ban the ELEMENT PAIR so a phone
  sheet that puts the role inside survives. A row inside a group prints what
  DIFFERS, and the identifying column gets the width. A terminal page with no
  links is worse than one with a wrong link.
