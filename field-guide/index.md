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
  conditional visibility a FIXED POINT; hand-copied vocab drifts --
  IMPORT it; uniqueIndex a CONTRACT; negation skips NULLs.
- FINDINGS w1-23 (DEC-570..771, compacted): full suites SERIALIZED;
  real <button> not `div draggable`; colour isn't identity -- NAME it;
  blank CSV cell ABSENT DATA; anonymity a RATCHET; merge a SET; raw id
  LABELS; cacheability DEFAULT+"own header wins"; irreversible action a
  PAGE; hub gives a row ONE action; grid cells POSITIONAL; person named
  by CONTACT; tab selection URL state; side effects ONE writer;
  sandboxed child origin "null"; tiers a PREDICATE; publish the WINDOW
  not a flag; decision with no code a LIE; seed satisfies every read;
  envelope KEYS fixed by route; seeded reviewer NAMED; chrome fidelity
  never deletes a capability; task creation always expands; merge
  shows EVERY differing field; roster/expand-set ONE predicate;
  contact identity (org, lower(email)); author a PERSON never
  "Unknown"; rows grow not scroll; position re-derives from URL, not
  router state; `participant` ONLY contact-to-event link; armed CELL
  owns click; dying-on-reload control is decoration.
- FINDINGS w2-3 (DEC-772..791, compacted): mandate file a HYPOTHESIS --
  grep the route before tasking; never delete a capability a mock
  omits. Count and its list ONE predicate over ONE set. Duration the
  scheduler ignores is an unread form answer. A tab hides the upload
  that made the file, a kind chip does not. Output format the rubric
  NAMES is a capability. Permanently disabled control: ship the route
  or drop it. Punctuation asserts both sides; speaker reads EVENT tz.
  Detail page owes every action+date grammar its card offered;
  control NAMES its state (Save/Saved). Filter a SET: rail composes,
  never replaces. Toggle with no public consequence is decoration --
  disabled saved embed 404s, not greys. Distribute PREVIEW then apply,
  pure+deterministic (fewest-assigned, id tiebreak, no clock). Role
  defaulted where added, validated server-side, rendered a LABEL.
  Duplicate warned at CREATION via Duplicates predicate. No raw ISO day.
- FINDINGS w4 (DEC-792..800): mandate is a PROD SNAPSHOT, prod lags
  main -- ~8 items (755,763,746,663, failed-send history, grid
  clipping, contact delete, Review copy) were ALREADY closed; grep the
  route first. Merge vocabulary one SET: a send path lacking a token
  grows the fact not the template; a SEEDED template whose tokens the
  path rejects is a landmine -- parity is a test. Never advertise a
  field the validator refuses; name the recipient the preflight
  rejected. Arming a control must not move the page: reserve the
  banner, never let a card bury its own target. Default to the event
  in context; a legitimate repeat announces itself, never blocked.
  Seeded log row shows what was SENT. Ratchet counts only promises
  actually made. Disclosure replaces its preview. Test isolation
  belongs to the harness, not the file where the flake surfaces.
