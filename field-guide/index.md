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
- STAGE1-CLOSE w11-33 (DEC-420..545, compacted): ledger names its sha; ONE
  email rule via findAccountUserId; universal rows graded from ENUMERATION
  never sample; pagination ONE shape `page?:{limit,offset}`+count*+`id asc`;
  a cap the UI can't see LIES, render `total`; atomic SQL beats
  read-then-write; event-clock strings carry their event's tz; hand-listed
  manifests desync -- enumerate in a test; export dropping custom answers is
  the lock-in forbidden; chunk VALUES by BOUND PARAMS not row count;
  date-only field is a DAY LABEL; conditional visibility is a FIXED POINT;
  offset-paged ORDER BY ends in a unique column; hand-copied vocabularies
  drift -- IMPORT them; a helper with zero src callers tests NOTHING.
- STAGE1-CLOSE w34-38 (DEC-546..569, compacted): re-read the RATIONALE
  before trusting a "PUBLIC BY DESIGN" verdict. LIMIT obliges a TOTAL
  order-by + truthful count. A uniqueIndex is a CONTRACT -- sweep every
  SELECT-then-INSERT. A notification with nothing to click is half-built.
  A cron has no request -- give it its own origin entry point that THROWS.
  A render test whose MOCK is invented proves NOTHING -- pin the SPA type
  to the server's OWN payload. A `position`/`order` column nobody sets on
  create is dead: assign max+1 INSIDE the insert. A nullable column inside
  a NEGATED set predicate (NOT IN / !=) silently skips its NULL rows --
  decide in JS, export as a PURE fn. Two functions claiming "the same
  semantics" must END in the same helper. A completion count taken OUTSIDE
  the assigned set can exceed its own denominator. Feedback a speaker reads
  is the round that DECIDED THEM, never every round stacked.
- FINDINGS ROUND w1 (DEC-570..580): full suites are SERIALIZED through
  scripts/with-test-lock.sh; workers run TARGETED tests only. A `div
  draggable` is invisible to the a11y tree — the judge drives that tree, so
  every card is a real <button> and cell targets appear only while armed
  (tab order is not a place to be generous). A card with `height:100%` and
  no `overflow` bleeds into the next row. Colour alone may not carry track
  identity; olive or ink, and NAME the track in type. A fan-out with no
  count is a cap the UI can't see: preview and queue must END in one
  predicate builder. A comment thread belongs to the version CHAIN, not a
  file row — a re-upload must not orphan the feedback that caused it. An
  upload that navigates DISCARDS the form around it: one form, one submit,
  or keep the panel mounted. A blank CSV cell is ABSENT DATA, never an
  instruction to delete — and a JSON blob patch deletes every key the file
  didn't mention. Guessed bottom padding under a fixed bar always clips
  somewhere: `flex:1; min-height:0; overflow-y:auto` removes the guess. A
  drill-in must resolve its own subject; trusting the loaded list makes the
  button a no-op from any other view. A fidelity report is an OBSERVATION,
  not a spec — "single-track data model" was wrong, and implementing it
  literally would have been the round's fourth data-loss path.
