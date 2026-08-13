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
  EXPIRE, plan from the TREE, re-grep the anchor line before tasking.
  Shared predicate matches printed number to query arithmetic;
  no-collision scopes to identity not whole seed; switched-off public
  surface is intentional blank not 404. Unpublish/narrow/unschedule
  SAYS so at the moment of choice; composer/send auditable to WORDS;
  subject one line, no terminal period on stated-absence. Identical
  labels at an irreversible choice aren't labels; a link is the route
  it LANDS on; a knob binds only where DEFAULT equals rendered colour.
  Error shape follows the REQUEST's route; submitted blank CLEARS,
  absent key is silence; list+export read status through ONE reader;
  a queue headed by a plan carries the reviewer's OWN score.
- FINDINGS w11 (DEC-849..854, compacted): main can be RED — grep for
  `<<<<<<<` every wave, the guard is a SCAN not a habit. A saved
  recipe storing a FORMAT that always answers HTML lies — resolve to
  the canonical feed route. A knob table hand-listed per surface
  DESYNCS from what the server honours: page/.json/.xml/builder read
  ONE enumerated set. A grace rule that moves a deadline owes the
  moved date BEFORE it bites; a write that succeeds says what it did
  in its automated twin's vocabulary, including the clash it caused; a
  card that can only be MOVED does not say "place".
- FINDINGS w12 (DEC-855..859): the mandate is ~exhausted — hunt the
  SOURCE. A "frozen legacy" column is only dead if NOTHING writes it:
  submission.track_id was documented dead, still written by the
  Sessionboard importer and still JOINed by four readers, so an
  imported programme had tracks nowhere the public site looks and NULL
  everywhere the portal looks. When one fact has two storage sites,
  pin the source AND scan for the other by identifier, in the same
  commit as the readers. A preflight that names one problem per round
  trip lies about how much is wrong: collect ALL misses per recipient
  and emit ONE message shape for singular and plural, or the client
  grows two parsers that drift. A control that names an action the
  user already took ("Score this" on a scored row) is the same defect
  as a card that says "place" when it can only move. A gate that
  renders its children while identity is still loading mounts the very
  page it exists to prevent. Name identity at an irreversible choice
  uses the DETECTOR's normalized form, not raw ===. A promised column
  ("Skip this row") with controls on a minority of rows is a broken
  promise, not conditional-and-quiet.
