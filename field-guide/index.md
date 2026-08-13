# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1/REDESIGN/CLOSE + FINDINGS w1-6 (DEC-002..820, heavily compacted):
  pure-core imports no node:/cf; Hono sub-apps, errors
  {error:{code,message,fields?}}; bulk ops set-based; D1 binds
  PRIMITIVES; dates via event-time.ts OWNING EVENT's tz; rows graded
  from ENUMERATION never sample; pagination ONE shape+count*+`id asc`;
  atomic SQL beats read-then-write; hand-listed manifests/vocab desync
  -- ENUMERATE/IMPORT; uniqueIndex CONTRACT; negation skips NULLs;
  merge a SET showing EVERY differing field; irreversible action a
  PAGE; publish the WINDOW not a flag; decision with no code a LIE;
  seed satisfies every read; mandate file a HYPOTHESIS -- grep before
  tasking; every page says who's signed in.
- FINDINGS w7-16 (DEC-821..882, compacted): mandate/probe findings
  EXPIRE, re-grep before tasking. Shared predicate matches printed
  number to query arithmetic; a "frozen" column is dead only if
  NOTHING writes it. Unpublish/narrow/unschedule SAYS so at the
  moment of choice; a link is the route it LANDS on; error shape
  follows the REQUEST's route; submitted blank CLEARS, absent key
  is silence; list+export read status through ONE reader; main can
  be RED — grep `<<<<<<<` every wave. Hand-listed vocab tables
  DESYNC — read ONE enumerated set. A gate must not render children
  while identity loads. A promised column needs controls on EVERY
  row; two save paths for one row is one too many. Pills that clear
  each other are a radio group in a toggle's clothes. A per-row
  count re-scanning per row is N scans — one pass. An identity from
  a supplied email must never be ECHOED. Blank is ABSENT for EVERY
  kind. A role read off a USER is null for a row with no user. A
  disabled input is not read-only; a status picker is not a decision.
- FINDINGS w17 (DEC-883..890, compacted): the tree MOVES WHILE YOU
  PLAN — re-read minutes later already carried the fix; verify twice
  before re-tasking. A toggle needing a companion choice REVEALS it
  and WAITS. A shared class is shareable only where every member
  wants every DECLARATION. auto-fill with a small minmax floor is a
  phone rule that never stops — desktop columns are COUNTED. An
  absent image is a DRAWN placeholder. An irreversible action is a
  PAGE naming what goes AND what it refuses. A prop with one call
  site is a setting nobody sets. "Last used" comes from the log via
  ONE grouped query, never a new column, never per-row.
- FINDINGS w18 (DEC-891..898): a mandate list has a HALF-LIFE — this
  wave re-verified 9 headline items and found 7 already closed (agenda
  tray eviction, staggered content rows, "(unknown)" author role,
  reviewer count, per-surface published counts, saved-embed format,
  speakers participation select + add-speaker modal). Grep before you
  task; cite a line number or drop the item. A deterministic TIE-BREAK
  is the right answer to "which row do we join" and the wrong answer to
  "which of your talks is this" — when the data admits two, ASK, and
  delete the fallback so there is one path. A timeline the data already
  implies needs a UNION, not a migration; a fact stored twice drifts.
  Number() parses JavaScript literals, not form fields: "1e999" is
  Infinity and lands as null in a REQUIRED column. A gate skipped for
  one content type is not a gate; a downscale living in one route is
  not a property of the artefact. Suggestions computed against the same
  snapshot all propose the same slot — accumulate as you hand them out.
