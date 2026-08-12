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
  identically (same-file disagreement = one invariant asked twice); glob
  boundary validators rather than hand-picking call sites; an opaque-id
  export column is a lock-in -- derive columns from KEYS PRESENT; batch
  per-recipient lookups inside a batch send, contract-test vs singular in
  both directions; delete a losing duplicate implementation, don't keep it
  unused.
- STAGE1-CLOSE w32 (DEC-532..539): tree moved mid-plan a NINTH wave -- 31's a/b/c/d/f
  landed between reads (only e, comms batching, in flight); none re-issued. 532
  conditional visibility must be a FIXED POINT: 501 stripped depth-1 hidden answers
  but a grandchild gated on a hidden field still read its stale answer -- required-
  blocks an invisible question; hidden is monotone, cycles settle hidden. 533
  findConflicts was O(n^2) while autoSchedule 40 lines below already had the day/
  room/speaker index -- same invariant, slow twin, re-run by scheduleSummary too;
  an output-identical rewrite is proven by a NAIVE REFERENCE in the test, never a
  hand-written expectation. 534 a bulk send stamps 100 rows one millisecond apart,
  so a LIMIT/OFFSET list ordered only by that timestamp repeats/drops rows: every
  offset-paged ORDER BY ends in a unique column, globbed. 535 a nudge with a capped
  sibling and no cap of its own; ONE capById, deferred half DOCUMENTED not forgotten.
  536 an event-range slot gate honoured at four reads, missed at the portal where
  the speaker ACTS on it; predicate goes in the JOIN ON, not the WHERE. 537 whole-
  table scan reduced by a JS Set where DISTINCT belongs. 538 a hand-copied enum
  drifted: saved-view validator rejects a sort its own list endpoint emits. 539 a
  raw NUL byte makes a source file BINARY to ripgrep -- every globbed guard in
  this repo silently skips it; guard the guards.
