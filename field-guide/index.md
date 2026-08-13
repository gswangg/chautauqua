# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1/REDESIGN/CLOSE + FINDINGS w1-6 (DEC-002..820, compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; tokens frozen, ONE dialog contract; D1 binds
  PRIMITIVES (epoch-ms NUMBER); dates via event-time.ts OWNING EVENT's tz
  never toISOString; ONE email rule; rows graded from ENUMERATION never
  sample; pagination ONE shape+count*+`id asc`; a cap the UI can't see
  LIES, render `total`; atomic SQL beats read-then-write; hand-listed
  manifests desync -- enumerate; conditional visibility FIXED POINT;
  hand-copied vocab drifts -- IMPORT it; uniqueIndex CONTRACT; negation
  skips NULLs; full suites SERIALIZED; real <button> not div; colour
  isn't identity -- NAME it; blank CSV cell ABSENT DATA; anonymity a
  RATCHET; merge a SET; cacheability DEFAULT+"own header wins";
  irreversible action a PAGE; grid cells POSITIONAL; tab selection URL
  state; side effects ONE writer; publish the WINDOW not a flag;
  decision with no code a LIE; seed satisfies every read; task creation
  always expands; merge shows EVERY differing field; contact identity
  (org, lower(email)); rows grow not scroll; `participant` ONLY
  contact-to-event link; dying-on-reload control; mandate file a
  HYPOTHESIS -- grep before tasking, tree MOVES under a planner;
  count/list ONE predicate; Filter a SET, rail composes; Distribute
  PREVIEW then apply; Duplicate warned at CREATION; Arming a control
  must not move the page; Card owes age, decline owes reason; Token
  adopted server-side only is half -- scan by ENUMERATION; Saved view
  re-saved is one view; cookies base64url; Write making a participant
  ACTIVE owes tasks; Anonymous form may NAME a contact, never edit one;
  Per-surface count is own predicate; every page says who's signed in.
- FINDINGS w7-8 (DEC-821..836, compacted): mandate list runs stale --
  grep the anchor line before tasking, a probe finding expires, plan
  from the TREE. Predicate shared server-side is half a rule: the
  number a page PRINTS must share the query's arithmetic. Saved thing
  saves what varies; no-collision rule scopes to identity not the whole
  seed; a switched-off public surface is intentional blank, not a 404.
  Auto-distribute owes the work it could NOT do; two chips answering
  one question are one chip with a count; optional score renders its
  absence. A filter that can only return zero rows means the LISTING
  predicate is wrong, not the filter; listing and expanding are
  different questions. A design sentence contradicting a load-bearing
  invariant loses its mechanism, keeps its layout. A write that
  unpublishes someone must SAY so at the moment of choice. Composer
  shows what it sends; a send is auditable to its WORDS. Identical
  labels at an irreversible choice are not labels; a day pill is
  navigation; a seed no grader can see a feature through fails a read.
- FINDINGS w9 (DEC-837..840): mandate ~95% CLOSED, all four review-lens
  findings already fixed -- plan from the TREE only. A decision whose
  code is still absent TWO waves after minting is dropped, not in
  flight -- re-task it (822/824/825). A link is the route it LANDS on:
  under a router basename an absolute in-app `to` doubles the prefix,
  and a link into a ?tab= page without the tab lands on the wrong tab
  -- prove both by scanning source. A knob bound to nothing is a lie;
  bind it only where DEFAULT equals the rendered colour, so mocks stay
  identical and the custom value is the only visible change; two tasks
  implementing one decision means the PLANNER pins the wire shape.
