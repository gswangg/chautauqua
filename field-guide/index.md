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
  arithmetic; no-collision scopes to identity not whole seed;
  switched-off public surface is intentional blank not 404.
  Unpublish/narrow/unschedule SAYS so at the moment of choice;
  composer/send auditable to WORDS; identical labels at an
  irreversible choice aren't labels; a link is the route it LANDS on;
  a knob binds only where DEFAULT equals rendered colour. Error shape
  follows the REQUEST's route; submitted blank CLEARS, absent key is
  silence; list+export read status through ONE reader. main can be
  RED — grep for `<<<<<<<` every wave. A saved recipe storing a
  FORMAT that always answers HTML lies; a knob table hand-listed per
  surface DESYNCS — page/.json/.xml/builder read ONE enumerated set.
  A write that succeeds says what it did in its automated twin's
  vocabulary; a card that can only be MOVED does not say "place".
- FINDINGS w12 (DEC-855..859, compacted): a "frozen legacy" column is
  only dead if NOTHING writes it — pin the source AND scan for the
  other storage site by identifier, same commit as the readers. A
  preflight collects ALL misses per recipient, ONE message shape. A
  control that names an action the user already took is the "place"
  defect again. A gate must not render children while identity loads.
  Name identity at an irreversible choice via the DETECTOR's
  normalized form, not raw ===. A promised column needs controls on
  EVERY row it claims to affect.
- FINDINGS w13 (DEC-860..864): re-grep the anchor line before tasking,
  even a finding that arrived this hour — several w13 leads were
  already fixed on main. Two save paths for one row is one too many:
  a quick-save hardcoding defaults writes rows whose STATED recipe
  nobody chose. Pills that clear each other are a radio group in a
  toggle's clothes — a single-choice filter is a select, and two
  filter axes each name their axis. A confirmation naming neither
  the reference nor the emailed address hides the typo that lost the
  talk. An optional field dropped unless a DIFFERENT optional field
  is filled is DEC-810's fabrication guard inverted. A harness login
  in a product placeholder is the test leaking into the product. A
  per-row count re-running a whole-directory scan per row is N scans
  for a caption: count every set in ONE pass, same predicate as list.
