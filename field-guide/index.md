# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1/REDESIGN/CLOSE (DEC-002..569, compacted): pure-core imports no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk
  ops set-based; tokens frozen, ONE dialog contract; D1 binds
  PRIMITIVES (epoch-ms NUMBER); dates via event-time.ts OWNING EVENT's
  tz never toISOString; ONE email rule via findAccountUserId; rows
  graded from ENUMERATION never sample; pagination ONE shape+count*+
  `id asc`; a cap the UI can't see LIES, render `total`; atomic SQL
  beats read-then-write; hand-listed manifests desync -- enumerate;
  conditional visibility FIXED POINT; hand-copied vocab drifts -- IMPORT
  it; uniqueIndex CONTRACT; negation skips NULLs.
- FINDINGS w1-23 (DEC-570..771, compacted): full suites SERIALIZED; real
  <button> not div; colour isn't identity -- NAME it; blank CSV cell
  ABSENT DATA; anonymity a RATCHET; merge a SET; raw id LABELS;
  cacheability DEFAULT+"own header wins"; irreversible action a PAGE;
  hub gives a row ONE action; grid cells POSITIONAL; person named by
  CONTACT; tab selection URL state; side effects ONE writer; sandboxed
  child origin "null"; tiers a PREDICATE; publish the WINDOW not a flag;
  decision with no code a LIE; seed satisfies every read; envelope KEYS
  fixed by route; task creation always expands; merge shows EVERY
  differing field; contact identity (org, lower(email)); author a
  PERSON never "Unknown"; rows grow not scroll; `participant` ONLY
  contact-to-event link; armed CELL owns click; dying-on-reload control.
- FINDINGS w2-6 (DEC-772..820, compacted): mandate file a HYPOTHESIS/
  PROD SNAPSHOT -- grep before tasking, tree MOVES under a planner.
  Count and list ONE predicate over ONE set. Disabled control: ship or
  drop. Speaker reads EVENT tz. Control NAMES its state. Filter a SET:
  rail composes. Toggle with no public consequence is decoration.
  Distribute PREVIEW then apply. Role validated server-side. Duplicate
  warned at CREATION. Merge vocabulary one SET, parity a test. Arming
  a control must not move the page. Ratchet counts only promises made.
  Card owes its age; decline owes its reason. Page must RESOLVE to its
  route. Token adopted server-side only is half; scan by ENUMERATION.
  Saved view re-saved under its own name is one view. Never invent a
  talk title. Browser input at a boundary must not throw the app;
  cookies base64url. Var absent from wrangler.jsonc dev-green/prod-dead;
  two jobs in one bare await one job. Write making a participant ACTIVE
  owes the tasks. Anonymous form may NAME a contact, never edit one.
  Half an adopted pattern teaches two grammars -- sweep by ENUMERATION.
  Per-surface count is that surface's own predicate. Field accepts what
  its placeholder shows. Version number is identity not a position
  among survivors. Every page says who is signed in.
- FINDINGS w7 (DEC-821..828): mandate file MOSTLY CLOSED -- ~20 of ~25
  grepped lines already built. Plan from the TREE; a mandate line has
  a shelf life. A predicate shared server-side is half a rule: the
  number a page PRINTS must share the query's arithmetic. A saved
  thing saves what varies -- a name without its recipe is a bookmark.
  A no-collision rule scopes to identity, not the whole seed -- don't
  empty the demo. A public surface switched off is an intentional
  blank, not a 404 on someone else's site. Auto-distribute owes the
  work it could NOT do. Two chips answering one question are one chip
  with a count. Optional score renders its absence, or reads as zero.
  Reserve migration numbers in the DEC when two waves are in flight.
