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
  tasking; Token adopted server-side only is half -- scan by
  ENUMERATION; every page says who's signed in.
- FINDINGS w7-10 (DEC-821..848, compacted): mandate/probe findings
  EXPIRE, plan from the TREE, decision-with-no-code-two-waves is
  dropped/re-tasked, re-grep the anchor line before writing a task. A
  shared predicate must match the page's PRINTED number to the
  query's arithmetic; no-collision scopes to identity not whole seed;
  switched-off public surface is intentional blank not 404; a filter
  returning only zero rows has a wrong LISTING predicate. A write that
  unpublishes/narrows/unschedules SAYS so at the moment of choice; a
  composer/send is auditable to its WORDS not templateId/metadata; a
  subject is one line, no merge-field body vocabulary, no terminal
  period on stated-absence. Identical labels at an irreversible choice
  aren't labels; a day pill is navigation; a link is the route it
  LANDS on (basename-relative, carries ?tab= state); a knob binds only
  where DEFAULT equals rendered colour; two tasks on one decision means
  the PLANNER pins the wire shape. An error's shape follows the
  REQUEST's route not the middleware, share the 404 predicate. A
  submitted blank CLEARS, an absent key is silence. A list and its
  export read status through ONE reader; unknown filter token is loud
  on both. A queue headed by a plan carries the plan's facts and the
  reviewer's OWN score.
- FINDINGS w11 (DEC-849..854): main can be RED — a merge left conflict
  markers COMMITTED in src/routes/public/saved-embed.tsx AND its test,
  unnoticed for two waves. Verifying "from the tree" now includes
  grepping for `<<<<<<<`; the guard is a SCAN, never a habit. A saved
  recipe storing a FORMAT that always answers HTML lies about the
  recipe — resolve non-HTML formats to the canonical feed route, never
  a second envelope. A knob table hand-listed per surface DESYNCS from
  what the server honours: the page, its .json twin, its .xml twin and
  the builder read ONE enumerated set, and the planner pins that set.
  A grace rule that silently moves a deadline owes the moved date
  BEFORE it bites; a date outside this year names its year. A write
  that succeeds says what it did in the vocabulary its automated twin
  already uses, including the clash it just created; a card that can
  only be MOVED does not say "place". Roster-add writing invite_status
  'none' is CORRECT by design (the menu then offers the invite) — that
  mandate line is closed, not open. ~97% of the mandate now greps
  CLOSED; hunt defects in the source, not the findings file.
