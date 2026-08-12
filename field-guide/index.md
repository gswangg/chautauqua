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
  unowned vs PENDING-OWNED; ONE email rule via findAccountUserId NEVER email
  alone; universal rows graded from ENUMERATION never sample; pagination ONE
  shape `page?:{limit,offset}`+count*+`id asc`; a cap the UI can't see LIES,
  render `total`; two implementations of one invariant means one is wrong --
  atomic SQL beats read-then-write; event-clock strings carry their event's
  tz; iCalendar PARAMs sanitized at SERIALIZER; hand-listed manifests desync
  -- enumerate in a test; server accepts what its own UI would never send;
  ONE likeContains escape-only incl. unauth search; credentials contract-
  tested vs vendored fixture both directions; export dropping custom answers
  is the lock-in forbidden; order checks read MERGED post-patch state.
- STAGE1-CLOSE w30-33 (DEC-520..545, compacted): chunk multi-row VALUES by
  BOUND PARAMETERS not row count; date-only field is a DAY LABEL, display as
  its day (read UTC), expand to event-local instant at HARD gates; documented-
  forbidden routes can still be live if mount order lets them -- test
  ADVERSARIAL order; glob boundary validators, don't hand-pick call sites;
  batch per-recipient lookups, contract-test both directions; delete a losing
  duplicate, don't keep it unused; conditional visibility is a FIXED POINT
  (hidden monotone, cycles settle hidden); prove a JS-twin rewrite of an
  index/SQL agg vs a NAIVE REFERENCE; offset-paged ORDER BY always ends in a
  unique column; event-range slot gate lives in the JOIN ON, not a downstream
  WHERE; hand-copied enums/vocabularies drift -- IMPORT them; raw NUL makes a
  file BINARY to ripgrep, invisible to every globbed guard -- guard the
  guards; a "pure helper" with zero src callers tests NOTHING; a formatter
  banning toLocale* but shipping no date-TIME variant gets copies.
- STAGE1-CLOSE w34 (DEC-546..551, compacted): a "PUBLIC BY DESIGN" verdict is
  only as good as its premise -- re-read the RATIONALE, not the verdict. A
  fallback reached by OMISSION (no binding + no flag) is not a decision: lead
  with the positive predicate, throw on the rest. A filter the SQL could
  take, it must take; LIMIT obliges a TOTAL order-by + truthful count. Authz
  population is chosen by a column, e.g. deliverable_kind. A markdown authz
  manifest desyncs silently -- enumerate the app's OWN route table, probe
  anonymously vs a THROWING db, assert allowlist exact both directions. A
  forced Content-Type is advisory until nosniff ships with it.
- STAGE1-CLOSE w35 (DEC-552..555): a uniqueIndex is a CONTRACT -- every
  SELECT-then-INSERT-or-UPDATE over one is a 500 waiting for two concurrent
  users; sweep ALL sites, and derive the ON CONFLICT target from the schema
  object so a rename breaks the compile. A partial-patch upsert needs no
  read: insert defaults, SET only the keys the caller supplied. A feed
  nobody can fetch cross-origin is not a feed -- set ACAO where the CACHE
  STORES it, never on the cookie-authed API. Derive a scan's projection AND
  its cap from the pure consumer that reads it; refuse above the cap, never
  truncate. A client-side store rebuilt from the RENDERED rows silently
  deletes whatever a filter or LIMIT hid -- merge, don't overwrite; ship the
  one pure function into the page via toString(), never a hand-written twin.
