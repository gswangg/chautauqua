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
  render `total`; atomic SQL beats read-then-write; event-clock strings carry
  their event's tz; iCalendar PARAMs sanitized at SERIALIZER; hand-listed
  manifests desync -- enumerate in a test; ONE likeContains escape-only incl.
  unauth search; export dropping custom answers is the lock-in forbidden;
  order checks read MERGED post-patch state.
- STAGE1-CLOSE w30-33 (DEC-520..545, compacted): chunk multi-row VALUES by
  BOUND PARAMETERS not row count; date-only field is a DAY LABEL, display its
  day (read UTC), expand to event-local instant at HARD gates; documented-
  forbidden routes can still be live if mount order lets them -- test
  ADVERSARIAL order; batch per-recipient lookups, contract-test both
  directions; conditional visibility is a FIXED POINT (hidden monotone,
  cycles settle hidden); prove a JS-twin rewrite of an index/SQL agg vs a
  NAIVE REFERENCE; offset-paged ORDER BY always ends in a unique column;
  event-range slot gate lives in the JOIN ON, not a downstream WHERE;
  hand-copied vocabularies drift -- IMPORT them; raw NUL makes a file BINARY
  to ripgrep, invisible to globbed guards; a "pure helper" with zero src
  callers tests NOTHING.
- STAGE1-CLOSE w34-35 (DEC-546..555, compacted): a "PUBLIC BY DESIGN" verdict
  is only as good as its premise -- re-read the RATIONALE. A fallback reached
  by OMISSION is not a decision: lead positive, throw on the rest. LIMIT
  obliges a TOTAL order-by + truthful count; authz population chosen by a
  column. A markdown authz manifest desyncs -- enumerate the app's OWN route
  table, probe both directions. Forced Content-Type is advisory until nosniff
  ships. A uniqueIndex is a CONTRACT -- sweep ALL SELECT-then-INSERT sites,
  derive ON CONFLICT target from schema object. A partial-patch upsert needs
  no read. A feed nobody can fetch cross-origin isn't a feed -- ACAO where the
  cache stores it, never the cookie-authed API. Derive a scan's projection+cap
  from its pure consumer; refuse above cap; a client store rebuilt from
  RENDERED rows deletes what a filter hid -- merge, don't overwrite.
- STAGE1-CLOSE w36 (DEC-556..560): a uniqueness invariant JS implements but
  schema declares nowhere is enforced nowhere -- add the uniqueIndex + ON
  CONFLICT; a merge's dedupe stays -- it picks a WINNER, a constraint can't.
  Parity tests checking an index EXISTS don't check it's UNIQUE. Two surfaces
  rendering one fact, one in names one in raw ids, means the id one is wrong
  -- render by KIND from ONE describe*(). DEC-534's total order extends to
  every LIMITed ADMIN worklist and the JS "best row" reducers beside them --
  prove via re-run shuffled. A notification with nothing to click is
  half-built: reuse the ONE portal-link resolver, never email alone; a cron
  has no request -- give it its own origin entry point that THROWS. An
  export you can't diff is weak own-your-data -- total-order rows AND every
  LIST-valued cell.
