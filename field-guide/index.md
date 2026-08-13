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
- FINDINGS w7-11 (DEC-821..854, heavily compacted): mandate/probe
  findings EXPIRE, plan from the TREE, re-grep the anchor line before
  tasking. Shared predicate matches printed number to query
  arithmetic; switched-off public surface is intentional blank not
  404; unpublish/narrow/unschedule SAYS so at the moment of choice;
  a link is the route it LANDS on. Error shape follows the REQUEST's
  route; submitted blank CLEARS, absent key is silence; list+export
  read status through ONE reader. main can be RED — grep for
  `<<<<<<<` every wave. A hand-listed vocab/knob table per surface
  DESYNCS — page/.json/.xml/builder read ONE enumerated set. A write
  that succeeds says what it did in its automated twin's vocabulary;
  a card that can only be MOVED does not say "place".
- FINDINGS w12 (DEC-855..859, compacted): a "frozen legacy" column is
  only dead if NOTHING writes it — pin source AND scan other storage
  site by identifier, same commit as readers. Preflight collects ALL
  misses per recipient, ONE message shape. A control naming an action
  already taken is the "place" defect again; a gate must not render
  children while identity loads; name identity via the DETECTOR's
  normalized form not raw ===; a promised column needs controls on
  EVERY row it claims to affect.
- FINDINGS w13 (DEC-860..864, compacted): re-grep the anchor line
  before tasking, even hour-old findings — several were already
  fixed on main. Two save paths for one row is one too many. Pills
  that clear each other are a radio group in a toggle's clothes; two
  filter axes each name their axis. A confirmation names both the
  reference AND the emailed address. An optional field dropped
  unless a DIFFERENT optional field is filled inverts DEC-810's
  fabrication guard. A harness login in a product placeholder leaks
  the test into the product. A per-row count re-scanning per row is
  N scans for a caption — count every set in ONE pass, list's predicate.
- FINDINGS w14 (DEC-865..869): a role column only the AUTH layer reads
  is not authz — a directory query with no role filter hands account
  controls (password re-issue, role change) over PORTAL logins; list
  and count share ONE where-builder or the total lies. An identity
  resolved from a supplied email must never be ECHOED: dedupe by
  email, render the name the sender typed. Blank is ABSENT for EVERY
  kind; `ne` must not fire on an absent trigger. A filter row states
  its conjunction, edits in place, counts N of M; incomplete rule is
  never a query — one activeRules() reader for list/export/save. A
  states menu names each consequence, marks the one in force (aria-checked, not CSS class).
