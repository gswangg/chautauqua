# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-21 (DEC-002..920, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; rows graded from ENUMERATION never sample; pagination ONE
  shape+count*+`id asc`; atomic SQL beats read-then-write; hand-listed
  manifests/vocab desync -- ENUMERATE/IMPORT; uniqueIndex CONTRACT;
  negation skips NULLs; merge a SET showing EVERY differing field;
  irreversible action a PAGE naming what goes AND what it refuses; publish
  the WINDOW not a flag; decision with no code a LIE; seed satisfies every
  read; mandate file a HYPOTHESIS -- grep before tasking, verify twice, the
  tree MOVES WHILE YOU PLAN; every page says who's signed in. Shared
  predicate matches printed number to query arithmetic; a "frozen" column
  is dead only if NOTHING writes it. Unpublish/narrow/unschedule SAYS so;
  a link is the route it LANDS on, names the FILE not a generic word;
  error shape follows the REQUEST's route; submitted blank CLEARS, absent
  key is silence; list+export read status through ONE reader; main can be
  RED — grep `<<<<<<<` every wave. A gate must not render children while
  identity loads. A promised column needs controls on EVERY row; two save
  paths for one row is one too many. Pills that clear each other are a
  radio group in a toggle's clothes. A per-row/per-kind count re-scanning
  per row is N scans (even wearing Promise.all) — one grouped query. An
  identity from a supplied email must never be ECHOED. Blank is ABSENT for
  EVERY kind. A role read off a USER is null for a row with no user. A
  disabled input must look disabled. A toggle needing a companion choice
  REVEALS it and WAITS. An absent image is a DRAWN placeholder. A
  deterministic TIE-BREAK answers "which row" but not "which of your
  talks" — when data admits two, ASK. A timeline the data already implies
  needs a UNION not a migration. Number() parses "1e999" as Infinity,
  lands null in a REQUIRED column. A gate skipped for one content type is
  not a gate. Nine date complaints on six pages are one formatter, never
  the docstring. A page's actions belong to its title row. A prop that
  renders nothing is a decision callers still believe in — delete it.
  Three surfaces answering "narrow this list" differently are three
  products. An onChange that writes to server races its own reload — a
  row is a DRAFT until Save. Mandate files w19-21 mostly ALREADY CLOSED.
- FINDINGS w22 (DEC-921..925): mandate file archaeology — every headline
  item probed was ALREADY CLOSED. A cascade comment claiming "everything
  it owns" is a claim to CHECK against the table list; deleting a row
  another table merely POINTS AT is a 409 with no way back; a join row
  keyed on (task, contact) is not owned by the file that completed it —
  reopen, don't delete. One BOUNDARY should be the sole author of a
  logged event. Six copies of one ternary is how the seventh gets it wrong.
- FINDINGS w23 (DEC-926..930): both mandate files now pure archaeology --
  ~12 headline items reprobed, all CLOSED. Work comes from READING deletes,
  vocabularies, per-row awaits. A delete that repoints comments must
  repoint every OTHER pointer at that row -- a resolver that THROWS on a
  missing row turns a cheap orphan into a permanent 500 elsewhere. A batch
  reader omitting the one column its caller needs re-introduces the N
  queries it claims to avoid. `x as Input["k"]` at a call site hides a
  value the server already accepts behind a hand-listed client vocabulary.
  A confirm dialog with no BODY names nothing -- check the dialog next to
  it. Every new /api/v1 route lands in src/routes/docs.tsx.
