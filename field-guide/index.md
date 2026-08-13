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
  {error:{code,message,fields?}}; bulk ops set-based; tokens frozen ONE
  dialog contract; D1 binds PRIMITIVES (epoch-ms NUMBER); dates via
  event-time.ts OWNING EVENT's tz never toISOString; ONE email rule;
  rows graded from ENUMERATION never sample; pagination ONE
  shape+count*+`id asc`, cap the UI can't see LIES; atomic SQL beats
  read-then-write; hand-listed manifests/vocab desync -- ENUMERATE/
  IMPORT; conditional visibility FIXED POINT; uniqueIndex CONTRACT;
  negation skips NULLs; real <button> not div; colour isn't identity;
  merge a SET showing EVERY differing field; cacheability DEFAULT+
  "own header wins"; irreversible action a PAGE; grid cells POSITIONAL;
  tab/day selection URL state; side effects ONE writer; publish the
  WINDOW not a flag; decision with no code a LIE; seed satisfies every
  read; contact identity (org, lower(email)); `participant` ONLY
  contact-to-event link; mandate file a HYPOTHESIS -- grep before
  tasking, tree MOVES under planner; Filter a SET; Distribute PREVIEW
  then apply owing work it could NOT do; Duplicate warned at CREATION;
  Token adopted server-side only is half -- scan by ENUMERATION; Saved
  view/thing re-saved is one view, saves what varies; Write making a
  participant ACTIVE owes tasks; Anonymous form may NAME a contact
  never edit one; every page says who's signed in.
- FINDINGS w7-9 (DEC-821..840, compacted): a probe/mandate finding
  expires, plan from the TREE, and a decision whose code is still
  absent TWO waves after minting is dropped, re-task it. Predicate
  shared server-side is half a rule: the page's PRINTED number must
  share the query's arithmetic; no-collision scopes to identity not
  the whole seed; a switched-off public surface is intentional blank,
  not a 404. A filter that can only return zero rows means LISTING
  predicate is wrong. A write that unpublishes someone must SAY so at
  the moment of choice; composer shows what it sends, auditable to its
  WORDS. Identical labels at an irreversible choice are not labels; a
  day pill is navigation. A link is the route it LANDS on: in-app `to`
  under a router basename is basename-relative, a link into a ?tab=
  page carries that state. A knob bound to nothing is a lie -- bind
  only where DEFAULT equals rendered colour; two tasks implementing
  one decision means the PLANNER pins the wire shape.
- FINDINGS w10 (DEC-841..848): mandate ~95% CLOSED, tree MOVES mid-plan
  -- a control read as "wrong shape" was correct twenty minutes later,
  re-grep the anchor line before writing a task and DROP rather than
  re-task. An error's shape follows the REQUEST's route, not the
  middleware that ran -- share the 404 handler's predicate, don't mint
  a second. A submitted blank is an instruction to CLEAR; an absent
  key is silence -- keep them distinguishable. A list and its export
  read status through ONE reader; an unknown filter token is loud on
  BOTH (silently widening lies about what's on screen). A write that
  narrows a window never blocks but NAMES every row it unschedules. A
  composer hiding what it sends behind a templateId isn't a composer;
  a send is auditable to its WORDS not its metadata. A subject is one
  line: a block merge field is body vocabulary; an inline stated-
  absence value carries no terminal period. A queue headed by a plan
  needs the plan's facts (and reviewer's OWN score) on its wire; a
  seed with one open plan can't show a scoped queue at all.
