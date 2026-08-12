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
- STAGE1-CLOSE w30-33 (DEC-520..545, compacted): chunk VALUES by BOUND
  PARAMS not row count; date-only field is a DAY LABEL (read UTC, expand
  event-local at hard gates); test mount-order ADVERSARIALLY; conditional
  visibility is a FIXED POINT; offset-paged ORDER BY ends in a unique
  column; slot gate lives in JOIN ON not WHERE; hand-copied vocabularies
  drift -- IMPORT them; raw NUL makes a file invisible to grepped guards;
  a helper with zero src callers tests NOTHING.
- STAGE1-CLOSE w34-36 (DEC-546..560, compacted): re-read the RATIONALE
  before trusting a "PUBLIC BY DESIGN" verdict; a fallback by OMISSION is
  not a decision -- lead positive, throw on the rest. LIMIT obliges a
  TOTAL order-by + truthful count. A uniqueIndex is a CONTRACT -- sweep
  every SELECT-then-INSERT, derive ON CONFLICT from the schema object; a
  merge's dedupe picks a WINNER, a constraint can't. Two surfaces
  rendering one fact where one uses raw ids means the id one is wrong --
  render by KIND from ONE describe*(). A notification with nothing to
  click is half-built -- reuse the ONE portal-link resolver, never email
  alone. A cron has no request -- give it its own origin entry point that
  THROWS. An export you can't diff is weak own-your-data -- total-order
  rows AND every list-valued cell.
- STAGE1-CLOSE w37 (DEC-561..564): a render test whose MOCK is invented
  proves NOTHING -- pin the SPA type to the server's OWN payload, then
  correct the mock, never the assertion; assert no rendered surface says
  "undefined". A queue that ERASES what you finished can never show it
  stored -- keep completed rows, sort them last. A `position` column
  nobody sets on create is a dead column: assign max+1 INSIDE the insert.
  A grid that derives columns from FIRST APPEARANCE invents an order the
  producer already declared. A greedy placer's input order IS its
  output. DEC-534's total order extends to every LIST A HUMAN READS:
  speakers (order, contact.id), answers (position, id), feedback
  (createdAt, id) -- chunking dissolves a SQL order, so the JS sort
  becomes the tiebreak of record.
