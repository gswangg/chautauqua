# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-16 (DEC-002..882, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; rows graded from ENUMERATION never sample; pagination ONE
  shape+count*+`id asc`; atomic SQL beats read-then-write; hand-listed
  manifests/vocab desync -- ENUMERATE/IMPORT; uniqueIndex CONTRACT;
  negation skips NULLs; merge a SET showing EVERY differing field;
  irreversible action a PAGE; publish the WINDOW not a flag; decision with
  no code a LIE; seed satisfies every read; mandate file a HYPOTHESIS --
  grep before tasking; every page says who's signed in. Shared predicate
  matches printed number to query arithmetic; a "frozen" column is dead
  only if NOTHING writes it. Unpublish/narrow/unschedule SAYS so at the
  moment of choice; a link is the route it LANDS on; error shape follows
  the REQUEST's route; submitted blank CLEARS, absent key is silence;
  list+export read status through ONE reader; main can be RED — grep
  `<<<<<<<` every wave. Hand-listed vocab tables DESYNC — read ONE
  enumerated set. A gate must not render children while identity loads.
  A promised column needs controls on EVERY row; two save paths for one
  row is one too many. Pills that clear each other are a radio group in
  a toggle's clothes. A per-row/per-kind count re-scanning per row is N
  scans (even wearing a Promise.all) — one grouped query. An identity
  from a supplied email must never be ECHOED. Blank is ABSENT for EVERY
  kind. A role read off a USER is null for a row with no user. A
  disabled input is not read-only and must look disabled; a status
  picker is not a decision.
- FINDINGS w17-18 (DEC-883..898, compacted): the tree MOVES WHILE YOU
  PLAN — re-read minutes later already carried the fix; verify twice,
  cite a line number or drop the item. A toggle needing a companion
  choice REVEALS it and WAITS. A shared class is shareable only where
  every member wants every DECLARATION. auto-fill minmax floor is a
  phone rule — desktop columns are COUNTED. An absent image is a DRAWN
  placeholder. An irreversible action is a PAGE naming what goes AND
  what it refuses. A prop with one call site is a setting nobody sets.
  "Last used"/tally numbers come from the log via ONE grouped query,
  never per-row. A deterministic TIE-BREAK answers "which row do we
  join" but not "which of your talks is this" — when data admits two,
  ASK, delete the fallback. A timeline the data already implies needs a
  UNION not a migration; a fact stored twice drifts. Number() parses JS
  literals, not form fields: "1e999" is Infinity, lands null in a
  REQUIRED column. A gate skipped for one content type is not a gate.
  Suggestions computed against the same snapshot propose the same
  slot — accumulate as you hand them out.
- FINDINGS w19 (DEC-899..907): 11 headline mandate items re-checked this
  wave were ALREADY CLOSED in code. A generalisation already computed
  and thrown away is the cheapest fix in the tree — DayGrid clusters N
  sessions and merges only 2. A caption standing in for a checkbox is a
  decision made silently; a handle depicting a gesture it ignores is
  the same lie. Nine date complaints on six pages are one
  toLocaleDateString. A page's actions belong to its title row; a band
  under the title is 170px saying nothing.
