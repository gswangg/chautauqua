# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-19 (DEC-002..907, heavily compacted): pure-core
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
  a link is the route it LANDS on; error shape follows the REQUEST's
  route; submitted blank CLEARS, absent key is silence; list+export read
  status through ONE reader; main can be RED — grep `<<<<<<<` every wave.
  A gate must not render children while identity loads. A promised column
  needs controls on EVERY row; two save paths for one row is one too many.
  Pills that clear each other are a radio group in a toggle's clothes. A
  per-row/per-kind count re-scanning per row is N scans (even wearing a
  Promise.all) — one grouped query. An identity from a supplied email must
  never be ECHOED. Blank is ABSENT for EVERY kind. A role read off a USER
  is null for a row with no user. A disabled input must look disabled; a
  status picker is not a decision. A toggle needing a companion choice
  REVEALS it and WAITS. An absent image is a DRAWN placeholder. A
  deterministic TIE-BREAK answers "which row" but not "which of your
  talks" — when data admits two, ASK. A timeline the data already
  implies needs a UNION not a migration; a fact stored twice drifts.
  Number() parses JS literals: "1e999" is Infinity, lands null in a
  REQUIRED column. A gate skipped for one content type is not a gate. A
  generalisation already computed and thrown away is the cheapest fix in
  the tree. A caption for a checkbox is a silent decision. Nine date
  complaints on six pages are one toLocaleDateString. A page's actions
  belong to its title row.
- FINDINGS w20 (DEC-908..914, compacted): mostly ALREADY CLOSED — grep
  before tasking. Open items: section order wrong though sections right;
  count as negation over open set; c.text 404s beside a designed sibling;
  flag gated on wrong checkbox; N requests for N numbers on one filtered
  set; link label/href naming different routes. Asterisk is a legend the
  page never prints — say "· optional". A fact stated twice will drift —
  delete one. A back-link string per page drifts — use one table.
- FINDINGS w21 (DEC-915..920): ~28 of ~30 mandate items ALREADY CLOSED —
  mandate file is mostly archaeology now; grep first, cite a line, drop
  otherwise. A prop that renders nothing is a decision callers still
  believe in — delete, don't document. A grammar fixed on one renderer
  gets fixed on its SIBLINGS same wave. A comment stating the output
  while code uses a different locale is a bug with an alibi — a scan
  test holds the formatter, not the docstring. Three surfaces answering
  "narrow this list" with pills/select/nothing are three products. An
  onChange that writes to the server writes N times and races its own
  reload — a row is a DRAFT until Save. A drilled edit view with no Done
  is a trap; check siblings' exit grammar first. A link saying "File" is
  a missing join wearing a noun.
