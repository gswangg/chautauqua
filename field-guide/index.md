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
- STAGE1-CLOSE w11-26 (DEC-420..504, compacted): ledger names its sha,
  FAIL-unowned vs PENDING-OWNED, ancestor-check via `git merge-base
  --is-ancestor`; ONE email rule via findAccountUserId NEVER email alone;
  universal rows graded from ENUMERATION never sample; pagination ONE shape
  `page?:{limit,offset}` +count*+`id asc`; a cap the UI can't see LIES,
  render `total`; two implementations of one invariant means one is wrong
  -- atomic SQL beats read-then-write; event-clock strings carry their
  event's tz; lanes kill only own PID; tree moves mid-plan -- read the FILE,
  then AGAIN; iCalendar PARAMs sanitized at SERIALIZER; hand-listed
  manifests desync -- enumerate in a test.
- STAGE1-CLOSE w27-29 (DEC-505..519, compacted): server accepts what its
  own UI would never send; FieldPatch kind change REFUSED 409 while answers
  exist; ONE likeContains escape-only incl. unauth search; ONE isIsoDate
  home; credentials contract-tested vs vendored fixture both directions;
  export dropping custom answers is the lock-in forbidden; order checks
  read MERGED post-patch state; a manifest-guard test must DERIVE it.
- STAGE1-CLOSE w30 (DEC-520..525, compacted): 520 default task set owes a
  default due-date schedule (masked by seed data). 521 chunked multi-row
  VALUES + NAMED bound that REFUSES before first write. 522 date-only
  field is a DAY LABEL not an instant -- DISPLAY as its day (read UTC),
  EXPAND to event-local instant at every HARD gate, soft signals compare
  raw. 523 documented-forbidden wildcard was live, inert only by mount
  order -- test ADVERSARIAL order. 524 ONE date-input<->epoch home. 525
  unverifiable fix (KV ceiling, unobservable on Miniflare) dispositioned,
  not spent.
- STAGE1-CLOSE w31 (DEC-526..531): the tree moved mid-plan for the EIGHTH
  wave -- 520/521 (due dates + chunked acceptance insert) and 522's DISPLAY
  half landed BETWEEN two reads; 523 was already in. None re-issued; the
  GATE half (timezone.ts day-expansion) was still absent at cut. 526 the
  bulk reviewer nudge counted recusals as outstanding while the progress
  panel next to it in the SAME FILE excluded them -- a nudge and a dashboard
  that disagree are one invariant asked twice. 527 517's isEpochMs reached
  three hand-picked call sites and missed the fourth: task dueDate took NaN
  (typeof is "number") and stored NULL silently; spot-fixes are why -- GLOB
  the boundary. 528 a chunk sized in ROWS against a limit stated in BOUND
  PARAMETERS: ID_CHUNK_SIZE=90 rows x 8 columns = 720 binds vs the codebase's
  own documented ~100, at three insert sites; derive columns-per-row from the
  ROWS, never hand-declare. Same task: the last per-row task_assignment loop,
  sibling of the one 521 just fixed. 529 an export column of opaque criterion
  ids is 515's lock-in again -- derive columns from the KEYS PRESENT so
  nothing can be dropped by construction. 530 100 recipients x 2 awaits =
  200 serial D1 hops on the preview a producer clicks; batch the lookups,
  contract-test the batch against the singular's OR-rule in BOTH directions.
  531 the overview loaded thousands of rows to count them where the J6 grid
  already counts in SQL -- delete the loser, don't keep it unused.
