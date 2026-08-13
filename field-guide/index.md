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
  radio group in a toggle's clothes. A per-row/per-kind count is N scans
  even wearing Promise.all — one grouped query. An identity from a
  supplied email must never be ECHOED. Blank is ABSENT for EVERY kind. A
  disabled input must look disabled. A toggle needing a companion choice
  REVEALS it and WAITS. An absent image is a DRAWN placeholder. Number()
  parses "1e999" as Infinity, lands null in a REQUIRED column. A gate
  skipped for one content type is not a gate. A page's actions belong to
  its title row. A prop that renders nothing is a decision callers still
  believe in — delete it. An onChange that writes to server races its own
  reload — a row is a DRAFT until Save. Mandate files are pure
  archaeology (~30 headline items reprobed across w22-24, all CLOSED): a
  cascade comment claiming "everything it owns" is a claim to CHECK; a
  batch reader omitting one column re-introduces the N queries it avoids;
  a confirm dialog with no BODY names nothing; every /api/v1 route lands
  in docs.tsx; a 409 naming a CLASS is a dead end -- name the ROWS; an
  expansion at CREATE time is a snapshot -- BACK-FILL every activation
  path; `order by id asc limit 1` in a correlated subquery is a rejected
  tie-break -- ASK when data admits two.
- FINDINGS w25 (DEC-937..943): wave 24 branches existed but had NOT merged --
  ALWAYS check .git/refs/heads before re-tasking a prior wave's decisions; a
  decision doc + field-guide entry land at PLAN time, code lands later. Mandate
  archaeology 4 waves running (12 more items reprobed, all CLOSED). A token
  nothing defines resolves TRANSPARENT, silently -- scan every var(--chq-*) for
  a definition. A <button> with no font-family is Arial next to your type. A
  regression test can ENSHRINE the defect: assert the OUTCOME the user sees,
  never the reset's contents (3rd collision on one rule). Quieting is a COLOUR
  substitution -- opacity fades the TEXT too and eats the AA margin. Two class
  families on ONE element = a cascade race the later rule always wins. A single-
  select scale is a radio group, NOT aria-pressed -- refuse-with-reason in a DEC
  so it stops being re-filed. A delete with no dialog is five deletes with no
  dialog: scan the call sites, name the exemptions. A branch of code the seed
  never reaches has never rendered. Scores from one counter mod N rank by coin
  flip.
