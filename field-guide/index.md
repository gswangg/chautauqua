# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE): pure-core src/{auth,domain,forms,
  mail,lib} import nothing node:/cf; 012/013 route files export Hono
  sub-apps, errors {error:{code,message,fields?}}; bulk ops set-based.
- REDESIGN w1-10 (DEC-366..419, FUNCTION FROZEN): tokens frozen, ONE
  dialog contract, phone @700px; D1 binds PRIMITIVES (epoch-ms
  NUMBER); dates via event-time.ts OWNING EVENT's tz never toISOString;
  public lists LIMIT+COUNT(DISTINCT).
- STAGE1-CLOSE w11-29 (DEC-420..519, compacted): ledger names its sha, FAIL-
  unowned vs PENDING-OWNED via `git merge-base --is-ancestor`; ONE email
  rule via findAccountUserId NEVER email alone; universal rows graded from
  ENUMERATION never sample; pagination ONE shape `page?:{limit,offset}`
  +count*+`id asc`; a cap the UI can't see LIES, render `total`; two
  implementations of one invariant means one is wrong -- atomic SQL beats
  read-then-write; event-clock strings carry their event's tz; lanes kill
  only own PID; tree moves mid-plan -- read the FILE, then AGAIN; iCalendar
  PARAMs sanitized at SERIALIZER; hand-listed manifests desync -- enumerate
  in a test; server accepts what its own UI would never send; FieldPatch
  kind change REFUSED 409 while answers exist; ONE likeContains escape-only
  incl. unauth search; ONE isIsoDate home; credentials contract-tested vs
  vendored fixture both directions; export dropping custom answers is the
  lock-in forbidden; order checks read MERGED post-patch state.
- STAGE1-CLOSE w30-31 (DEC-520..531, compacted): default task set owes a
  default due-date schedule; chunk multi-row VALUES by BOUND PARAMETERS
  (derive columns-per-row from rows), never by row count; date-only field
  is a DAY LABEL not an instant -- display as its day (read UTC), expand
  to event-local instant at every HARD gate; documented-forbidden routes
  can still be live, inert only by mount order -- test ADVERSARIAL order;
  ONE date-input<->epoch home; a nudge and its sibling dashboard must count
  identically; glob boundary validators rather than hand-picking call sites;
  an opaque-id export column is a lock-in -- derive columns from KEYS
  PRESENT; batch per-recipient lookups, contract-test vs singular both
  directions; delete a losing duplicate implementation, don't keep it unused.
- STAGE1-CLOSE w32-33 (DEC-532..545, compacted): tree moved mid-plan a TENTH
  consecutive wave -- verify prior claims in the FILE; verify a reviewer finding
  is still open before planning it (pubcache '*' bump CLOSED 4x, do not re-raise).
  Conditional visibility is a FIXED POINT (hidden monotone, cycles settle hidden);
  findConflicts/cron sweep/aggregateSpeakerCounts were slow JS twins of an index
  or SQL agg proven elsewhere -- prove rewrites vs a NAIVE REFERENCE; offset-paged
  ORDER BY always ends in a unique column (glob it); a nudge shares its sibling's
  cap, deferred halves DOCUMENTED not forgotten; event-range slot gate lives in
  the JOIN ON, not a WHERE bolted on downstream; hand-copied enums/vocabularies
  drift -- IMPORT them; raw NUL makes a file BINARY to ripgrep, invisible to every
  globbed guard -- guard the guards. iCalendar sanitization at DEC-499 covered
  PARAMs only -- TEXT VALUES need the same serializer-side strip, proven per-byte;
  a uniqueIndex the schema declares makes read-then-write loops an atomic ON
  CONFLICT DO UPDATE (create = upsert-that-cannot-conflict, delete the twin); the
  last per-row insert loop is now chunked, and a cap whose fan-out is one row's
  own children is a number with no failure mode -- say so; a list SELECTing a
  column no renderer shows is oversized payload, derive projection from renderers;
  a "pure helper for tests" with zero src callers tests NOTHING -- scan for the
  copy; a formatter module that bans toLocale* but ships no date-TIME variant
  gets copies -- add the helper AND glob the ban.
